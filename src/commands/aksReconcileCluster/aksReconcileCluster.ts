import { IActionContext } from "@microsoft/vscode-azext-utils";
import { getAksClusterTreeItem, getContainerClient } from '../utils/clusters';
import { Errorable, failed, getErrorMessage, succeeded } from '../utils/errorable';
import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { getExtension, longRunning } from '../utils/host';
import AksClusterTreeItem from "../../tree/aksClusterTreeItem";

/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 * 
 * This first part uses the helper class `MultiStepInput` that wraps the API for the multi-step case.
 */
export default async function aksReconcileCluster(
    _context: IActionContext,
    target: any
): Promise<void> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;

    const cluster = getAksClusterTreeItem(target, cloudExplorer);
    if (failed(cluster)) {
        vscode.window.showErrorMessage(cluster.error);
        return;
    }

    const extension = getExtension();
    if (failed(extension)) {
        vscode.window.showErrorMessage(extension.error);
        return;
    }

    const clusterName = cluster.result.name;

    const answer = await vscode.window.showInformationMessage(`Do you want to delete cluster ${clusterName}?`, "Yes", "No");

    if (answer === "Yes") {
        const result = await longRunning(`Deleting cluster ${clusterName}.`, async () => {
            return await updateCluster(cluster.result, clusterName)
        });



        if (failed(result)) {
            vscode.window.showErrorMessage(result.error);
        }

        if (succeeded(result)) {
            vscode.window.showInformationMessage(result.result);
        }
    }
}

async function updateCluster(
    target: AksClusterTreeItem,
    clusterName: string
): Promise<Errorable<string>> {
    try {
        const containerClient = getContainerClient(target);
        const location = target.resource.location || '';

        if (location == '') {
            return { succeeded: false, error: "Location cannot be empty." };
        }

        await containerClient.managedClusters.beginCreateOrUpdate(target.resourceGroupName, clusterName, { location: location });

        return { succeeded: true, result: "Update cluster succeeded." };
    } catch (ex) {
        return { succeeded: false, error: `Error invoking ${clusterName} reconcile/update cluster: ${getErrorMessage(ex)}` };
    }
}