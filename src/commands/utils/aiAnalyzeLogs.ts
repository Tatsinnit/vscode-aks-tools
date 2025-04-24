import { AzureOpenAI } from "openai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import * as vscode from "vscode";

dotenv.config();

import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

const credential = new DefaultAzureCredential();
const scope = "https://cognitiveservices.azure.com/.default";
const azureADTokenProvider = getBearerTokenProvider(credential, scope);

const API_VERSION = "2024-08-01-preview";
const AZURE_OPENAI_ENDPOINT = "https://ai-analyze-logs.openai.azure.com/"; // or read from env
const AZURE_DEPLOYMENT_NAME = "o3-mini";

const client = new AzureOpenAI({ azureADTokenProvider, apiVersion: API_VERSION, endpoint: AZURE_OPENAI_ENDPOINT });

// const openai = new OpenAI({ apiKey: OPENAI_API_KEY }); // process.env.OPENAI_API_KEY });

// Function to read all log and cap files
async function readLogFiles(directory: string): Promise<string[]> {
    const files = fs.readdirSync(directory);
    const logs: string[] = [];

    for (const file of files) {
        const filePath = path.join(directory, file);
        if (file.endsWith(".log") || file.endsWith(".cap")) {
            const content = fs.readFileSync(filePath, "utf8");
            logs.push(`File: ${file}\n${content}\n\n`);
        }
    }

    return logs;
}

// Function to send logs to OpenAI for analysis
export async function analyzeLogs(logsDir: string) {
    console.log(`Reading logs from ${logsDir}...`);
    const logs = await readLogFiles(logsDir);
    if (logs.length === 0) {
        console.log("No log files found.");
        return;
    }

    const prompt = `Analyze the following log files for any errors or anomalies:\n\n${logs.join("\n")}\n\nProvide a summary of issues found and possible solutions.`;

    try {
        const response = await client.chat.completions.create({
            model: AZURE_DEPLOYMENT_NAME,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
        });

        console.log("Analysis Result:");
        console.log(response.choices[0].message.content);
        

        const outputChannel = vscode.window.createOutputChannel("aks-logs-analyzer");
        outputChannel.show();
        outputChannel.appendLine("Analysis Result:");
        outputChannel.appendLine(response.choices[0].message.content!);
        outputChannel.appendLine("Analysis completed successfully.");
        outputChannel.appendLine("Please check the output for details.");
    } catch (error) {
        console.error("Error analyzing logs:", error);
    }
}
