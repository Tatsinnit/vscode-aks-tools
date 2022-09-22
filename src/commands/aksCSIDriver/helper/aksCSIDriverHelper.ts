import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { longRunning } from '../../utils/host';
import * as tmpfile from '../../utils/tempfile';
import AksClusterTreeItem from '../../../tree/aksClusterTreeItem';
import * as clusters from '../../utils/clusters';
import { failed } from '../../utils/errorable';
import { createWebView, getRenderedContent, getResourceUri } from '../../utils/webviews';

export async function startCSIDriverInstallation(
    kubectl: k8s.KubectlV1,
    aksCluster: AksClusterTreeItem,
    extensionPath: string
): Promise<void | undefined> {

    const clusterKubeConfig = await clusters.getKubeconfigYaml(aksCluster);
    if (failed(clusterKubeConfig)) {
        vscode.window.showErrorMessage(clusterKubeConfig.error);
        return undefined;
    }

    const clusterName = aksCluster.name;
    const webview = createWebView('AKS Kubectl Commands', `AKS Kubectl Command view for: ${clusterName}`).webview;

    // Static Provisioning: https://github.com/kubernetes-sigs/azurefile-csi-driver/blob/master/deploy/example/e2e_usage.md#option1-create-storage-account-by-csi-driver
    const deployCSIStorage = await longRunning(`Create storage class using Azure file management API...`,
        () => deployCSIStorageClass(kubectl, clusterKubeConfig.result)
    );
    if (!isInstallationSuccessfull(webview, extensionPath, clusterName, deployCSIStorage)) return undefined;

    const createStorageClassUsingDataPlaneAPI = await longRunning(`Create storage class using Azure file data plane API to get better file operation performance...`,
        () => deployStorageClassUsingDataPlaneAPI(kubectl, clusterKubeConfig.result)
    );
    if (!isInstallationSuccessfull(webview, extensionPath, clusterName, createStorageClassUsingDataPlaneAPI)) return undefined;

    createCSIWebView(webview, extensionPath, clusterName, createStorageClassUsingDataPlaneAPI);
}

async function deployCSIStorageClass(
    kubectl: k8s.KubectlV1,
    clusterKubeConfig: string
): Promise<k8s.KubectlV1.ShellResult | undefined> {
    try {
        const storageClassYamlFile = "https://raw.githubusercontent.com/kubernetes-sigs/azurefile-csi-driver/master/deploy/example/storageclass-azurefile-csi.yaml";
        const runResult = await tmpfile.withOptionalTempFile<k8s.KubectlV1.ShellResult | undefined>(
            clusterKubeConfig, "yaml",
            (f) => kubectl.invokeCommand(`create -f ${storageClassYamlFile} --kubeconfig="${f}"`));

        return runResult;
    } catch (e) {
        vscode.window.showErrorMessage(`Creating CSI storage class had following error: ${e}`);
        return undefined;
    }
}

async function deployStorageClassUsingDataPlaneAPI(
    kubectl: k8s.KubectlV1,
    clusterKubeConfig: string
): Promise<k8s.KubectlV1.ShellResult | undefined> {
    try {
        const storageClassYamlFile = "https://raw.githubusercontent.com/kubernetes-sigs/azurefile-csi-driver/master/deploy/example/storageclass-azurefile-large-scale.yaml";
        const runResult = await tmpfile.withOptionalTempFile<k8s.KubectlV1.ShellResult | undefined>(
            clusterKubeConfig, "yaml",
            (f) => kubectl.invokeCommand(`create -f ${storageClassYamlFile} --kubeconfig="${f}"`));

        return runResult;
    } catch (e) {
        vscode.window.showErrorMessage(`Creating CSI storage class had following error: ${e}`);
        return undefined;
    }
}

function isInstallationSuccessfull(
    webview: vscode.Webview,
    extensionPath: string,
    clusterName: string,
    installationShellResult: k8s.KubectlV1.ShellResult | undefined
): boolean {
    let success = true;

    if (!installationShellResult) return false;

    if (installationShellResult.code !== 0) {
        createCSIWebView(webview, extensionPath, clusterName, installationShellResult);
        success = false;
    }

    return success;
}


export function createCSIWebView(
    webview: vscode.Webview,
    extensionPath: string,
    clusterName: string,
    installationResponse: k8s.KubectlV1.ShellResult | undefined
) {
    // For the case of successful run of the tool we render webview with the output information.
    webview.html = getWebviewContent(
        clusterName,
        extensionPath,
        installationResponse);
}

function getWebviewContent(
    clustername: string,
    aksExtensionPath: string,
    installationResponse: k8s.KubectlV1.ShellResult | undefined
): string {
    const styleUri = getResourceUri(aksExtensionPath, 'common', 'detector.css');
    const templateUri = getResourceUri(aksExtensionPath, 'aksCSIDriver', 'akscsidriver.html');

    const data = {
        cssuri: styleUri,
        name: clustername,
        mainMessage: installationResponse?.stdout,
        resultLogs: installationResponse?.stderr,
        isSuccess: installationResponse?.code
    };

    return getRenderedContent(templateUri, data);
}