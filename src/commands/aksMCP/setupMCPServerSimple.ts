import * as vscode from 'vscode';

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
  current["MCP k8s demo"] = newServerConfig;

  // Save it back to user settings.json
  await config.update(
    'mcp.servers',
    current,
    vscode.ConfigurationTarget.Global // Use Global to persist in user settings.json
  );

  vscode.window.showInformationMessage('MCP server "MCP k8s demo" added to settings.');
}
