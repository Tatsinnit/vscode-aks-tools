import { IActionContext } from "@microsoft/vscode-azext-utils";
import { aksKubectlCommands } from '../utils/kubectl';

export async function aksKubectlGetPodsCommands(
  _context: IActionContext,
  target: any
): Promise<void> {
  const command = `get pods --all-namespaces`;
  await aksKubectlCommands(_context, target, command);
}

export async function aksKubectlGetClusterInfoCommands(
  _context: IActionContext,
  target: any
): Promise<void> {
  const command = `cluster-info`;
  await aksKubectlCommands(_context, target, command);
}

export async function aksKubectlGetAPIResourcesCommands(
  _context: IActionContext,
  target: any
): Promise<void> {
  const command = `api-resources`;
  await aksKubectlCommands(_context, target, command);
}

export async function aksKubectlGetNodeCommands(
  _context: IActionContext,
  target: any
): Promise<void> {
  const command = `get node`;
  await aksKubectlCommands(_context, target, command);
}

export async function aksKubectlDescribeServicesCommands(
  _context: IActionContext,
  target: any
): Promise<void> {
  const command = `describe services`;
  await aksKubectlCommands(_context, target, command);
}
