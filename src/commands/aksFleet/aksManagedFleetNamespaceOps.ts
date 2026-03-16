import { IActionContext } from "@microsoft/vscode-azext-utils";
import * as l10n from "@vscode/l10n";
import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { RoleDefinition } from "@azure/arm-authorization";
import { getReadySessionProvider } from "../../auth/azureAuth";
import { parseResource } from "../../azure-api-utils";
import { getAcrManagementClient, getAksFleetClient, getAuthorizationManagementClient, listAll } from "../utils/arm";
import { failed } from "../utils/errorable";
import { createRoleAssignment } from "../utils/roleAssignments";
import {
    buildFleetManagedNamespaceScope,
    listFleetManagedNamespaces,
    pickFleetNamespaceName,
    withResolvedFleetContext,
} from "./fleetCliUtils";

export async function aksListManagedFleetNamespaces(_context: IActionContext, target: unknown): Promise<void> {
    await withResolvedFleetContext(target, async (fleetContext) => {
        const namespacesResult = await listFleetManagedNamespaces(fleetContext);

        if (failed(namespacesResult)) {
            vscode.window.showErrorMessage(namespacesResult.error);
            return;
        }

        const items = namespacesResult.result
            .map((n) => ({
                label: n.name,
                description: n.provisioningState,
                detail: n.placementType,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        if (items.length === 0) {
            vscode.window.showInformationMessage(
                l10n.t("No Fleet managed namespaces found in hub {0}.", fleetContext.fleetName),
            );
            return;
        }

        await vscode.window.showQuickPick(items, {
            title: l10n.t("Managed namespaces in {0}", fleetContext.fleetName),
            placeHolder: l10n.t("Review managed namespaces"),
            ignoreFocusOut: true,
        });
    });
}

export async function aksGetManagedFleetNamespaceCredentials(_context: IActionContext, target: unknown): Promise<void> {
    await withResolvedFleetContext(target, async (fleetContext) => {
        const sessionProvider = await getReadySessionProvider();
        if (failed(sessionProvider)) {
            vscode.window.showErrorMessage(sessionProvider.error);
            return;
        }

        const namespace = await pickFleetNamespaceName(fleetContext);
        if (failed(namespace)) {
            vscode.window.showErrorMessage(namespace.error);
            return;
        }

        const fleetClient = getAksFleetClient(sessionProvider.result, fleetContext.subscriptionId);
        const credentials = await fleetClient.fleets.listCredentials(
            fleetContext.resourceGroupName,
            fleetContext.fleetName,
        );

        const kubeConfigBytes = credentials.kubeconfigs?.[0]?.value;
        if (!kubeConfigBytes) {
            vscode.window.showErrorMessage(l10n.t("No Fleet kubeconfig returned for hub {0}.", fleetContext.fleetName));
            return;
        }

        const kubeConfigYaml = Buffer.from(kubeConfigBytes).toString("utf8");
        const kubeDir = path.join(os.homedir(), ".kube");
        const kubeConfigPath = path.join(kubeDir, `${fleetContext.fleetName}-${namespace.result}-fleet-config`);
        fs.mkdirSync(kubeDir, { recursive: true });
        fs.writeFileSync(kubeConfigPath, kubeConfigYaml, { encoding: "utf8" });

        const openFile = l10n.t("Open kubeconfig");
        const copyPath = l10n.t("Copy path");
        const selection = await vscode.window.showInformationMessage(
            l10n.t(
                "Fleet credentials saved to {0}. Use this kubeconfig and set namespace '{1}' in your context.",
                kubeConfigPath,
                namespace.result,
            ),
            openFile,
            copyPath,
        );

        if (selection === openFile) {
            await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(kubeConfigPath));
        } else if (selection === copyPath) {
            await vscode.env.clipboard.writeText(kubeConfigPath);
        }
    });
}

export async function aksSetManagedFleetNamespaceRbac(_context: IActionContext, target: unknown): Promise<void> {
    await withResolvedFleetContext(target, async (fleetContext) => {
        const sessionProvider = await getReadySessionProvider();
        if (failed(sessionProvider)) {
            vscode.window.showErrorMessage(sessionProvider.error);
            return;
        }

        const namespace = await pickFleetNamespaceName(fleetContext);
        if (failed(namespace)) {
            vscode.window.showErrorMessage(namespace.error);
            return;
        }

        const assigneeObjectId = await vscode.window.showInputBox({
            title: l10n.t("Set Fleet namespace RBAC"),
            prompt: l10n.t("Assignee object ID (Microsoft Entra object ID)"),
            placeHolder: l10n.t("e.g. 9e4fb807-919c-479b-99e8-37db7e4ff6e9"),
            ignoreFocusOut: true,
            validateInput: (value) => (value.trim().length === 0 ? l10n.t("Object ID is required.") : undefined),
        });

        if (!assigneeObjectId) {
            return;
        }

        const scope = buildFleetManagedNamespaceScope(fleetContext, namespace.result);
        const authClient = getAuthorizationManagementClient(sessionProvider.result, fleetContext.subscriptionId);

        const roles = [
            "Azure Kubernetes Fleet Manager RBAC Admin",
            "Azure Kubernetes Fleet Manager Hub Cluster User Role",
        ];

        for (const role of roles) {
            const roleDefinitionId = await resolveRoleDefinitionIdByName(authClient, scope, role);
            if (failed(roleDefinitionId)) {
                vscode.window.showErrorMessage(roleDefinitionId.error);
                return;
            }

            const roleResult = await createRoleAssignment(
                authClient,
                fleetContext.subscriptionId,
                assigneeObjectId.trim(),
                roleDefinitionId.result,
                scope,
                "User",
            );
            if (failed(roleResult)) {
                const lower = roleResult.error.toLowerCase();
                if (lower.includes("roleassignmentexists")) {
                    continue;
                }

                vscode.window.showErrorMessage(
                    l10n.t(
                        "Failed to assign role '{0}'. Ensure you have permission to create role assignments at Fleet managed namespace scope. Scope: {1}.",
                        role,
                        scope,
                    ),
                );
                return;
            }
        }

        vscode.window.showInformationMessage(
            l10n.t("RBAC roles assigned for managed namespace {0}.", namespace.result),
        );
    });
}

async function resolveRoleDefinitionIdByName(
    authClient: ReturnType<typeof getAuthorizationManagementClient>,
    scope: string,
    roleName: string,
): Promise<{ succeeded: true; result: string } | { succeeded: false; error: string }> {
    const defs = await listAll(
        authClient.roleDefinitions.list(scope, {
            filter: `roleName eq '${roleName}'`,
        }),
    );

    if (failed(defs)) {
        return { succeeded: false, error: defs.error };
    }

    const definition = defs.result.find((d: RoleDefinition) => !!d.id);
    if (!definition?.id) {
        return { succeeded: false, error: l10n.t("Role definition not found for role '{0}'.", roleName) };
    }

    const parsed = parseResource(definition.id);
    if (!parsed.name) {
        return { succeeded: false, error: l10n.t("Failed to parse role definition for role '{0}'.", roleName) };
    }

    return { succeeded: true, result: parsed.name };
}

export async function aksListFleetHubAcrs(_context: IActionContext, target: unknown): Promise<void> {
    await withResolvedFleetContext(target, async (fleetContext) => {
        const sessionProvider = await getReadySessionProvider();
        if (failed(sessionProvider)) {
            vscode.window.showErrorMessage(sessionProvider.error);
            return;
        }

        const acrClient = getAcrManagementClient(sessionProvider.result, fleetContext.subscriptionId);
        const registries = await listAll(acrClient.registries.listByResourceGroup(fleetContext.resourceGroupName));
        if (failed(registries)) {
            vscode.window.showErrorMessage(registries.error);
            return;
        }

        const items = registries.result
            .filter((registry) => !!registry.name)
            .map((registry) => ({
                label: registry.name as string,
                description: registry.sku?.name,
                detail: registry.loginServer,
                loginServer: registry.loginServer,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        if (items.length === 0) {
            vscode.window.showInformationMessage(
                l10n.t("No ACR resources found in resource group {0}.", fleetContext.resourceGroupName),
            );
            return;
        }

        const selection = await vscode.window.showQuickPick(items, {
            title: l10n.t("ACRs in Fleet hub resource group"),
            placeHolder: l10n.t("Select an ACR to copy login server"),
            ignoreFocusOut: true,
        });

        if (!selection?.loginServer) {
            return;
        }

        await vscode.env.clipboard.writeText(selection.loginServer);
        vscode.window.showInformationMessage(l10n.t("Copied ACR login server: {0}", selection.loginServer));
    });
}
