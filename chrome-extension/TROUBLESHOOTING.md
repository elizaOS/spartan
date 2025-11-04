# Troubleshooting Guide

## Chrome Extension Issues

### Extension Not Loading

**Problem:** Chrome shows "Could not load manifest" or similar errors

**Solution:**
1. Ensure all icon files exist in the extension directory
2. Check that manifest.json is valid JSON
3. Enable Developer Mode in Chrome extensions
4. Try removing and re-adding the extension

### Extension Not Connecting to ElizaOS

**Problem:** Extension shows "Disconnected" status

**Solutions:**
1. Verify ElizaOS is running (`npm start`)
2. Check WebSocket port matches (default: 8765)
3. Check for firewall blocking localhost connections
4. Try clicking "Connect" button manually
5. Check browser console for errors (F12)

### Meeting Not Auto-Joining

**Problem:** Extension opens meeting but doesn't click join

**Solutions:**
1. Increase the delay in `background.js` (default 3000ms)
2. Check if Google Meet UI has changed
3. Verify you're logged into Google account
4. Try manual join first time to handle any prompts

### No Transcripts Appearing

**Problem:** Meeting summary shows no transcripts

**Solutions:**
1. Ensure closed captions are enabled (extension should auto-enable)
2. Check OpenAI API key is set in .env
3. Verify speakers are unmuted and speaking
4. Check browser console for Whisper API errors
5. Wait 30+ seconds for first transcription batch

### Audio Not Being Captured

**Problem:** No audio data reaching transcription service

**Solutions:**
1. Grant microphone/audio permissions when prompted
2. For recording: Select "Share system audio" when prompted
3. Check Chrome site settings for meet.google.com
4. Try using closed captions as primary source

## Common Error Messages

### "Google Meet service not available"

This means the ExtensionMeetService isn't running. Check:
- ElizaOS started successfully
- No errors during plugin initialization
- WebSocket server started on correct port

### "No active meeting to summarize"

You need to join a meeting first:
```
"Join the meeting https://meet.google.com/xxx-xxxx-xxx"
```

### "Failed to transcribe audio"

Check:
- OpenAI API key is valid
- Not hitting API rate limits
- Audio data is being captured properly

## Performance Issues

### High CPU Usage

- Reduce transcription frequency: `AUDIO_CHUNK_DURATION_MS=60000`
- Disable real-time transcription if not needed
- Use closed captions only (disable Whisper)

### Extension Slowing Down Meet

- Check for console errors in browser
- Disable unused features in popup
- Restart Chrome if memory usage is high

## Getting Help

1. Check browser console (F12) for detailed errors
2. Review ElizaOS logs for service errors
3. Ensure all dependencies installed: `npm install --legacy-peer-deps`
4. Try the extension on a test meeting first

For additional support, please provide:
- Browser console errors
- ElizaOS terminal output
- Your .env configuration (without secrets)
- Steps to reproduce the issue 