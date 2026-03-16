import * as k8s from "vscode-kubernetes-tools-api";
import * as vscode from "vscode";
import * as l10n from "@vscode/l10n";
import { getReadySessionProvider } from "../../auth/azureAuth";
import { FleetManagedNamespace } from "@azure/arm-containerservicefleet";
import { getAksClusterSubscriptionNode } from "../utils/clusters";
import { failed, Errorable } from "../utils/errorable";
import { getAksFleetTreeNode } from "../utils/fleet";
import { fleetResourceType, getResources } from "../utils/azureResources";
import { getAksFleetClient, listAll } from "../utils/arm";

export interface ResolvedFleetContext {
    subscriptionId: string;
    resourceGroupName: string;
    fleetName: string;
}

export interface FleetManagedNamespaceItem {
    name: string;
    provisioningState?: string;
    placementType?: string;
}

interface FleetSelectionItem extends vscode.QuickPickItem {
    readonly fleetName: string;
    readonly resourceGroupName: string;
}

export async function resolveFleetContext(target: unknown): Promise<Errorable<ResolvedFleetContext>> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    const sessionProvider = await getReadySessionProvider();

    if (failed(sessionProvider)) {
        return { succeeded: false, error: sessionProvider.error };
    }

    const fleetNode = getAksFleetTreeNode(target, cloudExplorer);
    if (!failed(fleetNode)) {
        return {
            succeeded: true,
            result: {
                subscriptionId: fleetNode.result.subscriptionId,
                resourceGroupName: fleetNode.result.resourceGroupName,
                fleetName: fleetNode.result.name,
            },
        };
    }

    const subscriptionNode = getAksClusterSubscriptionNode(target, cloudExplorer);
    if (failed(subscriptionNode)) {
        return {
            succeeded: false,
            error: l10n.t("This command only applies to AKS subscriptions and Fleet hub resources."),
        };
    }

    const fleets = await getResources(
        sessionProvider.result,
        subscriptionNode.result.subscriptionId,
        fleetResourceType,
    );
    if (failed(fleets)) {
        return { succeeded: false, error: fleets.error };
    }

    if (fleets.result.length === 0) {
        return {
            succeeded: false,
            error: l10n.t("No Fleet hub resources found in subscription {0}.", subscriptionNode.result.name),
        };
    }

    const fleetPick = await vscode.window.showQuickPick<FleetSelectionItem>(
        fleets.result
            .map((fleet) => ({
                label: fleet.name,
                description: fleet.resourceGroup,
                detail: fleet.location,
                fleetName: fleet.name,
                resourceGroupName: fleet.resourceGroup,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        {
            title: l10n.t("Select Fleet hub"),
            placeHolder: l10n.t("Choose a Fleet hub"),
            ignoreFocusOut: true,
        },
    );

    if (!fleetPick) {
        return { succeeded: false, error: l10n.t("No Fleet hub selected.") };
    }

    return {
        succeeded: true,
        result: {
            subscriptionId: subscriptionNode.result.subscriptionId,
            resourceGroupName: fleetPick.resourceGroupName,
            fleetName: fleetPick.fleetName,
        },
    };
}

export async function listFleetManagedNamespaces(
    context: ResolvedFleetContext,
): Promise<Errorable<FleetManagedNamespaceItem[]>> {
    const sessionProvider = await getReadySessionProvider();
    if (failed(sessionProvider)) {
        return { succeeded: false, error: sessionProvider.error };
    }

    const fleetClient = getAksFleetClient(sessionProvider.result, context.subscriptionId);
    const namespaces = await listAll(
        fleetClient.fleetManagedNamespaces.listByFleet(context.resourceGroupName, context.fleetName),
    );

    if (failed(namespaces)) {
        return { succeeded: false, error: namespaces.error };
    }

    const items = namespaces.result
        .filter((n): n is FleetManagedNamespace & { name: string } => !!n.name)
        .map((n) => ({
            name: n.name,
            provisioningState: n.properties?.provisioningState,
            placementType:
                n.properties?.propagationPolicy?.placementProfile?.defaultClusterResourcePlacement?.policy
                    ?.placementType,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return { succeeded: true, result: items };
}

export async function pickFleetNamespaceName(context: ResolvedFleetContext): Promise<Errorable<string>> {
    const namespacesResult = await listFleetManagedNamespaces(context);
    if (failed(namespacesResult)) {
        return { succeeded: false, error: namespacesResult.error };
    }

    const namespaces = namespacesResult.result.map((item) => ({
        label: item.name,
        description: item.provisioningState,
        detail: item.placementType,
    }));

    if (namespaces.length === 0) {
        return {
            succeeded: false,
            error: l10n.t("No Fleet managed namespaces found in hub {0}.", context.fleetName),
        };
    }

    const namespacePick = await vscode.window.showQuickPick(namespaces, {
        title: l10n.t("Select Fleet managed namespace"),
        placeHolder: l10n.t("Choose a managed namespace"),
        ignoreFocusOut: true,
    });

    if (!namespacePick) {
        return { succeeded: false, error: l10n.t("No managed namespace selected.") };
    }

    return { succeeded: true, result: namespacePick.label };
}

export function buildFleetManagedNamespaceScope(context: ResolvedFleetContext, namespaceName: string): string {
    return `/subscriptions/${context.subscriptionId}/resourceGroups/${context.resourceGroupName}/providers/Microsoft.ContainerService/fleets/${context.fleetName}/fleetManagedNamespaces/${namespaceName}`;
}

export function reportError(message: string): void {
    vscode.window.showErrorMessage(message);
}

export async function withResolvedFleetContext(
    target: unknown,
    action: (fleetContext: ResolvedFleetContext) => Promise<void>,
): Promise<void> {
    const fleetContext = await resolveFleetContext(target);
    if (failed(fleetContext)) {
        reportError(fleetContext.error);
        return;
    }

    await action(fleetContext.result);
}
