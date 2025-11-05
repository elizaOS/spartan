# Spartan Chat API Documentation

The Spartan Chat API provides a simplified interface for interacting with the Spartan AI agent through conversational messaging. This API allows you to create chat sessions, send messages, and receive responses from Spartan for token analysis, market insights, and trading advice.

## Base URL

All endpoints are relative to your agent's base URL:
```
/api/agents/{agentId}/plugins/spartan-intel/chat
```

For example, if your agent ID is `spartan-123`:
```
https://your-domain.com/api/agents/spartan-123/plugins/spartan-intel/chat
```

## Authentication

All endpoints are currently public. In production environments, you should implement authentication middleware to secure these endpoints.

## Endpoints

### 1. Health Check

Check if the chat service is running and get service status.

**Endpoint:** `GET /chat/health`

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "agentId": "agent-uuid",
    "agentName": "Spartan",
    "activeSessions": 5,
    "timestamp": "2025-11-05T12:00:00.000Z"
  }
}
```

---

### 2. Create Chat Session

Create a new chat session with Spartan. Each session gets its own dedicated channel for isolated conversations.

**Endpoint:** `POST /chat/sessions`

**Request Body:**
```json
{
  "userId": "user-12345",
  "metadata": {
    "userName": "Alice",
    "source": "web_app",
    "customData": "any additional data"
  }
}
```

**Required Fields:**
- `userId` (string): Unique identifier for the user. Can be any string (email, username, Discord ID, etc.). The same userId will always map to the same account across sessions, allowing persistent identity and registration.

**Optional Fields:**
- `metadata` (object): Additional metadata to store with the session

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-uuid",
    "channelId": "channel-uuid",
    "agentId": "agent-uuid",
    "createdAt": "2025-11-05T12:00:00.000Z"
  }
}
```

**Example:**
```bash
curl -X POST https://your-domain.com/api/agents/spartan-123/plugins/spartan-intel/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "alice@example.com",
    "metadata": {
      "userName": "Alice",
      "source": "web_app"
    }
  }'
```

**Important Note:**
- Use a **consistent userId** across all your sessions (e.g., your email address) to maintain your identity
- The same userId will map to the same account, allowing you to register, verify email, and access wallet functions
- Works the same way as Discord/Telegram - your user ID persists across all interactions

---

### 3. Send Message

Send a message to Spartan in an existing session. The agent will process the message and respond asynchronously.

**Endpoint:** `POST /chat/sessions/:sessionId/messages`

**URL Parameters:**
- `sessionId` (string): The session ID returned from session creation

**Request Body:**
```json
{
  "content": "What's the latest on SOL token?",
  "metadata": {
    "clientTimestamp": 1699189200000,
    "messageType": "question"
  }
}
```

**Required Fields:**
- `content` (string, 1-10000 characters): The message content

**Optional Fields:**
- `metadata` (object): Additional metadata for the message

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "message-uuid",
    "content": "What's the latest on SOL token?",
    "createdAt": "2025-11-05T12:00:00.000Z",
    "channelId": "channel-uuid"
  }
}
```

**Example:**
```bash
curl -X POST https://your-domain.com/api/agents/spartan-123/plugins/spartan-intel/chat/sessions/abc-123/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "What are the top trending tokens today?"
  }'
```

---

### 4. Get Message History

Retrieve the conversation history for a session. Messages are returned in reverse chronological order (newest first).

**Endpoint:** `GET /chat/sessions/:sessionId/messages`

**URL Parameters:**
- `sessionId` (string): The session ID

**Query Parameters:**
- `limit` (number, 1-100, default: 50): Maximum number of messages to return
- `before` (number, optional): Timestamp in milliseconds - get messages before this time

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "message-uuid-1",
        "content": "SOL is currently trading at...",
        "authorId": "agent-uuid",
        "isAgent": true,
        "createdAt": "2025-11-05T12:01:00.000Z",
        "sourceType": "agent_response",
        "metadata": {
          "sessionId": "session-uuid"
        },
        "rawMessage": {
          "text": "SOL is currently trading at...",
          "thought": "User asked about SOL price",
          "actions": []
        }
      },
      {
        "id": "message-uuid-2",
        "content": "What's the latest on SOL token?",
        "authorId": "user-uuid",
        "isAgent": false,
        "createdAt": "2025-11-05T12:00:00.000Z",
        "sourceType": "user",
        "metadata": {
          "sessionId": "session-uuid"
        }
      }
    ],
    "sessionId": "session-uuid",
    "hasMore": false
  }
}
```

**Example:**
```bash
# Get last 20 messages
curl https://your-domain.com/api/agents/spartan-123/plugins/spartan-intel/chat/sessions/abc-123/messages?limit=20

# Get messages before a specific timestamp (pagination)
curl https://your-domain.com/api/agents/spartan-123/plugins/spartan-intel/chat/sessions/abc-123/messages?limit=20&before=1699189200000
```

---

### 5. Get Session Info

Retrieve information about a specific chat session.

**Endpoint:** `GET /chat/sessions/:sessionId`

**URL Parameters:**
- `sessionId` (string): The session ID

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-uuid",
    "userId": "user-uuid",
    "channelId": "channel-uuid",
    "agentId": "agent-uuid",
    "createdAt": "2025-11-05T12:00:00.000Z",
    "lastActivity": "2025-11-05T12:05:00.000Z",
    "metadata": {
      "userName": "Alice",
      "source": "web_app"
    }
  }
}
```

**Example:**
```bash
curl https://your-domain.com/api/agents/spartan-123/plugins/spartan-intel/chat/sessions/abc-123
```

---

### 6. Delete Session

Delete a chat session. This removes the session from memory but does not delete the channel or message history from the database.

**Endpoint:** `DELETE /chat/sessions/:sessionId`

**URL Parameters:**
- `sessionId` (string): The session ID

**Response:**
```json
{
  "success": true,
  "message": "Chat session deleted successfully"
}
```

**Example:**
```bash
curl -X DELETE https://your-domain.com/api/agents/spartan-123/plugins/spartan-intel/chat/sessions/abc-123
```

---

### 7. List User Sessions

Get all active sessions for a specific user.

**Endpoint:** `GET /chat/users/:userId/sessions`

**URL Parameters:**
- `userId` (string, UUID): The user ID

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "session-uuid-1",
        "channelId": "channel-uuid-1",
        "agentId": "agent-uuid",
        "createdAt": "2025-11-05T12:00:00.000Z",
        "lastActivity": "2025-11-05T12:05:00.000Z",
        "metadata": {
          "userName": "Alice"
        }
      },
      {
        "sessionId": "session-uuid-2",
        "channelId": "channel-uuid-2",
        "agentId": "agent-uuid",
        "createdAt": "2025-11-05T10:00:00.000Z",
        "lastActivity": "2025-11-05T10:30:00.000Z",
        "metadata": {
          "userName": "Alice"
        }
      }
    ],
    "count": 2
  }
}
```

**Example:**
```bash
curl https://your-domain.com/api/agents/spartan-123/plugins/spartan-intel/chat/users/550e8400-e29b-41d4-a716-446655440000/sessions
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common Error Codes

- **400 Bad Request**: Invalid input (missing required fields, invalid format, etc.)
- **404 Not Found**: Session or resource not found
- **500 Internal Server Error**: Server-side error during processing

### Example Error Responses

**Missing userId:**
```json
{
  "success": false,
  "error": "Missing required field: userId"
}
```

**Session not found:**
```json
{
  "success": false,
  "error": "Chat session not found"
}
```

**Invalid content:**
```json
{
  "success": false,
  "error": "Content must be between 1 and 10000 characters"
}
```

---

## Usage Flow

### Typical Conversation Flow

1. **Create a session** for the user:
   ```
   POST /chat/sessions
   ```

2. **Send a message** to Spartan:
   ```
   POST /chat/sessions/{sessionId}/messages
   ```

3. **Poll for messages** to get Spartan's response:
   ```
   GET /chat/sessions/{sessionId}/messages
   ```

4. **Continue the conversation** by sending more messages (step 2)

5. **Clean up** when done (optional):
   ```
   DELETE /chat/sessions/{sessionId}
   ```

### Example: Complete Chat Interaction

```javascript
// 1. Create session
const sessionResponse = await fetch('/chat/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    metadata: { userName: 'Alice' }
  })
});
const session = await sessionResponse.json();
const sessionId = session.data.sessionId;

// 2. Send message
await fetch(`/chat/sessions/${sessionId}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'What are the top tokens today?'
  })
});

// 3. Wait for response (poll every 1-2 seconds)
let messages;
do {
  await new Promise(resolve => setTimeout(resolve, 1500));
  const historyResponse = await fetch(`/chat/sessions/${sessionId}/messages?limit=10`);
  const history = await historyResponse.json();
  messages = history.data.messages;
  
  // Check if agent has responded
  const agentMessage = messages.find(m => m.isAgent && m.createdAt > lastCheck);
  if (agentMessage) {
    console.log('Spartan:', agentMessage.content);
    break;
  }
} while (true);

// 4. Continue conversation...
```

---

## WebSocket Integration (Future)

Currently, the API uses polling for retrieving agent responses. In future versions, WebSocket support will be added for real-time bidirectional communication:

```javascript
// Future WebSocket API (not yet implemented)
const ws = new WebSocket(`wss://your-domain.com/chat/sessions/${sessionId}/ws`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.isAgent) {
    console.log('Spartan:', message.content);
  }
};

ws.send(JSON.stringify({
  type: 'message',
  content: 'What are the top tokens?'
}));
```

---

## Integration with ElizaOS Messaging System

The Chat API is built on top of the ElizaOS messaging infrastructure:

- **Sessions** create dedicated DM channels in the messaging system
- **Messages** are automatically broadcast to the internal message bus
- **Agent responses** are generated asynchronously through the normal ElizaOS flow
- **Message history** is persisted in the central message database

This means chat messages benefit from:
- Full agent context and memory
- Access to all agent providers and actions
- Integration with other ElizaOS features
- Persistent message storage

---

## Best Practices

1. **Session Management**
   - Create one session per conversation context
   - Reuse sessions for related conversations
   - Clean up sessions when users log out

2. **Message Polling**
   - Poll every 1-2 seconds for new messages
   - Use the `before` parameter for pagination
   - Implement exponential backoff if no new messages

3. **Error Handling**
   - Always check the `success` field in responses
   - Implement retry logic for 500 errors
   - Validate user input before sending

4. **Rate Limiting**
   - Implement client-side rate limiting
   - Don't send messages faster than users can read responses
   - Consider implementing a typing indicator

5. **User Experience**
   - Show "Spartan is typing..." while waiting for responses
   - Display both user and agent messages in chronological order
   - Implement proper loading states and error messages

---

## Notes

- Session data is currently stored in memory and will be lost on server restart
- For production use, consider implementing session persistence
- All UUIDs must be in valid UUID format
- Message content is limited to 10,000 characters
- The API is designed for human-paced conversation, not high-frequency trading

---

## Support

For issues, questions, or feature requests related to the Spartan Chat API, please refer to the ElizaOS documentation or contact the development team.

