import { IActionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from "vscode";
import * as k8s from "vscode-kubernetes-tools-api";
import { getCredential, getReadySessionProvider } from "../../auth/azureAuth";
import { getAksClusterSubscriptionNode } from "../utils/clusters";
import { failed } from "../utils/errorable";
import { getResourceGroups } from "../utils/resourceGroups";
import { createFleet } from "../../panels/CreateFleetPanel";
import { ContainerServiceFleetClient } from "@azure/arm-containerservicefleet";

export default async function aksCreateFleet(_context: IActionContext, target: unknown): Promise<void> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    const sessionProvider = await getReadySessionProvider();

    if (failed(sessionProvider)) {
        vscode.window.showErrorMessage(sessionProvider.error);
        return;
    }

    const subscriptionNode = getAksClusterSubscriptionNode(target, cloudExplorer);

    if (failed(subscriptionNode)) {
        vscode.window.showErrorMessage(subscriptionNode.error);
        return;
    }

    const subscriptionId = subscriptionNode.result?.subscriptionId;
    const subscriptionName = subscriptionNode.result?.name;
    const resourceGroup = await getResourceGroups(sessionProvider.result, subscriptionId);

    if (failed(resourceGroup)) {
        vscode.window.showErrorMessage(resourceGroup.error);
        return;
    }

    if (!subscriptionId || !subscriptionName) {
        vscode.window.showErrorMessage("Subscription ID or Name is undefined.");
        return;
    }

    const client = new ContainerServiceFleetClient(getCredential(sessionProvider.result), subscriptionId);
    createFleet(client, "junyuqian", "vscode-fleet", { location: "Australia East" });
}
