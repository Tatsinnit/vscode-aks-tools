import WebSocket from "ws";

export class TestChatClient {
    private ws?: WebSocket;

    async connect(port: number = 8080): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`ws://localhost:${port}`);

            this.ws.on('open', () => {
                console.log("Connected to AKS Chat Participant server");
                resolve();
            });

            this.ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                console.log("Received:", message);
            });

            this.ws.on('error', (error) => {
                console.error("WebSocket error:", error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log("Connection closed");
            });
        });
    }

    async sendChatRequest(message: string): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }

        const request = {
            type: "chat-request",
            id: `test_${Date.now()}`,
            message: message,
            timestamp: Date.now()
        };

        this.ws.send(JSON.stringify(request));
    }

    async sendPing(): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }

        const ping = {
            type: "ping",
            timestamp: Date.now()
        };

        this.ws.send(JSON.stringify(ping));
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
        }
    }

    getStatus(): string {
        if (!this.ws) return "disconnected";
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return "connecting";
            case WebSocket.OPEN: return "connected";
            case WebSocket.CLOSING: return "closing";
            case WebSocket.CLOSED: return "closed";
            default: return "unknown";
        }
    }
}

// Example usage function
export async function testExternalChatFlow(): Promise<void> {
    const client = new TestChatClient();
    
    try {
        console.log("🔗 Connecting to AKS Chat Participant server...");
        await client.connect();
        
        console.log("✅ Connected! Status:", client.getStatus());
        
        // Send test requests
        console.log("\n📨 Sending test messages...");
        
        await client.sendChatRequest("what's the meaning of life?");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await client.sendChatRequest("how do I create an AKS cluster?");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await client.sendChatRequest("hello world");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await client.sendChatRequest("list my aks clusters");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await client.sendPing();
        
        // Keep connection open for a bit to see responses
        console.log("\n⏳ Waiting for responses...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log("\n🏁 Test completed!");
        
    } catch (error) {
        console.error("❌ Test failed:", error);
    } finally {
        console.log("🔌 Disconnecting...");
        client.disconnect();
    }
}

// HTTP client test function
export async function testHttpChatFlow(): Promise<void> {
    const testMessages = [
        "what's the meaning of life?",
        "how do I create an AKS cluster?",
        "hello world",
        "help me with kubectl commands"
    ];

    console.log("🌐 Testing HTTP chat endpoint...");

    for (const message of testMessages) {
        try {
            console.log(`\n📤 Sending: "${message}"`);
            
            const response = await fetch('http://localhost:8080/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`📥 Response:`, result);
            
            // Wait a bit between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ Error sending "${message}":`, error);
        }
    }

    console.log("\n✅ HTTP test completed!");
}
