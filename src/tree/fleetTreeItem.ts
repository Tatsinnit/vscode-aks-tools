import { AzExtParentTreeItem, AzExtTreeItem } from "@microsoft/vscode-azext-utils";
import { assetUri } from "../assets";
import { DefinedFleetMemberWithGroup, DefinedResourceWithGroup } from "../commands/utils/azureResources";
import { SubscriptionTreeNode } from "./subscriptionTreeItem";
import { createClusterTreeNode } from "./aksClusterTreeItem";
import { parseResource } from "../azure-api-utils";
import { filterClusters } from "../commands/utils/config";

// The de facto API of tree nodes that represent individual AKS clusters.
// Tree items should implement this interface to maintain backward compatibility with previous versions of the extension.
export interface FleetTreeNode {
    readonly nodeType: "fleet";
    readonly resourceType: string;
    readonly armId: string;
    readonly name: string;
    readonly subscriptionTreeNode: SubscriptionTreeNode;
    readonly subscriptionId: string;
    readonly resourceGroupName: string;
    readonly fleetResource: DefinedResourceWithGroup;
    addMember(members: DefinedResourceWithGroup[]): void;
}

export function createFleetTreeNode(
    parent: AzExtParentTreeItem & SubscriptionTreeNode,
    subscriptionId: string,
    fleetResource: DefinedResourceWithGroup,
): FleetTreeItem {
    return new FleetTreeItem(parent, subscriptionId, fleetResource);
}

class FleetTreeItem extends AzExtParentTreeItem implements FleetTreeNode {
    public readonly subscriptionTreeNode: SubscriptionTreeNode;
    public readonly armId: string;
    public readonly resourceGroupName: string;
    public readonly name: string;

    constructor(
        parent: AzExtParentTreeItem & SubscriptionTreeNode,
        readonly subscriptionId: string,
        readonly fleetResource: DefinedResourceWithGroup,
    ) {
        super(parent);

        this.iconPath = assetUri("resources/fleet-tree-icon.png");
        this.subscriptionTreeNode = parent;
        this.id = `${this.fleetResource.name} ${fleetResource.resourceGroup}`;
        this.armId = this.fleetResource.id;
        this.resourceGroupName = fleetResource.resourceGroup;
        this.name = this.fleetResource.name;
    }

    public readonly contextValue: string = `fleet.hub`;

    public get label(): string {
        return this.name;
    }

    public get resourceType(): string {
        return "Microsoft.ContainerService/fleets";
    }

    public get clusterTreeItem(): AzExtTreeItem {
        return this;
    }

    public readonly nodeType = "fleet";

    private readonly members: Map<string, DefinedFleetMemberWithGroup> = new Map<string, DefinedFleetMemberWithGroup>();

    public addMember(members: DefinedFleetMemberWithGroup[]): void {
        members.forEach((m) => {
            this.members.set(m.id, m);
        });
    }

    public loadMoreChildrenImpl(): Promise<AzExtTreeItem[]> {
        const drgs: DefinedResourceWithGroup[] = [];
        this.members.forEach((m) => {
            const parsedResourceId = parseResource(m.clusterResourceId);
            const drg: DefinedResourceWithGroup = {
                // the cluster resource parsed from the member resource
                id: m.clusterResourceId,
                name: parsedResourceId.name!,
                resourceGroup: parsedResourceId.resourceGroupName!,
            };
            drgs.push(drg);
        });
        const treeNodes = filterClusters(drgs).map((drg) => createClusterTreeNode(this, drg));
        return Promise.resolve(treeNodes);
    }
    public hasMoreChildrenImpl(): boolean {
        return false; // we pre-load the clusters in the TreeItem. no need to load more.
    }
}
