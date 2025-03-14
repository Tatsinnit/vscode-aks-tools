import { InitialState } from "../../../src/webview-contract/webviewDefinitions/retinaCapture";
import { WebviewStateUpdater } from "../utilities/state";
import { getWebviewMessageContext } from "../utilities/vscode";

export type EventDef = {
    setDownloadCompleted: boolean;
    // setAnalysisResults: string;
};

export type RetinaState = InitialState;

export const stateUpdater: WebviewStateUpdater<"retinaCapture", EventDef, RetinaState> = {
    createState: (initialState) => ({
        ...initialState,
        // analysisResults: undefined,
    }),
    vscodeMessageHandler: {
        // setAnalysisResults: (state, args) => ({
        //     ...state,
        //     analysisResults: args.results,
        // }),
    },
    eventHandler: {
        // setAnalysisResults: (state, results) => ({
        //     ...state,
        //     analysisResults: results,
        // }),
        setDownloadCompleted: (state, isDownloaded) => ({
            ...state,
            isDownloaded
        }),
    },
};

export const vscode = getWebviewMessageContext<"retinaCapture">({
    deleteRetinaNodeExplorer: undefined,
    handleCaptureFileDownload: undefined,
    analyzeLogs: undefined,
});
