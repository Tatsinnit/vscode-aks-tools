import { TokenCredential } from "@azure/core-auth";
import { combine, Errorable, failed, getErrorMessage } from "./errorable";
import { ClientSecretCredential } from "@azure/identity";
import "cross-fetch/polyfill"; // Needed by the graph client: https://github.com/microsoftgraph/msgraph-sdk-javascript/blob/dev/README.md#via-npm
import { Client as GraphClient } from "@microsoft/microsoft-graph-client";
import {
    TokenCredentialAuthenticationProvider,
    TokenCredentialAuthenticationProviderOptions,
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import { AuthorizationManagementClient } from "@azure/arm-authorization";
import { RoleAssignment } from "@azure/arm-authorization";
import { getDefaultScope, getEnvironment } from "../../auth/azureAuth";
import { DefinedSubscription, getSubscriptions, SelectionType } from "./subscriptions";
import { ReadyAzureSessionProvider } from "../../auth/types";

export interface ServicePrincipalAccess {
    readonly cloudName: string;
    readonly tenantId: string;
    readonly subscriptions: {
        readonly id: string;
        readonly name: string;
    }[];
}

interface SubscriptionAccessResult {
    readonly subscription: DefinedSubscription;
    readonly hasRoleAssignment: boolean;
}

interface ServicePrincipalInfo {
    readonly id: string;
    readonly displayName: string;
    readonly credential: TokenCredential;
    readonly tenantId: string;
}

export async function getServicePrincipalAccess(
    sessionProvider: ReadyAzureSessionProvider,
    appId: string,
    secret: string,
): Promise<Errorable<ServicePrincipalAccess>> {
    const cloudName = getEnvironment().name;
    const filteredSubscriptions = await getSubscriptions(sessionProvider, SelectionType.Filtered);
    if (failed(filteredSubscriptions)) {
        return filteredSubscriptions;
    }

    const session = await sessionProvider.getAuthSession();
    if (failed(session)) {
        return session;
    }

    const spInfo = await getServicePrincipalInfo(session.result.tenantId, appId, secret);
    if (failed(spInfo)) {
        return spInfo;
    }

    const promiseResults = await Promise.all(
        filteredSubscriptions.result.map((s) => getSubscriptionAccess(spInfo.result.credential, s, spInfo.result)),
    );

    const ownershipResults = combine(promiseResults);
    if (failed(ownershipResults)) {
        return ownershipResults;
    }

    const subscriptions = ownershipResults.result
        .filter((r) => r.hasRoleAssignment)
        .map((r) => ({
            id: r.subscription.subscriptionId,
            name: r.subscription.displayName,
        }));

    return { succeeded: true, result: { cloudName, tenantId: spInfo.result.tenantId, subscriptions } };
}

type ServicePrincipalSearchResult = {
    value?: {
        id: string;
        displayName: string;
    }[];
};

async function getServicePrincipalInfo(
    tenantId: string,
    appId: string,
    appSecret: string,
): Promise<Errorable<ServicePrincipalInfo>> {
    // Use the MS Graph API to retrieve the object ID and display name of the service principal,
    // using its own password as the credential.
    const baseUrl = getMicrosoftGraphClientBaseUrl();
    const graphClientOptions: TokenCredentialAuthenticationProviderOptions = {
        scopes: [getDefaultScope(baseUrl)],
    };

    const credential = new ClientSecretCredential(tenantId, appId, appSecret);

    const graphClient = GraphClient.initWithMiddleware({
        baseUrl,
        authProvider: new TokenCredentialAuthenticationProvider(credential, graphClientOptions),
    });

    let spSearchResults: ServicePrincipalSearchResult;
    try {
        spSearchResults = await graphClient
            .api("/servicePrincipals")
            .filter(`appId eq '${appId}'`)
            .select(["id", "displayName"])
            .get();
    } catch (e) {
        return { succeeded: false, error: `Failed to retrieve service principal: ${getErrorMessage(e)}` };
    }

    if (!spSearchResults.value || spSearchResults.value.length !== 1) {
        return {
            succeeded: false,
            error: `Expected service principal search result to contain value with one item. Actual result: ${JSON.stringify(
                spSearchResults,
            )}`,
        };
    }

    const searchResult = spSearchResults.value[0];
    const spInfo = {
        id: searchResult.id,
        displayName: searchResult.displayName,
        credential,
        tenantId,
    };

    return { succeeded: true, result: spInfo };
}

function getMicrosoftGraphClientBaseUrl(): string {
    const environment = getEnvironment();
    // Environments are from here: https://github.com/Azure/ms-rest-azure-env/blob/6fa17ce7f36741af6ce64461735e6c7c0125f0ed/lib/azureEnvironment.ts#L266-L346
    // They do not contain the MS Graph endpoints, whose values are here:
    // https://github.com/microsoftgraph/msgraph-sdk-javascript/blob/d365ab1d68f90f2c38c67a5a7c7fe54acfc2584e/src/Constants.ts#L28
    switch (environment.name) {
        case "AzureChinaCloud":
            return "https://microsoftgraph.chinacloudapi.cn";
        case "AzureUSGovernment":
            return "https://graph.microsoft.us";
        case "AzureGermanCloud":
            return "https://graph.microsoft.de";
    }

    return "https://graph.microsoft.com";
}

async function getSubscriptionAccess(
    credential: TokenCredential,
    subscription: DefinedSubscription,
    spInfo: ServicePrincipalInfo,
): Promise<Errorable<SubscriptionAccessResult>> {
    if (!subscription.subscriptionId) {
        return { succeeded: true, result: { subscription, hasRoleAssignment: false } };
    }

    const client = new AuthorizationManagementClient(credential, subscription.subscriptionId);
    const roleAssignments: RoleAssignment[] = [];
    try {
        const iterator = client.roleAssignments.listForSubscription({ filter: `principalId eq '${spInfo.id}'` });
        for await (const pageRoleAssignments of iterator.byPage()) {
            roleAssignments.push(...pageRoleAssignments);
        }
    } catch (e) {
        if (isUnauthorizedError(e)) {
            return { succeeded: true, result: { subscription, hasRoleAssignment: false } };
        }

        return { succeeded: false, error: getErrorMessage(e) };
    }

    // The service principal needs *some* permissions in the subscription, but Contributor is not
    // necessarily required. See: https://azure.github.io/azure-service-operator/#installation
    return { succeeded: true, result: { subscription, hasRoleAssignment: roleAssignments.length > 0 } };
}

function isUnauthorizedError(e: unknown): boolean {
    return (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        "statusCode" in e &&
        e.code === "AuthorizationFailed" &&
        e.statusCode === 403
    );
}
