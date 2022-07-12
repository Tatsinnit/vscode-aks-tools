import { API, CloudExplorerV1 } from 'vscode-kubernetes-tools-api';
import AksClusterTreeItem from "../../tree/aksClusterTreeItem";
import { parseResource } from "../../azure-api-utils";
import * as azcs from '@azure/arm-containerservice';
import { Errorable } from './errorable';
import { ResourceManagementClient } from '@azure/arm-resources';
import { SubscriptionTreeNode } from '../../tree/subscriptionTreeItem';

export interface ClusterARMResponse {
    readonly id: string;
    readonly name: string;
    readonly location: string;
    readonly resourceGroup?: string;
    readonly properties: any;
    readonly type: string;
}

export function getAksClusterTreeItem(commandTarget: any, cloudExplorer: API<CloudExplorerV1>): Errorable<AksClusterTreeItem> {
    if (!cloudExplorer.available) {
        return { succeeded: false, error: 'Cloud explorer is unavailable.'};
    }

    const cloudTarget = cloudExplorer.api.resolveCommandTarget(commandTarget) as CloudExplorerV1.CloudExplorerResourceNode;

    const isClusterTarget = cloudTarget !== undefined &&
        cloudTarget.cloudName === "Azure" &&
        cloudTarget.cloudResource.nodeType === "cluster";

    if (!isClusterTarget) {
        return { succeeded: false, error: 'This command only applies to AKS clusters.'};
    }

    const cluster = cloudTarget.cloudResource as AksClusterTreeItem;
    if (cluster === undefined) {
        return { succeeded: false, error: 'Cloud target cluster resource is not of type AksClusterTreeItem.'};
    }

    return { succeeded: true, result: cluster };
}

export function getAksClusterSubscriptionItem(commandTarget: any, cloudExplorer: API<CloudExplorerV1>): Errorable<SubscriptionTreeNode> {
    if (!cloudExplorer.available) {
        return { succeeded: false, error: 'Cloud explorer is unavailable.'};
    }

    const cloudTarget = cloudExplorer.api.resolveCommandTarget(commandTarget) as CloudExplorerV1.CloudExplorerResourceNode;

    const isAKSSubscriptionTarget = cloudTarget !== undefined &&
        cloudTarget.cloudName === "Azure" &&
        cloudTarget.cloudResource.nodeType === "subscription";

    if (!isAKSSubscriptionTarget) {
        return { succeeded: false, error: 'This command only applies to AKS subscription.'};
    }

    const cloudResource = cloudTarget.cloudResource as SubscriptionTreeNode;
    if (cloudResource === undefined) {
        return { succeeded: false, error: 'Cloud target cluster resource is not of type AksClusterSubscriptionItem.'};
    }

    return { succeeded: true, result: cloudResource };
}

export async function getKubeconfigYaml(target: AksClusterTreeItem): Promise<Errorable<string>> {
    const { resourceGroupName, name } = parseResource(target.id!);
    if (!resourceGroupName || !name) {
        return { succeeded: false, error: `Invalid ARM id ${target.id}`};
    }
    // Please read: This TokenCredential type conversion is in need from AzExtServiceClientCredentials to be consumed by code at runtime.
    // If we use the DefaultAzureCredential() mentioned here https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/containerservice/arm-containerservice
    // we have a hard dependency on the user identity by az-cli login which we dont want.
    // Longterm fix: carefully redo the vscode-azureextensionui which is now deprecated and possibly that will bring the right type.
    const client = new azcs.ContainerServiceClient(target.subscription.credentials, target.subscription.subscriptionId);

    let clusterUserCredentials: any;

    try {
        clusterUserCredentials = await client.managedClusters.listClusterUserCredentials(resourceGroupName, name);
    } catch (e) {
        return { succeeded: false, error: `Failed to retrieve user credentials for cluster ${name}: ${e}`};
    }

    const kubeconfigCredResult = clusterUserCredentials.kubeconfigs!.find((kubeInfo: { name: string; }) => kubeInfo.name === "clusterUser");
    if (kubeconfigCredResult === undefined) {
        return { succeeded: false, error: `No "clusterUser" kubeconfig found for cluster ${name}.`};
    }

    const kubeconfig = kubeconfigCredResult.value?.toString();
    if (kubeconfig === undefined) {
        return { succeeded: false, error: `Empty kubeconfig for cluster ${name}.` };
    }

    return { succeeded: true, result: kubeconfig };
}

export async function getClusterProperties(
    target: AksClusterTreeItem,
    clusterName: string
): Promise<Errorable<ClusterARMResponse>> {
    try {
        const client = new ResourceManagementClient(target.subscription.credentials, target.subscription.subscriptionId, { noRetryPolicy: true });
        const clusterInfo = await client.resources.get(target.resourceGroupName, target.resourceType, "", "", clusterName, "2022-02-01");

        return { succeeded: true, result: <ClusterARMResponse>clusterInfo };
    } catch (ex) {
        return { succeeded: false, error: `Error invoking ${clusterName} managed cluster: ${ex}` };
    }
}

export async function startCluster(
    target: AksClusterTreeItem,
    clusterName: string
): Promise<Errorable<ClusterARMResponse>> {
    try {
        const resourceGroupName = target.armId.split("/")[4];
        // Please read: This TokenCredential type conversion is in need from AzExtServiceClientCredentials to be consumed by code at runtime.
        // If we use the DefaultAzureCredential() mentioned here https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/containerservice/arm-containerservice
        // we have a hard dependency on the user identity by az-cli login which we dont want.
        // Longterm fix: carefully redo the vscode-azureextensionui which is now deprecated and possibly that will bring the right type.
        const containerClient = new azcs.ContainerServiceClient(target.subscription.credentials, target.subscription.subscriptionId);
        const clusterInfo = (await containerClient.managedClusters.get(resourceGroupName, clusterName));

        if ( clusterInfo.provisioningState !== "Stopping"
                && clusterInfo.agentPoolProfiles?.every((nodePool) => nodePool.powerState?.code === "Stopped") ) {
            containerClient.managedClusters.beginStartAndWait(resourceGroupName, clusterName, undefined);
        } else if ( clusterInfo.provisioningState === "Stopping") {
            return { succeeded: false, error: `Cluster ${clusterName} is in Stopping state wait until cluster is fully stopped.` };
        } else {
            return { succeeded: false, error: `Cluster ${clusterName} is already Started.` };
        }

        return { succeeded: true, result: <ClusterARMResponse><unknown>"" };
    } catch (ex) {
        return { succeeded: false, error: `Error invoking ${clusterName} managed cluster: ${ex}` };
    }
}

export async function stopCluster(
    target: AksClusterTreeItem,
    clusterName: string
): Promise<Errorable<ClusterARMResponse>> {
    try {
        const resourceGroupName = target.armId.split("/")[4];
        // Please read: This TokenCredential type conversion is in need from AzExtServiceClientCredentials to be consumed by code at runtime.
        // If we use the DefaultAzureCredential() mentioned here https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/containerservice/arm-containerservice
        // we have a hard dependency on the user identity by az-cli login which we dont want.
        // Longterm fix: carefully redo the vscode-azureextensionui which is now deprecated and possibly that will bring the right type.
        const containerClient = new azcs.ContainerServiceClient(target.subscription.credentials, target.subscription.subscriptionId);
        const clusterInfo = (await containerClient.managedClusters.get(resourceGroupName, clusterName));

        if ( clusterInfo.provisioningState !== "Stopping" && clusterInfo.provisioningState === "Succeeded"
                && clusterInfo.agentPoolProfiles?.every((nodePool) => nodePool.powerState?.code === "Running") ) {
            containerClient.managedClusters.beginStopAndWait(resourceGroupName, clusterName, undefined);
        }  else {
            return { succeeded: false, error: `Cluster ${clusterName} is either Stopped or in Stopping state.` };
        }

        return { succeeded: true, result: <ClusterARMResponse><unknown>"" };
    } catch (ex) {
        return { succeeded: false, error: `Error invoking ${clusterName} managed cluster: ${ex}` };
    }
}