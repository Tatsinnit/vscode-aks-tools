import * as vscode from "vscode";

export interface ContainerAssistOptions {
    workspaceFolder: vscode.WorkspaceFolder;
    targetPath: string;
}

export enum ContainerAssistAction {
    GenerateDeployment = "generateDeployment",
    GenerateWorkflow = "generateWorkflow",
}

export interface ContainerAssistQuickPickItem extends vscode.QuickPickItem {
    action: ContainerAssistAction;
}

export interface ContainerAssistResult {
    succeeded: boolean;
    error?: string;
    generatedFiles?: string[];
}

export interface AnalyzeRepositoryResult {
    language?: string;
    framework?: string;
    port?: number;
    buildCommand?: string;
    startCommand?: string;
}

export interface BaseImageRecommendation {
    image: string;
    category: "official" | "distroless" | "security" | "size";
    reason: string;
    size?: string;
    securityRating?: "high" | "medium" | "low";
    tags?: string[];
    matchScore: number;
}

export interface DockerfileRequirement {
    id: string;
    category: string;
    recommendation: string;
    example?: string;
    severity?: "high" | "medium" | "low";
    tags?: string[];
    matchScore: number;
    policyDriven?: boolean;
}

export interface DockerfilePlan {
    nextAction: {
        action: "create-files" | "update-files" | "review-and-decide";
        instruction: string;
        files: Array<{ path: string; purpose: string }>;
    };
    repositoryInfo: {
        name?: string;
        modulePath?: string;
        language?: string;
        framework?: string;
        port?: number;
        buildCommand?: string;
        startCommand?: string;
    };
    recommendations: {
        buildStrategy: {
            multistage: boolean;
            reason: string;
        };
        platform?: string;
        defaultTag?: string;
        baseImages: BaseImageRecommendation[];
        securityConsiderations: DockerfileRequirement[];
        optimizations: DockerfileRequirement[];
        bestPractices: DockerfileRequirement[];
    };
    confidence: number;
    summary: string;
}

export interface ManifestRequirement {
    id: string;
    category: string;
    recommendation: string;
    example?: string;
    severity?: "high" | "medium" | "low" | "required";
    tags?: string[];
    matchScore: number;
    policyDriven?: boolean;
}

export interface ManifestPlan {
    nextAction: {
        action: "create-files" | "update-files" | "review-and-decide";
        instruction: string;
        files: Array<{ path: string; purpose: string }>;
    };
    repositoryInfo?: {
        name?: string;
        modulePath?: string;
        dockerfilePath?: string;
        language?: string;
        languageVersion?: string;
        frameworks?: Array<{ name: string; version?: string }>;
        buildSystem?: { type?: string; configFile?: string };
        dependencies?: string[];
        ports?: number[];
        entryPoint?: string;
    };
    manifestType: "kubernetes" | "helm" | "aca" | "kustomize";
    recommendations: {
        fieldMappings?: ManifestRequirement[];
        securityConsiderations: ManifestRequirement[];
        resourceManagement?: ManifestRequirement[];
        bestPractices: ManifestRequirement[];
    };
    confidence: number;
    summary: string;
}
