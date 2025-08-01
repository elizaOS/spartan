# @elizaos/plugin-google-meet-cute

A powerful Chrome extension-based Google Meet integration plugin for ElizaOS that enables automated meeting participation, real-time transcription, and AI-powered meeting summaries.

## Features

- 🚀 **Automated Meeting Join** - Join Google Meet meetings with a simple command
- 🎙️ **Real-time Transcription** - Capture meeting audio using OpenAI Whisper
- 📝 **Meeting Summaries** - AI-powered summaries of discussions and action items
- 👥 **Participant Tracking** - Monitor who joins and leaves meetings
- 🎬 **Meeting Recording** - Record audio/video for later review
- 🔌 **Chrome Extension** - Reliable, undetectable browser automation
- 💬 **Closed Caption Support** - Automatic caption capture as backup

## How It Works

This plugin uses a Chrome extension to interact with Google Meet, avoiding detection issues common with browser automation tools. The extension communicates with ElizaOS via WebSocket, providing real-time meeting data and control.

```
Google Meet ← Chrome Extension ← WebSocket → ElizaOS Plugin → Your Agent
```

## Quick Start

### 1. Install the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `plugin-google-meet-cute/extension/` folder
5. The extension icon should appear in your toolbar

### 2. Configure ElizaOS

Create a `.env` file in your project root:

```bash
# Required for transcription
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional configuration
EXTENSION_WS_PORT=8765  # WebSocket port (default: 8765)
TRANSCRIPTION_LANGUAGE=en  # Language for transcription
AUDIO_CHUNK_DURATION_MS=30000  # Process audio every 30 seconds
```

### 3. Add Plugin to Your Agent

```javascript
import { googleMeetPlugin } from '@elizaos/plugin-google-meet-cute';

const character = {
  name: "MyAgent",
  plugins: [googleMeetPlugin],
  // ... rest of your character config
};
```

### 4. Start Your Agent

```bash
npm start
```

The plugin will start a WebSocket server on port 8765 (or your configured port).

### 5. Connect Extension to ElizaOS

1. Click the extension icon in Chrome
2. Verify the WebSocket URL (default: `ws://localhost:8765`)
3. Click "Connect"
4. Status should show "Connected to ElizaOS"

## Usage

### Join a Meeting

```
User: Join the meeting https://meet.google.com/abc-defg-hij
Agent: I'll join the meeting for you...
```

The extension will:
- Open the meeting in a new tab
- Automatically click "Join now"
- Enable closed captions for transcription
- Start capturing meeting data

### Get Meeting Summary

```
User: What's happening in the meeting?
User: Summarize the discussion
User: Give me a meeting recap
```

Returns a detailed summary including:
- Meeting duration and participant list
- Transcript statistics
- Recent discussion (last 20 segments)
- Speaker contributions

### Leave Meeting

```
User: Leave the meeting
Agent: I'll leave the current meeting...
```

### Generate Meeting Report

```
User: Generate a meeting report
Agent: I'll create a comprehensive report...
```

Creates a markdown report with:
- Executive summary
- Key discussion points
- Action items
- Full transcript

## Available Actions

| Action | Description | Example Command |
|--------|-------------|-----------------|
| `JOIN_MEETING` | Join a Google Meet | "Join the meeting [url]" |
| `LEAVE_MEETING` | Leave current meeting | "Leave the meeting" |
| `SUMMARIZE_MEETING` | Get meeting summary | "What happened in the meeting?" |
| `GENERATE_REPORT` | Create detailed report | "Generate a meeting report" |

## Transcription Features

### Automatic Closed Captions
- Extension automatically enables CC when joining
- Captures Google's transcriptions as primary source
- No additional setup required

### OpenAI Whisper Integration
- Real-time audio processing every 30 seconds
- High-accuracy transcription
- Multi-language support (50+ languages)
- Cost: ~$0.006/minute

### Meeting Memories
- Important discussion points are saved
- Searchable meeting history
- Context for future interactions

## OBS Virtual Camera (Optional)

For professional video presence:

1. Install [OBS Studio](https://obsproject.com)
2. Create scenes with backgrounds/overlays
3. Start Virtual Camera in OBS
4. Select "OBS Virtual Camera" in Google Meet settings

See the [OBS Setup Guide](extension/obs-setup.html) for detailed instructions.

## Configuration Options

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for transcription | Required |
| `EXTENSION_WS_PORT` | WebSocket server port | 8765 |
| `TRANSCRIPTION_LANGUAGE` | Language code (en, es, fr, etc.) | en |
| `AUDIO_CHUNK_DURATION_MS` | Audio processing interval | 30000 |
| `ENABLE_REAL_TIME_TRANSCRIPTION` | Enable live transcription | true |
| `REPORT_OUTPUT_DIR` | Directory for reports | ./meeting-reports |

## Troubleshooting

### Extension Issues

**Extension won't load:**
- Check all files are present in `/extension` folder
- Ensure Developer Mode is enabled
- Try removing and re-adding the extension

**Not connecting to ElizaOS:**
- Verify ElizaOS is running (`npm start`)
- Check WebSocket port matches in extension and .env
- Look for errors in browser console (F12)

**Meeting won't auto-join:**
- Ensure you're logged into Google account
- Try manual join first time
- Check if Google Meet UI has changed

### Transcription Issues

**No transcripts appearing:**
- Verify OpenAI API key is set
- Check closed captions are enabled
- Wait 30+ seconds for first batch
- Check browser console for errors

**Poor quality transcription:**
- Ensure good audio quality
- Speakers should be unmuted
- Minimize background noise

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│                 │ ◄─────────────────► │                 │
│   Chrome        │                     │   ElizaOS       │
│   Extension     │                     │   Service       │
│                 │                     │                 │
└────────┬────────┘                     └────────┬────────┘
         │                                       │
         │ DOM Access                           │ Transcription
         │                                       │
┌────────▼────────┐                    ┌────────▼────────┐
│                 │                    │                 │
│  Google Meet    │                    │  OpenAI Whisper │
│   Web Page      │                    │      API        │
│                 │                    │                 │
└─────────────────┘                    └─────────────────┘
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/elizaos/plugin-google-meet-cute
cd plugin-google-meet-cute

# Install dependencies
npm install --legacy-peer-deps

# Build the plugin
npm run build
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © ElizaOS

## Support

- [Documentation](https://elizaos.ai/docs)
- [Discord Community](https://discord.gg/elizaos)
- [GitHub Issues](https://github.com/elizaos/plugin-google-meet-cute/issues)

---

Made with ❤️ by the ElizaOS community
