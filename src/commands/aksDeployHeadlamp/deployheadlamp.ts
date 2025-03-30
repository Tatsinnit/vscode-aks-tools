import * as vscode from "vscode";
import * as k8s from "vscode-kubernetes-tools-api";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { getAksClusterTreeNode } from "../utils/clusters";
import { failed } from "../utils/errorable";
// import { longRunning } from "../utils/host";
import open from 'open';
import { getReadySessionProvider } from "../../auth/azureAuth";
import { findAvailablePort } from "../utils/porthelper";

export default async function deployHeadlamp(_context: IActionContext, target: unknown): Promise<void> {
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;

    const sessionProvider = await getReadySessionProvider();
    if (failed(sessionProvider)) {
        vscode.window.showErrorMessage(sessionProvider.error);
        return;
    }

    const clusterNode = getAksClusterTreeNode(target, cloudExplorer);
    if (failed(clusterNode)) {
        vscode.window.showErrorMessage(clusterNode.error);
        return;
    }

    const clusterName = clusterNode.result.name;
    const answer = await vscode.window.showInformationMessage(
        `Do you open lcoally ${clusterName}?`,
        "Yes",
        "No",
    );
    if (answer === "Yes") {
        await openLocalhost();
    }
}

async function openLocalhost() {
    // Replace with your desired localhost URL
    const startingPort = 8080; // Starting port to check for availability
    // Check if the port is available
    // If not, find the next available port
    const availablePort = await findAvailablePort(startingPort);
    console.log(`First available port is: ${availablePort}`);
    const url = `http://localhost:${availablePort}/c/main`; 
    
    try {
      // Open the URL in the default browser
      await open(url);
      console.log(`Successfully opened ${url}`);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  }