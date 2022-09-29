import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { getAksClusterTreeItem } from '../utils/clusters';
import { getExtensionPath, longRunning }  from '../utils/host';
import * as tmpfile from '../utils/tempfile';
import { Errorable, failed } from '../utils/errorable';
import * as clusters from '../utils/clusters';
import AksClusterTreeItem from '../../tree/aksClusterTreeItem';
import { createWebView, getRenderedContent, getResourceUri } from '../utils/webviews';
import { invokeKubectlCommand } from '../utils/kubectl';

export default async function aksportworx(
    _context: IActionContext,
    target: any
): Promise<void> {
    const kubectl = await k8s.extension.kubectl.v1;
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;

    if (!kubectl.available) {
        vscode.window.showWarningMessage(`Kubectl is unavailable.`);
        return undefined;
    }

    const cluster = getAksClusterTreeItem(target, cloudExplorer);
    if (failed(cluster)) {
      vscode.window.showErrorMessage(cluster.error);
      return;
    }

    const extensionPath = getExtensionPath();
    if (failed(extensionPath)) {
      vscode.window.showErrorMessage(extensionPath.error);
      return;
    }

    const clusterKubeConfig = await clusters.getKubeconfigYaml(cluster.result);
    if (failed(clusterKubeConfig)) {
        vscode.window.showErrorMessage(clusterKubeConfig.error);
        return undefined;
    }

    await loadDetector(cluster.result, extensionPath.result, clusterKubeConfig.result, kubectl);
}

async function loadDetector(
    cloudTarget: AksClusterTreeItem,
    extensionPath: string,
    clusterConfig: string,
    kubectl: k8s.APIAvailable<k8s.KubectlV1>) {

    const clustername = cloudTarget.name;
    const command = `create -f https://install.portworx.com/?comp=pxoperator`;

    await longRunning(`Loading ${clustername} portworx deployment.`,
      async () => {
        const kubectlresult = await tmpfile.withOptionalTempFile<Errorable<k8s.KubectlV1.ShellResult>>(clusterConfig, "YAML", async (kubeConfigFile) => {
            return await invokeKubectlCommand(kubectl, kubeConfigFile, command);
          });

          if (failed(kubectlresult)) {
            vscode.window.showErrorMessage(kubectlresult.error);
            return;
          }

        const webview = createWebView('AKS portworx deploy', `AKS portworx view for: ${clustername}`).webview;
        webview.html = getWebviewContent(kubectlresult.result, command, extensionPath);
      }
    );
}

function getWebviewContent(
    clusterdata: k8s.KubectlV1.ShellResult,
    commandRun: string,
    vscodeExtensionPath: string
    ): string {
      const styleUri = getResourceUri(vscodeExtensionPath, 'common', 'detector.css');
      const templateUri = getResourceUri(vscodeExtensionPath, 'aksKubectlCommand', 'akskubectlcommand.html');
      const data = {
        cssuri: styleUri,
        name: commandRun,
        command: clusterdata.stdout,
      };

      return getRenderedContent(templateUri, data);
  }
