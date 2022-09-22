import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { getAksClusterTreeItem } from '../utils/clusters';
import { getExtensionPath, longRunning }  from '../utils/host';
import { failed } from '../utils/errorable';
import AksClusterTreeItem from '../../tree/aksClusterTreeItem';
import { startCSIDriverInstallation } from './helper/aksCSIDriverHelper';

export default async function aksCSICreateStorageAccount(
    _context: IActionContext,
    target: any
): Promise<void> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    const kubectl = await k8s.extension.kubectl.v1;

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

    await loadCSIResult(kubectl, cluster.result, extensionPath.result);
}

async function loadCSIResult(
    kubectl: k8s.APIAvailable<k8s.KubectlV1>,
    cloudTarget: AksClusterTreeItem,
    extensionPath: string) {

    const clustername = cloudTarget.name;
    await longRunning(`Deploying container storage interface storage class ${clustername}.`,
      async () => {
        await startCSIDriverInstallation(kubectl.api, cloudTarget, extensionPath);
      }
    );
}
