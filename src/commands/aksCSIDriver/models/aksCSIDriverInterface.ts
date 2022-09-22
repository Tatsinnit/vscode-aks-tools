import * as k8s from 'vscode-kubernetes-tools-api';

 export interface InstallationResponse {
    clusterName: string;
    deployStorageClass?: k8s.KubectlV1.ShellResult;
    deployStorageClassUsingDataPlaneAPI?: k8s.KubectlV1.ShellResult;
}