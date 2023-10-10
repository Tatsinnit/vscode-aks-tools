import { Uri } from "vscode";
import * as k8s from 'vscode-kubernetes-tools-api';
import { failed } from "../commands/utils/errorable";
import { MessageHandler, MessageSink } from "../webview-contract/messaging";
import { BasePanel, PanelDataProvider } from "./BasePanel";
import { invokeKubectlCommand } from "../commands/utils/kubectl";
import { InitialState, TCPPresetCommand, ToVsCodeMsgDef, ToWebViewMsgDef } from "../webview-contract/webviewDefinitions/tcpDump";
import { addKubectlCustomCommand, deleteKubectlCustomCommand } from "../commands/utils/config";

export class TCPDataCollection extends BasePanel<"tcpDump"> {
    constructor(extensionUri: Uri) {
        super(extensionUri, "tcpDump");
    }
}

export class TCPDataCollectionDataProvider implements PanelDataProvider<"tcpDump"> {
    constructor(
        readonly kubectl: k8s.APIAvailable<k8s.KubectlV1>,
        readonly kubeConfigFilePath: string,
        readonly clusterName: string,
        readonly customCommands: TCPPresetCommand[]
    ) { }

    getTitle(): string {
        return `TCP Data Collection ${this.clusterName} for Linux Node`;
    }

    getInitialState(): InitialState {
        return {
            clusterName: this.clusterName,
            customCommands: this.customCommands
        };
    }

    getMessageHandler(webview: MessageSink<ToWebViewMsgDef>): MessageHandler<ToVsCodeMsgDef> {
        return {
            runCommandRequest: args => this._handleRunCommandRequest(args.command, webview),
            addCustomCommandRequest: args => this._handleAddCustomCommandRequest(args.name, args.command),
            deleteCustomCommandRequest: args => this._handleDeleteCustomCommandRequest(args.name)
        };
    }

    private async _handleRunCommandRequest(command: string, webview: MessageSink<ToWebViewMsgDef>) {
        const kubectlresult = await invokeKubectlCommand(this.kubectl, this.kubeConfigFilePath, command);

        if (failed(kubectlresult)) {
            await this._sendResponse(webview, command, null, kubectlresult.error);
            return;
        }

        // Sometimes there can be an error output even though the command returns a success status code.
        // This can happen when specifying an invalid namespace, for example.
        // For this reason we return stderr as well as stdout here.
        await this._sendResponse(webview, command, kubectlresult.result.stdout, kubectlresult.result.stderr);
    }

    private async _sendResponse(
        webview: MessageSink<ToWebViewMsgDef>,
        command: string,
        output: string | null,
        errorMessage: string | null
    ) {
        webview.postMessage({
            command: "runCommandResponse", parameters: {
                output,
                errorMessage
            }
        });
    }

    private async _handleAddCustomCommandRequest(name: string, command: string) {
        await addKubectlCustomCommand(name, command);
    }

    private async _handleDeleteCustomCommandRequest(name: string) {
        await deleteKubectlCustomCommand(name);
    }
}