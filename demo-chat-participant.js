#!/usr/bin/env node

// This is a demonstration script to test the AKS Chat Participant
// Run this after the extension is loaded and the server is running

const WebSocket = require("ws");
const http = require("http");

// Configuration
const SERVER_URL = "ws://localhost:8080";
const HTTP_URL = "http://localhost:8080";

console.log("🚀 AKS Chat Participant Demo Script");
console.log("=====================================\n");

// Test messages to send
const testMessages = [
    "what's the meaning of life?",
    "hello world",
    "how do I create an AKS cluster?",
    "help me with kubectl commands",
    "list my aks clusters",
    "troubleshoot my cluster performance",
];

// HTTP Test Function
async function testHTTPAPI() {
    console.log("📡 Testing HTTP API...\n");

    // Test health endpoint
    try {
        const healthResponse = await fetch(`${HTTP_URL}/health`);
        const healthData = await healthResponse.json();
        console.log("✅ Health Check:", healthData);
    } catch (error) {
        console.error("❌ Health check failed:", error.message);
        return;
    }

    // Test info endpoint
    try {
        const infoResponse = await fetch(`${HTTP_URL}/info`);
        const infoData = await infoResponse.json();
        console.log("ℹ️  Server Info:", infoData);
    } catch (error) {
        console.error("❌ Info request failed:", error.message);
    }

    console.log("\n📨 Testing Chat Messages via HTTP...\n");

    for (let i = 0; i < testMessages.length; i++) {
        const message = testMessages[i];
        console.log(`${i + 1}. Sending: "${message}"`);

        try {
            const response = await fetch(`${HTTP_URL}/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`   📥 Response: ${result.response.substring(0, 100)}...`);
            console.log(`   ✅ Success: ${result.success}, ID: ${result.id}\n`);

            // Wait between requests
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}\n`);
        }
    }
}

// WebSocket Test Function
async function testWebSocketAPI() {
    console.log("🔌 Testing WebSocket API...\n");

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(SERVER_URL);
        let messageIndex = 0;

        ws.on("open", () => {
            console.log("✅ WebSocket connected\n");

            // Send messages one by one
            const sendNextMessage = () => {
                if (messageIndex < testMessages.length) {
                    const message = testMessages[messageIndex];
                    console.log(`📤 Sending: "${message}"`);

                    ws.send(
                        JSON.stringify({
                            type: "chat-request",
                            id: `demo_${Date.now()}_${messageIndex}`,
                            message: message,
                            timestamp: Date.now(),
                        }),
                    );

                    messageIndex++;
                } else {
                    // All messages sent, wait a bit then close
                    setTimeout(() => {
                        console.log("🏁 All messages sent, closing connection...");
                        ws.close();
                    }, 2000);
                }
            };

            // Start sending messages
            sendNextMessage();

            // Send next message every 3 seconds
            const interval = setInterval(() => {
                if (messageIndex >= testMessages.length) {
                    clearInterval(interval);
                } else {
                    sendNextMessage();
                }
            }, 3000);
        });

        ws.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log(`📥 Received: ${message.type}`);

                if (message.type === "chat-response") {
                    console.log(`   Response: ${message.response.substring(0, 100)}...`);
                    console.log(`   Success: ${message.success}, ID: ${message.id}\n`);
                } else if (message.type === "welcome") {
                    console.log(`   Welcome: ${message.message}`);
                    console.log(`   Info:`, message.info, "\n");
                } else if (message.type === "error") {
                    console.log(`   ❌ Error: ${message.error}\n`);
                } else {
                    console.log(`   Data:`, message, "\n");
                }
            } catch (error) {
                console.error("   ❌ Failed to parse message:", error.message);
            }
        });

        ws.on("close", () => {
            console.log("🔌 WebSocket connection closed\n");
            resolve();
        });

        ws.on("error", (error) => {
            console.error("❌ WebSocket error:", error.message);
            reject(error);
        });
    });
}

// Main execution
async function main() {
    try {
        console.log("🔍 Checking if server is running...\n");

        // Quick health check
        try {
            const response = await fetch(`${HTTP_URL}/health`);
            if (!response.ok) {
                throw new Error("Server not responding properly");
            }
            console.log("✅ Server is running!\n");
        } catch (error) {
            console.error("❌ Server appears to be offline. Please make sure:");
            console.error("   1. VS Code is open with the AKS extension loaded");
            console.error("   2. The chat participant server has started");
            console.error("   3. The server is running on port 8080\n");
            process.exit(1);
        }

        // Run HTTP tests
        await testHTTPAPI();

        console.log("\n" + "=".repeat(50) + "\n");

        // Run WebSocket tests
        await testWebSocketAPI();

        console.log("🎉 Demo completed successfully!");
        console.log("\n💡 Next steps:");
        console.log("   1. Open VS Code Chat panel");
        console.log("   2. Type: @aksExtension hello world");
        console.log("   3. Try: @aksExtension @external:what is the meaning of life?");
        console.log("   4. Check the server logs in VS Code Output panel");
    } catch (error) {
        console.error("❌ Demo failed:", error);
        process.exit(1);
    }
}

// Run the demo
main().catch(console.error);
