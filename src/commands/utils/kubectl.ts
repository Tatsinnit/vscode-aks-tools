import { APIAvailable, KubectlV1 } from 'vscode-kubernetes-tools-api';
import { Errorable, failed } from './errorable';
import AksClusterTreeItem from '../../tree/aksClusterTreeItem';
import { createWebView, getRenderedContent, getResourceUri } from '../utils/webviews';
import * as tmpfile from '../utils/tempfile';
import * as k8s from 'vscode-kubernetes-tools-api';
import { getExtensionPath, longRunning } from './host';
import * as vscode from 'vscode';
import * as clusters from '../utils/clusters';
import { IActionContext } from '@microsoft/vscode-azext-utils';

export async function invokeKubectlCommand(kubectl: APIAvailable<KubectlV1>, kubeConfigFile: string, command: string): Promise<Errorable<KubectlV1.ShellResult>> {
    const shellResult = await kubectl.api.invokeCommand(`--kubeconfig="${kubeConfigFile}" ${command}`);
    if (shellResult === undefined) {
        return { succeeded: false, error: `Failed to run kubectl command: ${command}` };
    }

    if (shellResult.code !== 0) {
        return { succeeded: false, error: `Kubectl returned error ${shellResult.code} for ${command}\nError: ${shellResult.stderr}` };
    }

    return { succeeded: true, result: shellResult };
}

export async function aksKubectlCommands(
    _context: IActionContext,
    target: any,
    command: string
): Promise<void> {
    const kubectl = await k8s.extension.kubectl.v1;
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;

    if (!kubectl.available) {
        vscode.window.showWarningMessage(`Kubectl is unavailable.`);
        return undefined;
    }

    const cluster = clusters.getAksClusterTreeItem(target, cloudExplorer);
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

    await loadKubectlCommandRun(cluster.result, extensionPath.result, clusterKubeConfig.result, command, kubectl);
}

async function loadKubectlCommandRun(
    cloudTarget: AksClusterTreeItem,
    extensionPath: string,
    clusterConfig: string,
    command: string,
    kubectl: k8s.APIAvailable<k8s.KubectlV1>) {

    const clustername = cloudTarget.name;
    await longRunning(`Loading ${clustername} kubectl command run.`,
        async () => {
            const kubectlresult = await tmpfile.withOptionalTempFile<Errorable<k8s.KubectlV1.ShellResult>>(clusterConfig, "YAML", async (kubeConfigFile) => {
                return await invokeKubectlCommand(kubectl, kubeConfigFile, command);
            });

            if (failed(kubectlresult)) {
                vscode.window.showErrorMessage(kubectlresult.error);
                return;
            }
            const webview = createWebView('AKS Kubectl Commands', `AKS Kubectl Command view for: ${clustername}`).webview;
            webview.html = getKubectlWebviewContent(kubectlresult.result, command, extensionPath);
        }
    );
}

function getKubectlWebviewContent(
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