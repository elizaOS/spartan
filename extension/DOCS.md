# Complete Documentation

This document consolidates all key information about the Google Meet Chrome Extension plugin.

## Table of Contents

1. [Chrome Extension Setup](#chrome-extension-setup)
2. [Audio Transcription](#audio-transcription)
3. [Auto-Join Feature](#auto-join-feature)
4. [OBS Virtual Camera](#obs-virtual-camera)
5. [Troubleshooting](#troubleshooting)

---

## Chrome Extension Setup

### Installation Steps

1. **Load Extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `/plugin-google-meet-cute/extension/` folder

2. **Configure ElizaOS**
   ```bash
   # .env file
   OPENAI_API_KEY=sk-your-key-here
   EXTENSION_WS_PORT=8765
   ```

3. **Connect Extension**
   - Click extension icon
   - Verify WebSocket URL
   - Click "Connect"

### How It Works

```
Google Meet ← Extension ← WebSocket → ElizaOS
```

The extension:
- Runs as trusted Chrome component (no bot detection)
- Captures DOM events and transcripts
- Controls meeting (join, leave, mute)
- Sends data to ElizaOS in real-time

---

## Audio Transcription

### Features

1. **Automatic Closed Captions**
   - Enabled automatically when joining
   - Free transcription from Google
   - Speaker identification included

2. **OpenAI Whisper Integration**
   - Processes audio every 30 seconds
   - 50+ language support
   - ~$0.006/minute cost

### Configuration

```bash
# Transcription settings
TRANSCRIPTION_LANGUAGE=en  # or es, fr, de, etc.
AUDIO_CHUNK_DURATION_MS=30000  # Process interval
ENABLE_REAL_TIME_TRANSCRIPTION=true
```

### Usage

```
User: "Join the meeting https://meet.google.com/abc-defg-hij"
# Extension joins and starts transcribing

User: "What's happening in the meeting?"
# Returns summary with transcripts
```

---

## Auto-Join Feature

### How It Works

1. Opens meeting URL in new tab
2. Waits 3 seconds for page load
3. Sets display name (if provided)
4. Clicks "Join now" automatically

### Configuration

To adjust timing, edit `extension/background.js`:
```javascript
setTimeout(() => {
  // Set display name
  if (meetingInfo.displayName) {
    chrome.tabs.sendMessage(tabId, { 
      type: 'SET_DISPLAY_NAME',
      displayName: meetingInfo.displayName
    });
  }
  
  // Click join button
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, { 
      type: 'CLICK_JOIN_BUTTON' 
    });
  }, 1000); // Delay after name
}, 3000); // Initial delay
```

---

## OBS Virtual Camera

### Benefits
- Professional backgrounds
- Screen sharing with webcam
- Video filters and effects
- High-quality recording

### Quick Setup
1. Install OBS Studio
2. Create your scene
3. Start Virtual Camera
4. Select "OBS Virtual Camera" in Meet

See full guide: `extension/obs-setup.html`

---

## Troubleshooting

### Common Issues

**Extension not connecting:**
- Check ElizaOS is running
- Verify port 8765 is free
- Check browser console (F12)

**No transcripts:**
- Ensure OpenAI key is set
- Check captions are enabled
- Wait 30+ seconds

**Meeting won't join:**
- Logged into Google?
- Try manual join first
- Check for UI changes

### Debug Commands

In browser console:
```javascript
// Check meeting state
window.postMessage({ 
  source: 'eliza-meet-content', 
  type: 'CHECK_MEETING_STATE' 
}, '*');

// Manually trigger join
window.postMessage({ 
  source: 'eliza-meet-content', 
  type: 'CLICK_JOIN_BUTTON' 
}, '*');
```

---

## Architecture Overview

### Extension Components

1. **manifest.json** - Extension configuration
2. **background.js** - Service worker, WebSocket connection
3. **content.js** - Runs on Meet pages
4. **inject.js** - Direct DOM access
5. **popup.html/js** - User interface

### Service Components

1. **ExtensionMeetService** - WebSocket server
2. **AudioTranscriptionService** - Whisper integration
3. **Actions** - join, leave, summarize, report
4. **Providers** - Meeting state context

### Data Flow

```
User Command → Agent → Action → Service → WebSocket → Extension → Google Meet
                                   ↓
                            Whisper API ← Audio Data
```

---

For more details, see the individual documentation files or the main [README.md](README.md). 