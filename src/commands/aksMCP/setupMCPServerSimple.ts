import * as vscode from 'vscode';
import { getMCPServerContainerKitBinaryPath } from '../utils/helper/mcpServerDownloadHelper';
import { failed } from '../utils/errorable';

export async function addMcpServerToUserSettings(): Promise<void> {
  const config = vscode.workspace.getConfiguration();

  const newServerConfig = {
    command: "/Users/tatsatmishra/one/aks/mcp-kubernetes/bin/mcp-server",
    args: ["--transport", "stdio"]
  };

  // Read current "mcp.servers" or initialize it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = config.get<{ [key: string]: any }>('mcp.servers') || {};

  // Add or overwrite the server entry
  current["AKS MCP k8s demo"] = newServerConfig;
  
  // This extension controls the version of mcp-server used, so that:
  // 1. We don't need to rely on the user having previously downloaded it, and
  // 2. This workflow doesn't get broken by mcp-server behaviour changes between versions
  const mcpServerPath = await getMCPServerContainerKitBinaryPath();
  if (failed(mcpServerPath)) {
    vscode.window.showErrorMessage(`Failed to download MCP server: ${mcpServerPath.error}`);
    return;
  }

  // Save it back to user settings.json
  await config.update(
    'mcp.servers',
    current,
    vscode.ConfigurationTarget.Global // Use Global to persist in user settings.json
  );

  vscode.window.showInformationMessage('MCP server "MCP k8s demo" added to settings.');
}
