import { IActionContext } from "@microsoft/vscode-azext-utils";
import { aksKubectlCommands } from "../utils/kubectl";
import * as vscode from 'vscode';
import path = require("path");
import { getExtensionPath } from "../utils/host";
import { failed } from "../utils/errorable";
import * as fs from 'fs';
const tmp = require('tmp');

export async function aksKubectlApplyCanIPullCommands(
    _context: IActionContext,
    target: any
): Promise<void> {
    const extensionPath = getExtensionPath();
    if (failed(extensionPath)) {
        vscode.window.showErrorMessage(extensionPath.error);
        return;
    }

    const yamlPathOnDisk = vscode.Uri.file(path.join(extensionPath.result, 'resources', 'yaml', 'canipull.yaml'));
    const canipullyaml = fs.readFileSync(yamlPathOnDisk.fsPath, 'utf8');
    const templateYaml = tmp.fileSync({ prefix: "canipullacr", postfix: `.yaml` });
    fs.writeFileSync(templateYaml.name, canipullyaml);

    const commandtogetcanipullpod = `apply -f ${templateYaml.name} && kubectl logs pod/canipull`;
    await aksKubectlCommands(_context, target, commandtogetcanipullpod);
}
