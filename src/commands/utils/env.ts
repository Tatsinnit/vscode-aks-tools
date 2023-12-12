import { Environment } from "@azure/ms-rest-azure-env";
import path from "path";
import meta from "../../../package.json";

export function ensureDirectoryInPath(directoryPath: string) {
    if (process.env.PATH === undefined) {
        process.env.PATH = directoryPath;
    } else if (process.env.PATH.indexOf(directoryPath) < 0) {
        process.env.PATH = directoryPath + path.delimiter + process.env.PATH;
    }
}

export function getPortalResourceUrl(environment: Environment, armId: string): string {
    const portalUrl = environment.portalUrl.replace(/\/$/, "");
    return `${portalUrl}/#resource${armId}?referrer_source=vscode&referrer_context=${meta.name}`;
}
