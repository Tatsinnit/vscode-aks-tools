import { IActionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from "vscode";
import * as k8s from "vscode-kubernetes-tools-api";
import { getCredential, getReadySessionProvider } from "../../auth/azureAuth";
import { getAksClusterSubscriptionNode } from "../utils/clusters";
import { failed } from "../utils/errorable";
import { getExtension, longRunning } from "../utils/host";
import { ContainerServiceFleetClient } from "@azure/arm-containerservicefleet";
import { fleetCreate } from "../utils/fleet";
import { getResourceGroups } from "../utils/resourceGroups";

/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 *
 * This first part uses the helper class `MultiStepInput` that wraps the API for the multi-step case.
 */
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

    if (!subscriptionNode.result?.subscriptionId || !subscriptionNode.result?.name) {
        vscode.window.showErrorMessage("Subscription not found.");
        return;
    }

    const subscriptionId = subscriptionNode.result?.subscriptionId;

    if (!subscriptionNode.result?.subscriptionId || !subscriptionNode.result?.name) {
        vscode.window.showErrorMessage("Subscription not found.");
        return;
    }

    const extension = getExtension();
    if (failed(extension)) {
        vscode.window.showErrorMessage(extension.error);
        return;
    }

    // make fleet creation call here
    const client = new ContainerServiceFleetClient(getCredential(sessionProvider.result), subscriptionId);
    const resourceGroup = await getResourceGroups(sessionProvider.result, subscriptionId);

    if (failed(resourceGroup)) {
        vscode.window.showErrorMessage(resourceGroup.error);
        return;
    }

    const fleetName = "fleet1";
    // Junyu's playground
    // Todo: Add fleet resource
    // Todo: Add fleet find a way to choose resrouce groupName
    const resource = {
        location: "East US break break to avoid fleet now",
    };

    // Fleet API call.
    // https://learn.microsoft.com/en-nz/rest/api/fleet/fleets/create-or-update?view=rest-fleet-2023-10-15&tabs=JavaScript

    // Sample only for Junyus playground
    const resultFleetCreate = await longRunning(`Creating fleet...`, async () => {
        return fleetCreate(client, resourceGroup.result[0].name, fleetName, resource);
    });

    if (failed(resultFleetCreate)) {
        vscode.window.showErrorMessage(`Failed to create fleet: ${resultFleetCreate}`);
        return;
    }
    vscode.window.showInformationMessage(`Fleet ${resultFleetCreate.result}.`);
}
