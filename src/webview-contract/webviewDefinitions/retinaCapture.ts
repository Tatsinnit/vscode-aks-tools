import { WebviewDefinition } from "../webviewTypes";

export interface InitialState {
    selectedNode: string;
    clusterName: string;
    retinaOutput: string[];
    allNodes: string[];
    captureFolderName: string;
    isNodeExplorerPodExists: boolean;
    isDownloaded?: boolean;
    // analysisResults?: string;
}

export type ToVsCodeMsgDef = {
    deleteRetinaNodeExplorer: string;
    handleCaptureFileDownload: string;
    analyzeLogs: void;
};

export type ToWebViewMsgDef = Record<string, never>;

export type RetinaCaptureDefinition = WebviewDefinition<InitialState, ToVsCodeMsgDef, ToWebViewMsgDef>;
