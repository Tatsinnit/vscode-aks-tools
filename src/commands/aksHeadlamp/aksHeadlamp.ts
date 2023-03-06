import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { getKubernetesClusterInfo } from '../utils/clusters';
import { failed } from '../utils/errorable';

export async function aksHeadlampDeploy(
    _context: IActionContext,
    target: any
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

    const clusterInfo = await getKubernetesClusterInfo(target, cloudExplorer, clusterExplorer);
    if (failed(clusterInfo)) {
        vscode.window.showErrorMessage(clusterInfo.error);
        return undefined;
    }

    // const webview = createWebView('AKS Kubectl Commands', `AKS Kubectl Command view for: ${clusterInfo.result.name}`).webview;
    // webview.html = getWebviewContent(kubectlresult.result, commandToRun, extensionPath.result, webview);


    // Use asExternalUri to get the URI for the web server
    const dynamicWebServerPort = 4466;
    const fullWebServerUri = await vscode.env.asExternalUri(
        vscode.Uri.parse(`http://localhost:${dynamicWebServerPort}`)
    );

    // Create the webview
    const panel = vscode.window.createWebviewPanel(
        'Headlamp',
        `Headlamp ${clusterInfo.result.name}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    const cspSource = panel.webview.cspSource;
    panel.webview.html = `<!DOCTYPE html>
        <head>
            <meta
                http-equiv="Content-Security-Policy"
                content="default-src 'none'; frame-src ${fullWebServerUri} ${cspSource} https:; img-src ${cspSource} https:; script-src ${cspSource}; style-src ${cspSource};"
            />
        </head>
        <body>
        <!-- All content from the web server must be in an iframe -->
        <iframe src="${fullWebServerUri}" width="1000" height="1000" >
    </body>
    </html>`;

    // const LOCAL_STATIC_PORT = 4466;
    // // const dynamicServerPort = await getWebServerPort();

    // // Create webview and pass portMapping in
    // const panel = vscode.window.createWebviewPanel(
    //     'remoteMappingExample',
    //     'Remote Mapping Example',
    //     vscode.ViewColumn.One,
    //     {
    //         enableScripts: true,
    //         // portMapping: [
    //         //     // This maps localhost:3000 in the webview to the web server port on the remote host.
    //         //     // { webviewPort: LOCAL_STATIC_PORT, extensionHostPort: 44 }
    //         // ]
    //     }
    // );

    // // Reference the port in any full URIs you reference in your HTML.
    // panel.webview.html = `<!DOCTYPE html>
    // <body>
    //     <!-- This will resolve to the dynamic server port on the remote machine -->
    //     <iframe src="http://localhost:${LOCAL_STATIC_PORT}" width="1000" height="1000">
    // </body>
    // </html>`;

}

// async function runKubectlGadgetCommands(
//     clustername: string,
//     command: string,
//     clusterConfig: string,
//     kubectl: k8s.APIAvailable<k8s.KubectlV1>) {

//     const kubectlGadgetPath = await getKubectlGadgetBinaryPath();

//     if (failed(kubectlGadgetPath)) {
//         vscode.window.showWarningMessage(`kubectl gadget path was not found ${kubectlGadgetPath.error}`);
//         return;
//     }

//     const extensionPath = getExtensionPath();

//     if (failed(extensionPath)) {
//         vscode.window.showErrorMessage(extensionPath.error);
//         return;
//     }

//     return await longRunning(`Running kubectl gadget command on ${clustername}`,
//         async () => {
//             const commandToRun = `gadget ${command}`;
//             const binaryPathDir = path.dirname(kubectlGadgetPath.result);

//             if (process.env.PATH === undefined) {
//                 process.env.PATH = binaryPathDir
//             } else if (process.env.PATH.indexOf(binaryPathDir) < 0) {
//                 process.env.PATH = binaryPathDir + path.delimiter + process.env.PATH;
//             }

//             const kubectlresult = await tmpfile.withOptionalTempFile<Errorable<k8s.KubectlV1.ShellResult>>(
//                 clusterConfig, "YAML", async (kubeConfigFile) => {
//                     return await invokeKubectlCommand(kubectl, kubeConfigFile, commandToRun);
//                 });

//             if (failed(kubectlresult)) {
//                 vscode.window.showWarningMessage(`kubectl gadget command failed with following error: ${kubectlresult.error}`);
//                 return;
//             }

//             if (kubectlresult.succeeded) {
//                 const webview = createWebView('AKS Kubectl Commands', `AKS Kubectl Command view for: ${clustername}`).webview;
//                 webview.html = getWebviewContent(kubectlresult.result, commandToRun, extensionPath.result, webview);
//             }
//         }
//     );
// }

// function getWebviewContent(
//     clusterdata: k8s.KubectlV1.ShellResult,
//     commandRun: string,
//     vscodeExtensionPath: string,
//     webview: vscode.Webview
// ): string {
//     const styleUri = getResourceUri(webview, vscodeExtensionPath, 'common', 'detector.css');
//     const templateUri = getResourceUri(webview, vscodeExtensionPath, 'aksKubectlCommand', 'akskubectlcommand.html');
//     const data = {
//         cssuri: styleUri,
//         name: commandRun,
//         command: clusterdata.stdout,
//     };

//     return getRenderedContent(templateUri, data);
// }
