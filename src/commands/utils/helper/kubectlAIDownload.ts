import * as vscode from 'vscode';
import * as os from 'os';
import path = require("path");
import { getKubectlAIConfig } from '../config';
import { Errorable, failed } from '../errorable';
import { getToolBinaryPath } from './binaryDownloadHelper';

async function getLatestKubectlAIReleaseTag() {
   const kubeloginConfig = getKubectlAIConfig();
   if (failed(kubeloginConfig)) {
      vscode.window.showErrorMessage(kubeloginConfig.error);
      return undefined;
   }

   return kubeloginConfig.result.releaseTag;
}

export async function getKubectlAIBinaryPath(): Promise<Errorable<string>> {
    const releaseTag = await getLatestKubectlAIReleaseTag();
    if (!releaseTag) {
         return {succeeded: false, error: "Could not get latest release tag."};
    }

    const archiveFilename = getArchiveFilename();
    // URL: https://github.com/sozercan/kubectl-ai/releases/download/v0.0.6/kubectl-ai_linux_amd64.tar.gz
    const downloadUrl = `https://github.com/sozercan/kubectl-ai/releases/download/${releaseTag}/${archiveFilename}`;
    const pathToBinaryInArchive = getPathToBinaryInArchive();
    const binaryFilename = path.basename(pathToBinaryInArchive);

    return await getToolBinaryPath("kubectl-ai", releaseTag, downloadUrl, pathToBinaryInArchive, binaryFilename);
}

function getArchiveFilename() {
    let architecture = os.arch();
    let operatingSystem = os.platform().toLocaleLowerCase();
    let extension = ".tar.gz";
    
    if (architecture === 'x64') {
        architecture = 'amd64';
    }

    if (operatingSystem === 'win32') {
        operatingSystem = 'windows';
        extension = ".zip"
    }

    return `kubectl-ai_${operatingSystem}_${architecture}${extension}`;
}

function getPathToBinaryInArchive() {
   let architecture = os.arch();
   let operatingSystem = os.platform().toLocaleLowerCase();

   if (architecture === 'x64') {
       architecture = 'amd64';
   }

   let extension = '';
   if (operatingSystem === 'win32') {
       extension = '.exe';
   }

   return path.join(`kubectl-ai${extension}`);
}
