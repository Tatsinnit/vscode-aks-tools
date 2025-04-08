import { OpenAI } from "openai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import * as vscode from "vscode";

dotenv.config();

const OPENAI_API_KEY = "";

// const AZURE_OPENAI_ENDPOINT = "https://ai-analyze-logs.openai.azure.com/";
// const AZURE_DEPLOYMENT_NAME = "o3-mini";

// const openai = new OpenAI({
//     apiKey: OPENAI_API_KEY,
//     baseURL: `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT_NAME}`,
//     defaultQuery: { "api-version": "2024-06-01" },
// });

const openai = new OpenAI({ apiKey: OPENAI_API_KEY }); // process.env.OPENAI_API_KEY });

// const LOGS_DIRECTORY = "./logs";
// Change to your actual logs folder loaction for now where retina gets default downloaded

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
    console.log("Current working directory 2:", process.cwd());
    const absolutePath = path.resolve(logsDir);
    console.log(`wsl path ${absolutePath}...`);
    // const windowsPath = execSync(`wslpath -w ${absolutePath}`).toString().trim();
    // console.log(`windows path ${windowsPath}...`);
    console.log(`Reading logs from ${logsDir}...`);
    const logs = await readLogFiles(logsDir);
    if (logs.length === 0) {
        console.log("No log files found.");
        return;
    }

    const prompt = `Analyze the following log files for any errors or anomalies:\n\n${logs.join("\n")}\n\nProvide a summary of issues found and possible solutions.`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
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
