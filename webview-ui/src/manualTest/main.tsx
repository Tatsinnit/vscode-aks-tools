import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./vars.css";
import "../main.css";
import "@vscode/codicons/dist/codicon.css";
import { TestScenarioSelector } from "./TestScenarioSelector/TestScenarioSelector";
import { getTestStyleViewerScenarios } from "./testStyleViewerTests";
import { getCreateClusterScenarios } from "./createClusterTests";
import { getPeriscopeScenarios } from "./periscopeTests";
import { getDetectorScenarios } from "./detectorTests";
import { getDraftDeploymentScenarios, getDraftDockerfileScenarios, getDraftWorkflowScenarios } from "./draft";
import { getAttachAcrToClusterScenarios } from "./attachAcrToClusterTests";
import { getInspektorGadgetScenarios } from "./inspektorGadgetTests";
import { getKubectlScenarios } from "./kubectlTests";
import { ContentId } from "../../../src/webview-contract/webviewTypes";
import { Scenario } from "../utilities/manualTest";
import { getASOScenarios } from "./asoTests";
import { getClusterPropertiesScenarios } from "./clusterPropertiesTests";
import { getTCPDumpScenarios } from "./tcpDumpTests";
import { getRetinaCaptureScenarios } from "./retinaCaptureTests";

// There are two modes of launching this application:
// 1. Via the VS Code extension inside a Webview.
// 2. In a browser using a local web server.
//
// This entrypoint is for the browser:
// - Content selection: the browser will display a list of manual test scenarios for the user to choose from.
// - Initial state: the browser will use test data provided by each of the components.
// - Message passing: the browser will use a test subscriber that intercepts messages from React components and responds by
//   dispatching `message` events to the `window` object so that application components can listen to them in the same way.

const rootElem = document.getElementById("root");
const root = createRoot(rootElem!);

const contentTestScenarios: Record<ContentId, Scenario[]> = {
    style: getTestStyleViewerScenarios(),
    clusterProperties: getClusterPropertiesScenarios(),
    attachAcrToCluster: getAttachAcrToClusterScenarios(),
    createCluster: getCreateClusterScenarios(),
    periscope: getPeriscopeScenarios(),
    detector: getDetectorScenarios(),
    draftDeployment: getDraftDeploymentScenarios(),
    draftDockerfile: getDraftDockerfileScenarios(),
    draftWorkflow: getDraftWorkflowScenarios(),
    gadget: getInspektorGadgetScenarios(),
    kubectl: getKubectlScenarios(),
    aso: getASOScenarios(),
    tcpDump: getTCPDumpScenarios(),
    retinaCapture: getRetinaCaptureScenarios(),
};

const testScenarios = Object.values(contentTestScenarios).flatMap((s) => s);

root.render(
    <StrictMode>
        <TestScenarioSelector scenarios={testScenarios} />
    </StrictMode>,
);
