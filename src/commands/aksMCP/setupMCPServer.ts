import { IActionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from "vscode";
import * as k8s from "vscode-kubernetes-tools-api";
import { getReadySessionProvider } from "../../auth/azureAuth";
import { getKubernetesClusterInfo } from "../utils/clusters";
import { failed } from "../utils/errorable";
import { getExtension } from "../utils/host";

import * as tmpfile from "../utils/tempfile";
import { getWorkflowJson } from "../utils/configureWorkflowHelper";
import { window } from "vscode";
import { invokeKubectlCommand } from "../utils/kubectl";

export default async function setupMCPServer(_context: IActionContext, target: unknown): Promise<void> {

    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    
    const sessionProvider = await getReadySessionProvider();

    if (!cloudExplorer.available) {
        vscode.window.showWarningMessage(`Cloud explorer is unavailable.`);
        return;
    }

    if (!clusterExplorer.available) {
        vscode.window.showWarningMessage(`Cluster explorer is unavailable.`);
        return;
    }

    if (failed(sessionProvider)) {
        vscode.window.showErrorMessage(sessionProvider.error);
        return;
    }

    const extension = getExtension();
    if (failed(extension)) {
        vscode.window.showErrorMessage(extension.error);
        return;
    }

     const clusterInfo = await getKubernetesClusterInfo(sessionProvider.result, target, cloudExplorer, clusterExplorer);
        if (failed(clusterInfo)) {
            vscode.window.showErrorMessage(clusterInfo.error);
            return;
        }

     // Configure the starter workflow data.
     const filePath = getWorkflowJson("mcp");
     if (failed(filePath)) {
        vscode.window.showErrorMessage(filePath.error);
        return;
    }
    const kubeConfigFile = await tmpfile.createTempFile(clusterInfo.result.kubeconfigYaml, "yaml");

    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        window.showErrorMessage(`Kubectl is unavailable.`);
        return;
    }
    const manifest = generateManifests(filePath.result);

    const tempFile = await tmpfile.createTempFile(manifest, "yaml");

    const command = `apply -f ${tempFile.filePath}`;
    const commandResult = await invokeKubectlCommand(kubectl, kubeConfigFile.filePath, command);
    if (failed(commandResult)) {
        vscode.window.showErrorMessage(commandResult.error);
        return;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateManifests(configStr: any): string {
  const config = JSON.parse(configStr);
  return `
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${config.name}-config
data:
  config.yaml: |
    server:
      port: ${config.port}
    logLevel: ${config.logLevel}

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.name}
spec:
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${config.name}
  template:
    metadata:
      labels:
        app: ${config.name}
    spec:
      containers:
        - name: ${config.name}
          image: ${config.image}
          ports:
            - containerPort: ${config.port}
          args:
            - "--config=/etc/mcp/config.yaml"
          volumeMounts:
            - name: config-volume
              mountPath: /etc/mcp
      volumes:
        - name: config-volume
          configMap:
            name: ${config.name}-config

---
apiVersion: v1
kind: Service
metadata:
  name: ${config.name}
spec:
  selector:
    app: ${config.name}
  ports:
    - protocol: TCP
      port: 443
      targetPort: ${config.port}
  type: ClusterIP
  `;
}
