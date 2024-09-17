import { VSCodeButton, VSCodeProgressRing, VSCodeDivider } from "@vscode/webview-ui-toolkit/react";
import { InitialState, ProgressEventType } from "../../../src/webview-contract/webviewDefinitions/kaito";
import { useStateManagement } from "../utilities/state";
import styles from "./Kaito.module.css";
import kaitoimage from "./kaitoimage.png";

// import { KaitoModels } from "./KaitoModels";
import { stateUpdater, vscode } from "./state";
export function Kaito(initialState: InitialState) {
    const { state } = useStateManagement(stateUpdater, initialState, vscode);

    function onClickKaitoInstall() {
        vscode.postInstallKaitoRequest();
    }

    // function onClickGenerateWorkspace() {
    //     vscode.postGenerateWorkspaceRequest();
    // }

    return (
        <>
            <div className={styles.container}>
                {/* <div className={styles.kaitoPageHeader}>Kubernetes AI Toolchain Operator (KAITO)</div> */}
                <h2>Kubernetes AI Toolchain Operator (KAITO)</h2>
                <VSCodeDivider />
                <div className={styles.subHeader}>
                    Using KAITO, the workflow of onboarding and deploying large AI inference models on your cluster is
                    largely simplified. KAITO manages large model files using container images and hosts them in the
                    public Microsoft Container Registry (MCR) if the license allows.
                </div>
                <h4 className={styles.subHeaderForVersion}>Version: v1.0</h4>
                <h3 className={styles.architecture}>Architecture</h3>
                <div className={styles.architectureSubHeader}>
                    Kaito follows the classic Kubernetes Custom Resource Definition(CRD)/controller design pattern. User
                    manages a workspace custom resource which describes the GPU requirements and the inference or tuning
                    specification. Kaito controllers will automate the deployment by reconciling the workspace custom
                    resource.
                </div>
                <div>
                    <img src={kaitoimage} alt="kaitoimage" className={styles.kaitoImage} />
                </div>
                <div className={styles.lastContent}>
                    <ul>
                        <li>
                            KAITO presets the model configurations to avoid adjusting workload parameters based on GPU
                            hardware.
                        </li>
                        <li>Auto-provisions cost-effective GPU nodes based on model requirements.</li>
                        <li>KAITO provides an HTTP server to perform inference calls using the model library.</li>
                    </ul>
                </div>
                <div>
                    {state.kaitoInstallStatus === ProgressEventType.NotStarted && (
                        <VSCodeButton onClick={onClickKaitoInstall}>Install</VSCodeButton>
                    )}
                    {state.kaitoInstallStatus === ProgressEventType.InProgress &&
                        state.operationDescription.includes("Installing Kaito") && (
                            <div
                                style={{
                                    flexDirection: "row",
                                    display: "flex",
                                }}
                            >
                                <VSCodeProgressRing />
                                <p className={styles.installingMessage}>
                                    Installing KAITO, this may take a few minutes...
                                </p>
                            </div>
                        )}
                    {state.kaitoInstallStatus === ProgressEventType.InProgress &&
                        state.operationDescription.includes("Kaito Federated Credentials and role Assignments") && (
                            <div
                                style={{
                                    flexDirection: "row",
                                    display: "flex",
                                }}
                            >
                                <VSCodeProgressRing />
                                <p className={styles.installingMessage}>
                                    Enabling Role assignments and Federated Credentails for KAITO, this may take a few
                                    minutes...
                                </p>
                            </div>
                        )}
                    {state.kaitoInstallStatus === ProgressEventType.Success && state.models.length > 0 && (
                        // <KaitoFamilyModelInput modelDetails={state.models} />
                        <>
                            <p>KAITO is installed.</p>
                            <br />
                            <br />
                            Now, you can right click on your cluster and select &quot;Create Kaito Workspace&quot; to
                            create a CRD.
                            {/* <VSCodeButton onClick={onClickGenerateWorkspace}>Generate Workspace</VSCodeButton> */}
                        </>
                    )}
                </div>

                <div className={styles.spacer}></div>
            </div>
        </>
    );
}
