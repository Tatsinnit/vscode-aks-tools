import * as vscode from 'vscode';
import * as os from 'os';
import * as k8s from 'vscode-kubernetes-tools-api';
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { getExtensionPath, longRunning } from '../utils/host';
import { failed } from '../utils/errorable';
import { getKubectlAIBinaryPath } from '../utils/helper/kubectlAIDownload';
import * as tmpfile from '../utils/tempfile';
import path = require('path');
import { invokeKubectlCommandWithoutKubeConfig } from '../utils/kubectl';
import { ensureDirectoryInPath } from '../utils/env';

var shelljs = require('shelljs');
const YamlValidator = require('yaml-validator');

enum Command {
    KubectlAICommand,
    UpdateResourceKubectlAICommand
}

export async function aksKubectlAIDeploy(
    _context: IActionContext,
    target: any
): Promise<void> {
    await checkTargetAndRunKubectlAICommand(target, Command.KubectlAICommand)
} 

export async function aksUpdateKubectlAIResource(
    _context: IActionContext,
    target: any
): Promise<void> {
    await checkTargetAndRunKubectlAICommand(target, Command.UpdateResourceKubectlAICommand)
}

async function checkTargetAndRunKubectlAICommand(
    target: any,
    cmd: Command
): Promise<void> {
    const kubectl = await k8s.extension.kubectl.v1;
    const cloudExplorer = await k8s.extension.cloudExplorer.v1;
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;

    if (!kubectl.available) {
        vscode.window.showWarningMessage(`Kubectl is unavailable.`);
        return undefined;
    }

    if (!cloudExplorer.available) {
        vscode.window.showWarningMessage(`Cloud explorer is unavailable.`);
        return undefined;
    }

    if (!clusterExplorer.available) {
        vscode.window.showWarningMessage(`Cluster explorer is unavailable.`);
        return undefined;
    }

    await runKubectlAICommand(cmd, kubectl);
}

async function runKubectlAICommand(
    cmd: Command,
    kubectl: k8s.APIAvailable<k8s.KubectlV1>
): Promise<void> {

    switch (cmd) {
        case Command.KubectlAICommand:
            await execKubectlAICommand(kubectl);
            return;
        case Command.UpdateResourceKubectlAICommand:
            await execKubectlAICommand(kubectl, true);;
            return;
    }
}

async function execKubectlAICommand(
    kubectl: k8s.APIAvailable<k8s.KubectlV1>,
    isUpdate: boolean = false) {

    // Identify the env var: OPENAI_API_KEY exist if not get input for ai key
    console.log(process.env.OPENAI_API_KEY);
    let openAIKey = process.env.OPENAI_API_KEY ?? process.env.VSCODE_OPEN_AI_AKS_POC;

    if (openAIKey == undefined && (process.env.VSCODE_OPEN_AI_AKS_POC === '' || process.env.VSCODE_OPEN_AI_AKS_POC == undefined)) {
        const aiKey = await vscode.window.showInputBox({
            placeHolder: `Please supply a valid Open AI or Azure OpenAI Key"`
        });

        if (aiKey == undefined) {
            return;
        }
        process.env.VSCODE_OPEN_AI_AKS_POC = aiKey;
        openAIKey = aiKey || process.env.VSCODE_OPEN_AI_AKS_POC;
    }

    const command = await vscode.window.showInputBox({
        placeHolder: `Create an nginx deployment with 3 replicas Or Update existing nginx deployment with 3 replicas`,
        prompt: `Describe the manifest you wish to create or update with an existing manifest.`
    });

    if (command == undefined) {
        vscode.window.showErrorMessage('A command for kubectl ai is mandatory to execute this action');
        return;
    }

    return await runKubectlAIGadgetCommands(openAIKey!, command, isUpdate, kubectl);
}

async function runKubectlAIGadgetCommands(
    aiKey: string,
    command: string,
    rePromptMode: boolean,
    kubectl: k8s.APIAvailable<k8s.KubectlV1>) {

    const kubectlAIPath = await getKubectlAIBinaryPath();

    if (failed(kubectlAIPath)) {
        vscode.window.showWarningMessage(`kubectl-ai path was not found ${kubectlAIPath.error}`);
        return;
    }

    const extensionPath = getExtensionPath();

    await longRunning(`Running kubectl ai command`,
        async () => {
            let commandToRun = `ai --openai-api-key "${aiKey}" "${command}" --raw`;

            const binaryPathDir = path.dirname(kubectlAIPath.result);

            ensureDirectoryInPath(binaryPathDir)

            if (rePromptMode) {
                const data = vscode.window.activeTextEditor?.document;
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const fileName = activeEditor.document.fileName;

                    if (!(fileName.endsWith(".yaml") || fileName.endsWith(".yml"))
                            && !fileName.startsWith("Untitled-")
                            && data?.getText() === undefined
                            && data?.getText() === "") {
                        vscode.window.showErrorMessage('Invalid file extension or content please make sure you are in a yaml manifest file');
                        return
                    }

                    const tmpFile = await tmpfile.createTempFile(data?.getText()!, "YAML");
                    validateYaml(tmpFile.filePath);
                    try {
                        const isWindows = os.platform().toLocaleLowerCase() === "win32";
                        const catCommand = isWindows ? "type" : "cat";
                        commandToRun = `${catCommand} ${tmpFile.filePath} | kubectl ai --openai-api-key "${aiKey}" "${command}" --raw`
                        shelljs.exec(commandToRun, function (code: any, stdout: any, stderr: any) {
                            if (stderr && code !== 0) {
                                vscode.window.showErrorMessage(`There is an error with reprompt kubectl-ai command: ${stderr}`);
                                return;
                            }
                            vscode.workspace.openTextDocument({
                                content: stdout,
                                language: "yaml"
                            }).then(newDocument => {
                                vscode.window.showTextDocument(newDocument);
                            });
                        });
                    } finally {
                        tmpFile.dispose();
                    }
                } else {
                    vscode.window.showErrorMessage('There is no active editor or file for kubectl-ai reprompt to work');
                }

                return;
            }

            const kubectlresult =  await invokeKubectlCommandWithoutKubeConfig(kubectl, commandToRun);

            if (failed(kubectlresult)) {
                vscode.window.showWarningMessage(`kubectl-ai command failed with following error: ${kubectlresult.error}`);
                return;
            }

            // Open data in editor.
            vscode.workspace.openTextDocument({
                content: kubectlresult.result.stdout,
                language: "yaml"
            }).then(newDocument => {
                vscode.window.showTextDocument(newDocument);
            });
        }
    );

    if (failed(extensionPath)) {
        vscode.window.showErrorMessage(extensionPath.error);
        return;
    }
}

function validateYaml(filePath: string) {
    // Default options
    const options = {
        log: false,
        structure: false,
        onWarning: null,
        writeJson: false
    };
    const validator = new YamlValidator(options);
    validator.validate([filePath]);
    const validResult = validator.report();
    console.log(validResult)
}
