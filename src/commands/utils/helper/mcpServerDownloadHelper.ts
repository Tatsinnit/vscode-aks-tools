import * as vscode from "vscode";
import * as os from "os";
import path from "path";
import { getMCPServerConfig } from "../config";
import { Errorable, failed } from "../errorable";
import { getToolBinaryPath } from "./binaryDownloadHelper";

async function getLatestMCPServerReleaseTag() {
    const mcpServerConfig = getMCPServerConfig();
    if (failed(mcpServerConfig)) {
        vscode.window.showErrorMessage(mcpServerConfig.error);
        return undefined;
    }

    return mcpServerConfig.result.releaseTag;
}

async function getLatestMCPServerContainerKitReleaseTag() {
    const mcpServerConfig = getMCPServerConfig();
    if (failed(mcpServerConfig)) {
        vscode.window.showErrorMessage(mcpServerConfig.error);
        return undefined;
    }

    return mcpServerConfig.result.releaseTag;
}

export async function getMCPServerBinaryPath(): Promise<Errorable<string>> {
    const releaseTag = await getLatestMCPServerReleaseTag();
    if (!releaseTag) {
        return { succeeded: false, error: "Could not get latest release tag." };
    }
    // https://github.com/Azure/aks-mcp/releases/tag/v0.0.1
    // https://github.com/Azure/aks-mcp/releases/download/v0.0.1/aks-mcp-darwin-arm64
    const archiveFilename = getArchiveFilename();
    const downloadUrl = `https://github.com/Azure/aks-mcp/releases/download/${releaseTag}/${archiveFilename}`;
    const pathToBinaryInArchive = getPathToBinaryInArchive();
    const binaryFilename = path.basename(pathToBinaryInArchive);

    return await getToolBinaryPath("aks-mcp", releaseTag, binaryFilename, {
        downloadUrl,
        isCompressed: true,
        pathToBinaryInArchive,
    });
}

export async function getMCPServerContainerKitBinaryPath(): Promise<Errorable<string>> {
    const releaseTag = await getLatestMCPServerContainerKitReleaseTag();
    if (!releaseTag) {
        return { succeeded: false, error: "Could not get latest release tag." };
    }
    // // https://github.com/Azure/container-kit/releases/tag/v0.0.5
    // // https://github.com/Azure/container-kit/releases/download/v0.0.5/container-kit_0.0.5_darwin_arm64.tar.gz

    // const archiveFilename = getArchiveFilename();
    const downloadUrl = `https://github.com/Azure/container-kit/releases/download/${releaseTag}/container-kit_0.0.5_darwin_arm64.tar.gz`;
    const pathToBinaryInArchive = getPathToBinaryInArchive();
    const binaryFilename = path.basename(pathToBinaryInArchive);

    return await getToolBinaryPath("aks-mcp", releaseTag, binaryFilename, {
        downloadUrl,
        isCompressed: true,
        pathToBinaryInArchive,
    });
}

function getArchiveFilename() {
    let architecture = os.arch();
    let operatingSystem = os.platform().toLocaleLowerCase();

    if (architecture === "x64") {
        architecture = "amd64";
    }

    if (operatingSystem === "win32") {
        operatingSystem = "win";
    }

    return `aks-mcp-${operatingSystem}-${architecture}`;
}

function getPathToBinaryInArchive() {
    let architecture = os.arch();
    let operatingSystem = os.platform().toLocaleLowerCase();

    if (architecture === "x64") {
        architecture = "amd64";
    }

    let extension = "";
    if (operatingSystem === "win32") {
        operatingSystem = "windows";
        extension = ".exe";
    }

    return path.join("bin", `${operatingSystem}_${architecture}`, `aks-mcp${extension}`);
}
