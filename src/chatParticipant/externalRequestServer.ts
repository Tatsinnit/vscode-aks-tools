import * as vscode from "vscode";
import WebSocket from "ws";
import express from "express";
import * as http from "http";
import { ExternalChatRequest, ExternalChatResponse, AksChatParticipant } from "./aksChatParticipant";

interface WebSocketMessage {
    type: string;
    id?: string;
    message?: string;
    [key: string]: unknown;
}

export class ExternalRequestServer {
    private wss?: WebSocket.Server;
    private httpServer?: http.Server;
    private chatParticipant: AksChatParticipant;
    private activeConnections: Set<WebSocket> = new Set();
    private pendingRequests: Map<string, WebSocket> = new Map();
    private isRunning = false;

    constructor(chatParticipant: AksChatParticipant) {
        this.chatParticipant = chatParticipant;
        
        // Set up the external request callback
        this.chatParticipant.setExternalRequestCallback(
            this.handleExternalChatRequest.bind(this)
        );
    }

    async start(port: number = 8080): Promise<void> {
        if (this.isRunning) {
            console.log("External request server is already running");
            return;
        }

        try {
            // Create Express app for HTTP endpoints
            const app = express();
            app.use(express.json());

            // Add CORS headers
            app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                if (req.method === 'OPTIONS') {
                    res.sendStatus(200);
                } else {
                    next();
                }
            });

            // HTTP endpoint for external requests
            app.post('/chat', async (req: express.Request, res: express.Response) => {
                try {
                    const { message } = req.body;
                    if (!message) {
                        return res.status(400).json({ error: "Message is required" });
                    }

                    const requestId = `http_${Date.now()}`;
                    const request: ExternalChatRequest = {
                        id: requestId,
                        message,
                        source: "http",
                        timestamp: Date.now()
                    };

                    console.log(`Received HTTP chat request: ${message}`);

                    // Process the request
                    const response = await this.processExternalRequest(request);
                    return res.json(response);
                } catch (error) {
                    console.error("HTTP request error:", error);
                    return res.status(500).json({ 
                        error: "Internal server error",
                        details: error instanceof Error ? error.message : String(error)
                    });
                }
            });

            // Health check endpoint
            app.get('/health', (_req: express.Request, res: express.Response) => {
                res.json({ 
                    status: "healthy", 
                    timestamp: new Date().toISOString(),
                    connections: this.activeConnections.size,
                    pendingRequests: this.pendingRequests.size
                });
            });

            // Info endpoint
            app.get('/info', (_req: express.Request, res: express.Response) => {
                res.json({
                    name: "AKS Extension Chat Participant Server",
                    version: "1.0.0",
                    endpoints: {
                        "POST /chat": "Send a chat message",
                        "GET /health": "Health check",
                        "GET /info": "Server information",
                        "WebSocket /": "WebSocket connection for real-time chat"
                    },
                    usage: {
                        http: "POST to /chat with { \"message\": \"your message here\" }",
                        websocket: "Send JSON with { \"type\": \"chat-request\", \"message\": \"your message\" }"
                    }
                });
            });

            // Create HTTP server
            this.httpServer = http.createServer(app);

            // Create WebSocket server
            this.wss = new WebSocket.Server({ server: this.httpServer });

            this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
                console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);
                this.activeConnections.add(ws);

                ws.on('message', async (data: WebSocket.Data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        await this.handleWebSocketMessage(ws, message);
                    } catch (error) {
                        console.error("WebSocket message error:", error);
                        ws.send(JSON.stringify({ 
                            type: "error",
                            error: "Invalid message format",
                            timestamp: Date.now()
                        }));
                    }
                });

                ws.on('close', () => {
                    console.log("WebSocket connection closed");
                    this.activeConnections.delete(ws);
                });

                ws.on('error', (error: Error) => {
                    console.error("WebSocket error:", error);
                    this.activeConnections.delete(ws);
                });

                // Send welcome message
                ws.send(JSON.stringify({
                    type: "welcome",
                    message: "Connected to AKS Extension Chat Participant",
                    timestamp: Date.now(),
                    info: {
                        participantId: "aksExtension",
                        capabilities: ["chat-requests", "aks-assistance", "copilot-proxy"]
                    }
                }));
            });

            // Start the server
            await new Promise<void>((resolve, reject) => {
                this.httpServer!.listen(port, (error?: Error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            this.isRunning = true;
            console.log(`AKS External Request Server running on port ${port}`);
            vscode.window.showInformationMessage(
                `🚀 AKS Chat Participant server started on port ${port}`
            );

        } catch (error) {
            console.error("Failed to start external request server:", error);
            vscode.window.showErrorMessage(`❌ Failed to start AKS chat server: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    private async handleWebSocketMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
        try {
            console.log("Received WebSocket message:", message);

            if (message.type === "chat-request") {
                if (!message.message) {
                    ws.send(JSON.stringify({
                        type: "error",
                        error: "Message is required for chat-request",
                        timestamp: Date.now()
                    }));
                    return;
                }

                const request: ExternalChatRequest = {
                    id: message.id || `ws_${Date.now()}`,
                    message: message.message,
                    source: "websocket",
                    timestamp: Date.now()
                };

                // Store the connection for this request
                this.pendingRequests.set(request.id, ws);

                // Send acknowledgment
                ws.send(JSON.stringify({
                    type: "request-received",
                    requestId: request.id,
                    message: "Processing your request...",
                    timestamp: Date.now()
                }));

                // Process the request
                const response = await this.processExternalRequest(request);
                
                // Send response back via WebSocket
                ws.send(JSON.stringify({
                    type: "chat-response",
                    ...response
                }));

                // Clean up
                this.pendingRequests.delete(request.id);
            } else if (message.type === "ping") {
                // Handle ping/pong for connection health
                ws.send(JSON.stringify({
                    type: "pong",
                    timestamp: Date.now()
                }));
            } else {
                ws.send(JSON.stringify({
                    type: "error",
                    error: `Unknown message type: ${message.type}`,
                    timestamp: Date.now()
                }));
            }
        } catch (error) {
            console.error("Error handling WebSocket message:", error);
            ws.send(JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: Date.now()
            }));
        }
    }

    private async processExternalRequest(request: ExternalChatRequest): Promise<ExternalChatResponse> {
        try {
            console.log(`Processing external request: ${request.id} - ${request.message}`);

            // Trigger the chat participant by opening chat with @mention
            await this.chatParticipant.triggerExternalRequest(request.message);

            // For demo purposes, create a response
            // In a real implementation, you'd capture the actual Copilot response
            const response: ExternalChatResponse = {
                id: request.id,
                response: await this.generateResponse(request.message),
                success: true,
                timestamp: Date.now()
            };

            console.log(`Generated response for ${request.id}: ${response.response.substring(0, 100)}...`);
            return response;
        } catch (error) {
            console.error("Error processing external request:", error);
            return {
                id: request.id,
                response: `Error processing request: ${error instanceof Error ? error.message : String(error)}`,
                success: false,
                timestamp: Date.now()
            };
        }
    }

    private async generateResponse(message: string): Promise<string> {
        // This simulates processing through the chat participant and getting a Copilot response
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes("meaning of life")) {
            return "The meaning of life is 42! But in the context of AKS, it's ensuring your Kubernetes clusters run smoothly and your applications are always available. 🚀✨";
        } else if (lowerMessage.includes("hello world")) {
            return "Hello World! 👋 I'm the AKS Extension Chat Participant. I can help you with Azure Kubernetes Service questions, cluster management, and kubectl operations. What would you like to know?";
        } else if (lowerMessage.includes("cluster")) {
            return `I can help you with AKS cluster operations! For your question about "${message}", here are some things I can assist with:\n\n🏗️ Creating and configuring clusters\n🔧 Managing cluster resources\n🔍 Troubleshooting cluster issues\n📊 Monitoring cluster health\n\nWhat specific cluster operation do you need help with?`;
        } else if (lowerMessage.includes("kubectl")) {
            return `For kubectl operations with "${message}", I can help you:\n\n⚡ Run kubectl commands\n🐛 Debug applications\n📋 Manage deployments\n🔍 Check resource status\n\nWhat kubectl command would you like assistance with?`;
        } else {
            return `Thanks for your message: "${message}"\n\nI'm the AKS Extension assistant, specialized in:\n\n🎯 Azure Kubernetes Service\n🛠️ Cluster management\n⚡ kubectl operations\n🔍 Troubleshooting\n\nHow can I help you with AKS today?`;
        }
    }

    private async handleExternalChatRequest(request: ExternalChatRequest): Promise<void> {
        console.log("Chat participant callback - handling external chat request:", request);
        
        // Broadcast to WebSocket clients if any are connected
        this.broadcast({
            type: "external-request-processed",
            requestId: request.id,
            message: request.message,
            source: request.source,
            timestamp: request.timestamp
        });
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            console.log("External request server is not running");
            return;
        }

        try {
            // Close all WebSocket connections
            this.activeConnections.forEach(ws => {
                ws.send(JSON.stringify({
                    type: "server-shutdown",
                    message: "Server is shutting down",
                    timestamp: Date.now()
                }));
                ws.close();
            });
            this.activeConnections.clear();
            this.pendingRequests.clear();

            // Close WebSocket server
            if (this.wss) {
                await new Promise<void>((resolve) => {
                    this.wss!.close(() => resolve());
                });
                this.wss = undefined;
            }

            // Close HTTP server
            if (this.httpServer) {
                await new Promise<void>((resolve) => {
                    this.httpServer!.close(() => resolve());
                });
                this.httpServer = undefined;
            }

            this.isRunning = false;
            console.log("External request server stopped");
            vscode.window.showInformationMessage("🛑 AKS Chat Participant server stopped");
        } catch (error) {
            console.error("Error stopping server:", error);
            vscode.window.showErrorMessage(`Error stopping server: ${error}`);
        }
    }

    // Method to broadcast to all connected WebSocket clients
    broadcast(message: Record<string, unknown>): void {
        const messageStr = JSON.stringify(message);
        this.activeConnections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(messageStr);
                } catch (error) {
                    console.error("Error broadcasting to WebSocket client:", error);
                }
            }
        });
    }

    // Get server status
    getStatus() {
        return {
            isRunning: this.isRunning,
            connections: this.activeConnections.size,
            pendingRequests: this.pendingRequests.size
        };
    }
}
