import * as vscode from "vscode";

export interface ExternalChatRequest {
    id: string;
    message: string;
    source: string;
    timestamp: number;
}

export interface ExternalChatResponse {
    id: string;
    response: string;
    success: boolean;
    timestamp: number;
}

export class AksChatParticipant {
    readonly id = "aksExtension";
    
    private externalRequestCallback?: (request: ExternalChatRequest) => Promise<void>;
    private participant?: vscode.ChatParticipant;

    constructor() {
        // Register the chat participant
        this.registerParticipant();
    }

    private registerParticipant() {
        try {
            this.participant = vscode.chat.createChatParticipant(
                this.id,
                this.handleChatRequest.bind(this)
            );

            // Set icon if available
            const extension = vscode.extensions.getExtension("ms-kubernetes-tools.vscode-aks-tools");
            if (extension) {
                this.participant.iconPath = vscode.Uri.joinPath(extension.extensionUri, "resources", "aks-tools.png");
            }
            
            // Set up followup provider
            this.participant.followupProvider = {
                provideFollowups: this.provideFollowups.bind(this)
            };

            console.log("AKS Chat Participant registered successfully");
        } catch (error) {
            console.error("Failed to register AKS Chat Participant:", error);
        }
    }

    setExternalRequestCallback(callback: (request: ExternalChatRequest) => Promise<void>) {
        this.externalRequestCallback = callback;
    }

    private async handleChatRequest(
        request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        try {
            console.log("AKS Chat Participant received request:", request.prompt);
            
            // Check if this is an external request (contains special marker)
            const isExternalRequest = request.prompt.startsWith("@external:");
            
            if (isExternalRequest) {
                // Extract the actual message
                const actualMessage = request.prompt.replace("@external:", "").trim();
                
                stream.markdown(`🔄 **Processing External Request:** ${actualMessage}\n\n`);
                
                // Create external request object
                const externalRequest: ExternalChatRequest = {
                    id: `ext_${Date.now()}`,
                    message: actualMessage,
                    source: "external",
                    timestamp: Date.now()
                };

                // Handle external request callback
                if (this.externalRequestCallback) {
                    await this.externalRequestCallback(externalRequest);
                }

                // Send to Copilot and get response
                const copilotResponse = await this.sendToCopilot(actualMessage);
                
                stream.markdown(`**🤖 Copilot Response:**\n\n${copilotResponse}\n\n---\n\n✅ *Response has been sent back to external source*`);
                
                return { metadata: { command: "external-request", requestId: externalRequest.id } };
            } else {
                // Handle regular chat request
                const response = await this.handleRegularChatRequest(request.prompt);
                stream.markdown(response);
                
                return { metadata: { command: "regular-chat" } };
            }
        } catch (error) {
            console.error("Error in AKS chat participant:", error);
            stream.markdown(`❌ **Error processing request:** ${error instanceof Error ? error.message : String(error)}`);
            return { metadata: { command: "error" } };
        }
    }

    private async sendToCopilot(message: string): Promise<string> {
        try {
            // Try to use VS Code's language model API to send to Copilot
            const models = await vscode.lm.selectChatModels({
                vendor: "copilot"
            });

            if (models.length === 0) {
                console.log("No Copilot models available, trying alternative approach");
                return await this.fallbackCopilotResponse(message);
            }

            const model = models[0];
            const messages = [
                vscode.LanguageModelChatMessage.User(`You are an Azure Kubernetes Service (AKS) expert assistant. Please help with this request: ${message}`)
            ];

            const chatRequest = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            
            let response = "";
            for await (const fragment of chatRequest.text) {
                response += fragment;
            }

            return response;
        } catch (error) {
            console.error("Error sending to Copilot:", error);
            return await this.fallbackCopilotResponse(message);
        }
    }

    private async fallbackCopilotResponse(message: string): Promise<string> {
        // Fallback response when Copilot API is not available
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes("meaning of life")) {
            return "The meaning of life is 42, according to Douglas Adams. But in the context of AKS, the meaning of life is probably ensuring your Kubernetes clusters are running smoothly and securely! 🚀";
        } else if (lowerMessage.includes("cluster")) {
            return `For AKS cluster questions, I can help you with:\n\n- Creating and managing AKS clusters\n- Troubleshooting cluster issues\n- Best practices for cluster configuration\n- Scaling and upgrading clusters\n\nYour specific question: "${message}"\n\nWould you like me to help you with any of these AKS cluster topics?`;
        } else if (lowerMessage.includes("kubectl")) {
            return `For kubectl commands with AKS, I can assist you with:\n\n- Running kubectl commands against your clusters\n- Debugging pod and service issues\n- Managing deployments and configurations\n\nRegarding: "${message}"\n\nWhat specific kubectl operation would you like help with?`;
        } else {
            return `I'm the AKS Extension assistant. You asked: "${message}"\n\n🔧 I can help you with:\n- Azure Kubernetes Service cluster management\n- Troubleshooting AKS issues\n- kubectl commands and operations\n- Best practices and recommendations\n\nHow can I assist you with AKS today?`;
        }
    }

    private async handleRegularChatRequest(prompt: string): Promise<string> {
        // Handle regular AKS-related chat requests
        const lowerPrompt = prompt.toLowerCase();
        
        if (lowerPrompt.includes("cluster")) {
            return "🎯 **AKS Cluster Help**\n\nI can help you with AKS cluster operations:\n\n- Creating new clusters\n- Managing existing clusters\n- Troubleshooting cluster issues\n- Best practices and recommendations\n\nWhat would you like to know about AKS clusters?";
        } else if (lowerPrompt.includes("kubectl")) {
            return "⚡ **Kubectl Commands**\n\nI can assist with kubectl commands for your AKS clusters:\n\n- Running commands against clusters\n- Debugging applications\n- Managing resources\n- Checking cluster status\n\nWhat specific kubectl operation do you need help with?";
        } else if (lowerPrompt.includes("help")) {
            return "🚀 **AKS Extension Assistant**\n\nI'm here to help with Azure Kubernetes Service!\n\n**Available features:**\n- Cluster management and operations\n- Troubleshooting and diagnostics\n- kubectl command assistance\n- Best practices guidance\n- External request processing\n\nJust ask me anything about AKS!";
        } else {
            return `🤖 **AKS Assistant**\n\nYou said: "${prompt}"\n\nI'm specialized in Azure Kubernetes Service. I can help you with:\n\n- 🏗️ Cluster creation and management\n- 🔍 Troubleshooting and diagnostics\n- ⚡ kubectl operations\n- 📋 Best practices\n\nHow can I assist you with AKS today?`;
        }
    }

    private async provideFollowups(
        result: vscode.ChatResult,
        _context: vscode.ChatContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.ChatFollowup[]> {
        const followups: vscode.ChatFollowup[] = [
            {
                prompt: "Tell me more about AKS clusters",
                label: "📋 AKS Clusters"
            },
            {
                prompt: "How to deploy to AKS?",
                label: "🚀 Deploy to AKS"
            },
            {
                prompt: "AKS troubleshooting tips",
                label: "🔍 Troubleshooting"
            }
        ];

        // Add specific followups based on the previous result
        if (result.metadata?.command === "external-request") {
            followups.unshift({
                prompt: "Test external request with 'what's the meaning of life'",
                label: "🧪 Test External"
            });
        }

        return followups;
    }

    // Method to handle external responses - trigger a chat session with the response
    async sendExternalResponse(response: ExternalChatResponse): Promise<void> {
        try {
            // Open chat and send the response
            await vscode.commands.executeCommand(
                "workbench.action.chat.open",
                `@aksExtension External response received (ID: ${response.id}): ${response.response}`
            );
        } catch (error) {
            console.error("Error sending external response to chat:", error);
        }
    }

    // Method to trigger an external request through chat
    async triggerExternalRequest(message: string): Promise<void> {
        try {
            await vscode.commands.executeCommand(
                "workbench.action.chat.open",
                `@aksExtension @external:${message}`
            );
        } catch (error) {
            console.error("Error triggering external request:", error);
        }
    }

    dispose() {
        if (this.participant) {
            this.participant.dispose();
        }
    }
}
