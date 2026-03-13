import {
    FleetManagedNamespace,
    KnownAdoptionPolicy,
    KnownDeletePolicy,
    KnownPlacementType,
    KnownPropagationType,
} from "@azure/arm-containerservicefleet";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import * as k8s from "vscode-kubernetes-tools-api";
import { env, l10n, QuickPickItem, Uri, window } from "vscode";
import { getReadySessionProvider } from "../../auth/azureAuth";
import { parseResource } from "../../azure-api-utils";
import { getAksFleetClient } from "../utils/arm";
import { fleetResourceType, getFleetMembers, getResources } from "../utils/azureResources";
import { getAksClusterSubscriptionNode } from "../utils/clusters";
import { failed } from "../utils/errorable";
import { getFleet, getAksFleetTreeNode } from "../utils/fleet";
import { longRunning } from "../utils/host";
import { reporter } from "../utils/reporter";

interface FleetSelectionItem extends QuickPickItem {
    readonly fleetName: string;
    readonly resourceGroupName: string;
}

type PlacementChoice = "hubOnly" | "allMembers" | "selectedMembers";

export default async function aksCreateManagedFleetNamespace(_context: IActionContext, target: unknown): Promise<void> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    const sessionProvider = await getReadySessionProvider();

    if (failed(sessionProvider)) {
        window.showErrorMessage(sessionProvider.error);
        return;
    }

    const fleetNode = getAksFleetTreeNode(target, cloudExplorer);

    let subscriptionId: string;
    let resourceGroupName: string;
    let fleetName: string;
    let invokedFrom: "fleet" | "subscription" = "fleet";

    if (!failed(fleetNode)) {
        subscriptionId = fleetNode.result.subscriptionId;
        resourceGroupName = fleetNode.result.resourceGroupName;
        fleetName = fleetNode.result.name;
        invokedFrom = "fleet";
    } else {
        const subscriptionNode = getAksClusterSubscriptionNode(target, cloudExplorer);
        if (failed(subscriptionNode)) {
            window.showErrorMessage(
                l10n.t("This command only applies to AKS subscriptions and Fleet manager resources."),
            );
            return;
        }

        const fleets = await getResources(
            sessionProvider.result,
            subscriptionNode.result.subscriptionId,
            fleetResourceType,
        );
        if (failed(fleets)) {
            window.showErrorMessage(fleets.error);
            return;
        }

        if (fleets.result.length === 0) {
            window.showWarningMessage(
                l10n.t("No Fleet manager resources found in subscription {0}.", subscriptionNode.result.name),
            );
            return;
        }

        const fleetPick = await window.showQuickPick<FleetSelectionItem>(
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
                title: l10n.t("Create managed namespace for fleet"),
                placeHolder: l10n.t("Select a Fleet manager"),
                ignoreFocusOut: true,
            },
        );

        if (!fleetPick) {
            return;
        }

        subscriptionId = subscriptionNode.result.subscriptionId;
        resourceGroupName = fleetPick.resourceGroupName;
        fleetName = fleetPick.fleetName;
        invokedFrom = "subscription";
    }

    const client = getAksFleetClient(sessionProvider.result, subscriptionId);

    const fleet = await getFleet(client, resourceGroupName, fleetName);
    if (failed(fleet)) {
        window.showErrorMessage(fleet.error);
        return;
    }

    const namespaceName = await window.showInputBox({
        title: l10n.t("Create managed namespace for fleet"),
        prompt: l10n.t("Managed namespace name"),
        placeHolder: l10n.t("Enter a Kubernetes namespace name"),
        ignoreFocusOut: true,
        validateInput: (value) => validateNamespaceName(value),
    });

    if (!namespaceName) {
        return;
    }

    const adoptionPolicy = await pickAdoptionPolicy();
    if (!adoptionPolicy) {
        return;
    }

    const deletePolicy = await pickDeletePolicy();
    if (!deletePolicy) {
        return;
    }

    const placementChoice = await pickPlacementChoice();
    if (!placementChoice) {
        return;
    }

    let resolvedPlacementChoice: PlacementChoice = placementChoice;
    let selectedClusterNames: string[] = [];
    if (resolvedPlacementChoice === "selectedMembers") {
        const members = await getFleetMembers(sessionProvider.result, {
            id: fleet.result.id!,
            name: fleetName,
            resourceGroup: resourceGroupName,
        });

        if (failed(members)) {
            window.showErrorMessage(members.error);
            return;
        }

        const clusterNames = members.result
            .map((member) => parseResource(member.clusterResourceId).name)
            .filter((name): name is string => !!name)
            .sort((a, b) => a.localeCompare(b));

        if (clusterNames.length === 0) {
            resolvedPlacementChoice = "hubOnly";
            window.showWarningMessage(
                l10n.t("This fleet has no member clusters. The namespace will be created on hub only."),
            );
        } else {
            const selected = await window.showQuickPick(
                clusterNames.map((name) => ({ label: name })),
                {
                    title: l10n.t("Select member clusters"),
                    placeHolder: l10n.t("Choose member clusters to place the namespace"),
                    canPickMany: true,
                    ignoreFocusOut: true,
                },
            );

            if (!selected) {
                return;
            }

            selectedClusterNames = selected.map((item) => item.label);
        }
    }

    const resource: FleetManagedNamespace = {
        location: fleet.result.location!,
        properties: {
            adoptionPolicy,
            deletePolicy,
            propagationPolicy:
                resolvedPlacementChoice === "hubOnly"
                    ? undefined
                    : {
                          type: KnownPropagationType.Placement,
                          placementProfile: {
                              defaultClusterResourcePlacement: {
                                  policy:
                                      resolvedPlacementChoice === "allMembers"
                                          ? { placementType: KnownPlacementType.PickAll }
                                          : {
                                                placementType: KnownPlacementType.PickFixed,
                                                clusterNames: selectedClusterNames,
                                            },
                              },
                          },
                      },
        },
    };

    try {
        await longRunning(l10n.t("Creating managed namespace {0} in fleet {1}", namespaceName, fleetName), async () => {
            await client.fleetManagedNamespaces.createOrUpdate(resourceGroupName, fleetName, namespaceName, resource);
        });

        sendManagedNamespaceTelemetry({
            result: "success",
            category: "none",
            invokedFrom,
            placementChoice: resolvedPlacementChoice,
        });

        window.showInformationMessage(
            l10n.t("Managed namespace {0} was created for fleet {1}.", namespaceName, fleetName),
        );
    } catch (error) {
        const mappedError = mapManagedNamespaceCreateError(error);
        sendManagedNamespaceTelemetry({
            result: "failure",
            category: mappedError.category,
            invokedFrom,
            placementChoice: resolvedPlacementChoice,
        });

        if (mappedError.docsUrl) {
            const openDocs = l10n.t("Open docs");
            const selection = await window.showErrorMessage(mappedError.message, openDocs);
            if (selection === openDocs) {
                sendManagedNamespaceTelemetry({
                    result: "action",
                    category: "open-docs",
                    invokedFrom,
                    placementChoice: resolvedPlacementChoice,
                });
                await env.openExternal(Uri.parse(mappedError.docsUrl));
            }
            return;
        }

        window.showErrorMessage(mappedError.message);
    }
}

function mapManagedNamespaceCreateError(error: unknown): {
    message: string;
    docsUrl?: string;
    category: "rbac" | "preview" | "hub-state" | "conflict" | "unknown";
} {
    const rawMessage = getErrorMessage(error);
    const lower = rawMessage.toLowerCase();
    const docsUrl =
        "https://learn.microsoft.com/en-us/azure/kubernetes-fleet/howto-managed-namespaces?pivots=azure-portal#create-the-managed-fleet-namespace";

    if (
        lower.includes("forbidden") ||
        lower.includes("authorizationfailed") ||
        lower.includes("does not have authorization")
    ) {
        return {
            message: l10n.t(
                "You don't have permission to create Fleet managed namespaces. Ensure your account has sufficient RBAC on the Fleet manager resource, then retry.",
            ),
            docsUrl,
            category: "rbac",
        };
    }

    if (
        lower.includes("preview") ||
        lower.includes("not registered") ||
        lower.includes("missingregistration") ||
        lower.includes("invalidresourcenamespace")
    ) {
        return {
            message: l10n.t(
                "Managed Fleet Namespace is not available in this subscription or region yet. Verify preview/feature registration and try again.",
            ),
            docsUrl,
            category: "preview",
        };
    }

    if (
        lower.includes("hub") &&
        (lower.includes("not found") || lower.includes("required") || lower.includes("missing"))
    ) {
        return {
            message: l10n.t(
                "This Fleet manager is not ready for managed namespace placement. Ensure the fleet has a hub cluster and retry.",
            ),
            docsUrl,
            category: "hub-state",
        };
    }

    if (lower.includes("already exists") || lower.includes("conflict")) {
        return {
            message: l10n.t(
                "A managed namespace with this name already exists. Choose a different name or adjust adoption policy.",
            ),
            category: "conflict",
        };
    }

    return {
        message: l10n.t("Failed to create managed namespace: {0}", rawMessage),
        category: "unknown",
    };
}

// Telemetry fields are intentionally constrained to non-PII dimensions
// (result category, invocation source, and placement choice).
function sendManagedNamespaceTelemetry(props: {
    result: "success" | "failure" | "action";
    category: "none" | "rbac" | "preview" | "hub-state" | "conflict" | "unknown" | "open-docs";
    invokedFrom: "fleet" | "subscription";
    placementChoice: PlacementChoice;
}) {
    if (!reporter) {
        return;
    }

    reporter.sendTelemetryEvent("command", {
        command: "aks.aksCreateManagedFleetNamespace",
        managedNamespaceCreateResult: props.result,
        managedNamespaceCreateErrorCategory: props.category,
        managedNamespaceCreateInvokedFrom: props.invokedFrom,
        managedNamespaceCreatePlacementChoice: props.placementChoice,
    });
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === "string") {
        return error;
    }

    if (error && typeof error === "object") {
        const maybeWithMessage = error as { message?: string; details?: { message?: string }[] };
        if (maybeWithMessage.message) {
            return maybeWithMessage.message;
        }

        const detailsMessage = maybeWithMessage.details
            ?.map((d) => d.message)
            .filter((m): m is string => !!m)
            .join("; ");
        if (detailsMessage) {
            return detailsMessage;
        }
    }

    return l10n.t("Unknown error");
}

function validateNamespaceName(name: string): string | undefined {
    if (!name || name.trim().length === 0) {
        return l10n.t("Namespace name is required.");
    }

    if (name.length > 63) {
        return l10n.t("Namespace name must be 63 characters or fewer.");
    }

    const namespaceRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!namespaceRegex.test(name)) {
        return l10n.t("Namespace name must be lowercase and may include hyphens.");
    }

    return undefined;
}

async function pickAdoptionPolicy(): Promise<KnownAdoptionPolicy | undefined> {
    const choice = await window.showQuickPick(
        [
            {
                label: l10n.t("Never"),
                detail: l10n.t("Do not adopt if a namespace with the same name already exists."),
                value: KnownAdoptionPolicy.Never,
            },
            {
                label: l10n.t("If identical"),
                detail: l10n.t("Adopt only when the existing namespace is identical."),
                value: KnownAdoptionPolicy.IfIdentical,
            },
            {
                label: l10n.t("Always"),
                detail: l10n.t("Always adopt an existing namespace with the same name."),
                value: KnownAdoptionPolicy.Always,
            },
        ],
        {
            title: l10n.t("Adoption policy"),
            placeHolder: l10n.t("Select how to handle an existing namespace"),
            ignoreFocusOut: true,
        },
    );

    return choice?.value;
}

async function pickDeletePolicy(): Promise<KnownDeletePolicy | undefined> {
    const choice = await window.showQuickPick(
        [
            {
                label: l10n.t("Keep namespace"),
                detail: l10n.t("Delete only the ARM managed namespace resource."),
                value: KnownDeletePolicy.Keep,
            },
            {
                label: l10n.t("Delete namespace"),
                detail: l10n.t("Delete both the ARM resource and Kubernetes namespace."),
                value: KnownDeletePolicy.Delete,
            },
        ],
        {
            title: l10n.t("Delete policy"),
            placeHolder: l10n.t("Select behavior when managed namespace is deleted"),
            ignoreFocusOut: true,
        },
    );

    return choice?.value;
}

async function pickPlacementChoice(): Promise<PlacementChoice | undefined> {
    const choice = await window.showQuickPick(
        [
            {
                label: l10n.t("Hub only"),
                detail: l10n.t("Create on the Fleet hub cluster only."),
                value: "hubOnly" as const,
            },
            {
                label: l10n.t("All members"),
                detail: l10n.t("Propagate to all member clusters."),
                value: "allMembers" as const,
            },
            {
                label: l10n.t("Select members"),
                detail: l10n.t("Choose specific member clusters."),
                value: "selectedMembers" as const,
            },
        ],
        {
            title: l10n.t("Placement"),
            placeHolder: l10n.t("Choose namespace placement scope"),
            ignoreFocusOut: true,
        },
    );

    return choice?.value;
}
