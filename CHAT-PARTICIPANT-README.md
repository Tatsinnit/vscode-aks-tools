# AKS Chat Participant - External Request Handler

This implementation creates a VS Code Chat Participant that can receive external requests and proxy them through GitHub Copilot. Here's how it works:

## Architecture Overview

```
External Source (HTTP/WebSocket) 
    ↓
External Request Server (Port 8080)
    ↓
AKS Chat Participant (@aksExtension)
    ↓
VS Code Chat Interface
    ↓
GitHub Copilot LLM API
    ↓
Response back through the chain
```

## Features

✅ **Chat Participant**: Registered as `@aksExtension` in VS Code Chat  
✅ **External HTTP API**: REST endpoint at `http://localhost:8080/chat`  
✅ **WebSocket Support**: Real-time communication via WebSocket  
✅ **Copilot Integration**: Routes requests to GitHub Copilot LLM  
✅ **AKS Expertise**: Specialized responses for Azure Kubernetes Service  
✅ **Auto-start Server**: Automatically starts when extension loads  

## Usage

### 1. In VS Code Chat Panel

Open the Chat panel and use the chat participant directly:

```
@aksExtension hello world
@aksExtension how do I create an AKS cluster?
@aksExtension @external:what's the meaning of life?
```

The `@external:` prefix routes the message as if it came from an external source.

### 2. Via HTTP API

Send POST requests to the chat endpoint:

```bash
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "what is the meaning of life?"}'
```

Response:
```json
{
  "id": "http_1693834567890",
  "response": "The meaning of life is 42! But in the context of AKS, it's ensuring your Kubernetes clusters run smoothly...",
  "success": true,
  "timestamp": 1693834567890
}
```

### 3. Via WebSocket

Connect to `ws://localhost:8080` and send JSON messages:

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'chat-request',
    message: 'hello world',
    id: 'my-request-123'
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Response:', response);
};
```

### 4. Test with Demo Script

Run the included demo script to test all functionality:

```bash
node demo-chat-participant.js
```

## API Endpoints

### HTTP Endpoints

- **POST `/chat`** - Send a chat message
- **GET `/health`** - Server health check
- **GET `/info`** - Server information and usage

### WebSocket Messages

#### Incoming Messages:
- `chat-request` - Send a chat message
- `ping` - Health check ping

#### Outgoing Messages:
- `welcome` - Connection established
- `chat-response` - Response to chat request
- `pong` - Response to ping
- `error` - Error message

## Commands

The extension adds these VS Code commands:

- **AKS: Start Chat Participant Server** - Manually start the server
- **AKS: Stop Chat Participant Server** - Manually stop the server

## Configuration

The server runs on port `8080` by default. You can modify this in the source code if needed.

## Example Flow

1. **External source** sends HTTP request: `{"message": "what's the meaning of life?"}`
2. **External Request Server** receives the request
3. **Server** calls `chatParticipant.triggerExternalRequest(message)`
4. **Chat Participant** opens VS Code chat with: `@aksExtension @external:what's the meaning of life?`
5. **VS Code** routes this back to the chat participant's `handleChatRequest` method
6. **Chat Participant** detects the `@external:` prefix and processes as external request
7. **Chat Participant** sends message to **Copilot via VS Code Language Model API**
8. **Copilot** generates response
9. **Response** flows back through the chain to the external source

## Files Added

- `src/chatParticipant/aksChatParticipant.ts` - Main chat participant implementation
- `src/chatParticipant/externalRequestServer.ts` - HTTP/WebSocket server
- `src/chatParticipant/testChatClient.ts` - Test client utilities
- `demo-chat-participant.js` - Demo script
- `CHAT-PARTICIPANT-README.md` - This documentation

## Dependencies Added

- `express` - HTTP server framework
- `ws` - WebSocket implementation
- `@types/express` - TypeScript types for Express
- `@types/ws` - TypeScript types for WebSocket

## Troubleshooting

### Server won't start
- Check if port 8080 is already in use
- Look at VS Code Output panel for error messages
- Try the manual start command: "AKS: Start Chat Participant Server"

### Chat participant not working
- Make sure GitHub Copilot extension is installed and active
- Check VS Code Chat panel is available
- Verify the extension activated successfully

### External requests failing
- Ensure the server is running (check `/health` endpoint)
- Verify request format matches the API specification
- Check network connectivity to localhost:8080

## Next Steps

This implementation provides the foundation for the architecture you described. You can extend it by:

1. **Enhanced Copilot Integration** - Implement more sophisticated prompt engineering
2. **Authentication** - Add security for external requests
3. **Rate Limiting** - Prevent abuse of the external API
4. **Persistent Sessions** - Track conversation history
5. **Custom Workflows** - Add AKS-specific automation flows
6. **Monitoring** - Add metrics and logging for production use

The chat participant successfully bridges external sources with GitHub Copilot through VS Code's chat interface, enabling the request flow you outlined.
