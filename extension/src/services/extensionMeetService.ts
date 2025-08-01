import { Service, IAgentRuntime, logger } from "@elizaos/core";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import { Meeting, MeetingStatus, Participant, Transcript } from "../types";
import { AudioTranscriptionService } from "./audioTranscriptionService";

export class ExtensionMeetService extends Service {
  static serviceType = "extension-meet" as const;
  
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private meetings: Map<string, Meeting> = new Map();
  private currentMeeting: Meeting | null = null;
  private wsPort = 8765;
  private transcriptionService: AudioTranscriptionService;
  
  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.transcriptionService = new AudioTranscriptionService(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    logger.info("Starting Extension Meet Service");
    const service = new ExtensionMeetService(runtime);
    await service.initialize();
    return service;
  }
  
  async initialize(): Promise<void> {
    // Get port from settings
    this.wsPort = parseInt(this.runtime.getSetting("EXTENSION_WS_PORT") || "8765");
    
    // Start WebSocket server
    this.wss = new WebSocket.Server({ 
      port: this.wsPort,
      clientTracking: true 
    });
    
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = uuidv4();
      this.clients.set(clientId, ws);
      
      logger.info(`Chrome extension connected: ${clientId}`);
      
      // Send initial status
      ws.send(JSON.stringify({
        type: 'CONNECTION_ESTABLISHED',
        clientId: clientId
      }));
      
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleExtensionMessage(clientId, message);
        } catch (error) {
          logger.error('Failed to parse message:', error);
        }
      });
      
      ws.on('close', () => {
        logger.info(`Chrome extension disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });
      
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
      });
    });
    
    logger.info(`Extension Meet Service WebSocket server listening on port ${this.wsPort}`);
  }
  
  private handleExtensionMessage(clientId: string, message: any) {
    logger.debug(`Message from extension ${clientId}:`, message);
    
    switch (message.type) {
      case 'MEETING_JOINED':
        this.handleMeetingJoined(message);
        break;
        
      case 'MEETING_LEFT':
        this.handleMeetingLeft(message);
        break;
        
      case 'PARTICIPANT_JOINED':
        this.handleParticipantJoined(message);
        break;
        
      case 'PARTICIPANT_LEFT':
        this.handleParticipantLeft(message);
        break;
        
      case 'TRANSCRIPT':
        this.handleTranscript(message);
        break;
        
      case 'AUDIO_CHUNK':
        this.handleAudioChunk(message);
        break;
        
      case 'RECORDING_COMPLETE':
        this.handleRecordingComplete(message);
        break;
        
      case 'STATUS_UPDATE':
        this.handleStatusUpdate(message);
        break;
    }
  }
  
  private handleMeetingJoined(message: any) {
    const meeting: Meeting = {
      id: message.meetingId,
      url: message.meetingUrl,
      startTime: new Date(message.timestamp),
      participants: [],
      transcripts: [],
      status: "joined" as MeetingStatus
    };
    
    this.meetings.set(meeting.id, meeting);
    this.currentMeeting = meeting;
    
    logger.info(`Joined meeting: ${meeting.id}`);
  }
  
  private handleMeetingLeft(message: any) {
    if (this.currentMeeting && this.currentMeeting.id === message.meetingId) {
      this.currentMeeting.endTime = new Date(message.timestamp);
      this.currentMeeting.status = "ended" as MeetingStatus;
      this.currentMeeting = null;
      
      logger.info(`Left meeting: ${message.meetingId}`);
    }
  }
  
  private handleParticipantJoined(message: any) {
    if (!this.currentMeeting) return;
    
    const participant: Participant = {
      id: message.participant.id,
      name: message.participant.name,
      joinTime: new Date(message.timestamp),
      isSpeaking: false
    };
    
    this.currentMeeting.participants.push(participant);
    logger.info(`Participant joined: ${participant.name}`);
  }
  
  private handleParticipantLeft(message: any) {
    if (!this.currentMeeting) return;
    
    const index = this.currentMeeting.participants.findIndex(
      p => p.id === message.participant.id
    );
    
    if (index !== -1) {
      const participant = this.currentMeeting.participants[index];
      participant.leaveTime = new Date(message.timestamp);
      logger.info(`Participant left: ${participant.name}`);
    }
  }
  
  private handleTranscript(message: any) {
    if (!this.currentMeeting) return;
    
    const transcript: Transcript = {
      id: uuidv4(),
      speakerName: message.speaker,
      speakerId: message.speaker,
      text: message.text,
      timestamp: new Date(message.timestamp),
      confidence: 1.0
    };
    
    this.currentMeeting.transcripts.push(transcript);
    logger.debug(`Transcript: ${message.speaker}: ${message.text}`);
  }
  
  private async handleAudioChunk(message: any) {
    // Process audio data for transcription
    if (this.currentMeeting) {
      this.transcriptionService.addAudioChunk(message.data, message.sampleRate);
    }
    
    logger.debug(`Received audio chunk: ${message.data.length} samples at ${message.sampleRate}Hz`);
  }
  
  private async handleRecordingComplete(message: any) {
    logger.info(`Recording complete: ${message.mimeType}`);
    
    if (this.currentMeeting && message.data) {
      try {
        // Decode base64 data
        const base64Data = message.data.split(',')[1]; // Remove data:audio/webm;base64,
        const audioBuffer = Buffer.from(base64Data, 'base64');
        
        // Transcribe the recording
        const transcripts = await this.transcriptionService.transcribeAudioFile(
          audioBuffer,
          message.mimeType
        );
        
        // Add transcripts to current meeting
        if (transcripts.length > 0) {
          this.currentMeeting.transcripts.push(...transcripts);
          logger.info(`Added ${transcripts.length} transcripts from recording`);
          
          // Create memory for important parts
          await this.createMeetingMemories(transcripts);
        }
      } catch (error) {
        logger.error("Failed to process recording:", error);
      }
    }
  }
  
  private async createMeetingMemories(transcripts: Transcript[]) {
    // Store important transcript segments for later processing
    // The summarize_meeting action will handle creating proper memories
    logger.info(`Storing ${transcripts.length} transcript segments for meeting ${this.currentMeeting?.id}`);
  }
  
  private handleStatusUpdate(message: any) {
    logger.debug(`Status update:`, message);
  }
  
  // Public methods for ElizaOS to control meetings
  
  async joinMeeting(meetingUrl: string, displayName?: string): Promise<Meeting> {
    this.broadcast({
      action: 'JOIN_MEETING',
      meetingUrl: meetingUrl,
      displayName: displayName
    });
    
    // Start transcription when joining
    this.transcriptionService.startTranscription();
    
    // Wait for meeting to be joined
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for meeting to join'));
      }, 30000);
      
      const checkInterval = setInterval(() => {
        if (this.currentMeeting && this.currentMeeting.url === meetingUrl) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(this.currentMeeting);
        }
      }, 1000);
    });
  }
  
  async leaveMeeting(): Promise<void> {
    if (!this.currentMeeting) {
      throw new Error('Not in a meeting');
    }
    
    // Stop transcription
    this.transcriptionService.stopTranscription();
    
    this.broadcast({
      action: 'LEAVE_MEETING'
    });
  }
  
  async muteMicrophone(): Promise<void> {
    this.broadcast({
      action: 'MUTE_MICROPHONE'
    });
  }
  
  async unmuteMicrophone(): Promise<void> {
    this.broadcast({
      action: 'UNMUTE_MICROPHONE'
    });
  }
  
  async turnOffCamera(): Promise<void> {
    this.broadcast({
      action: 'TURN_OFF_CAMERA'
    });
  }
  
  async turnOnCamera(): Promise<void> {
    this.broadcast({
      action: 'TURN_ON_CAMERA'
    });
  }
  
  async startRecording(): Promise<void> {
    this.broadcast({
      action: 'START_RECORDING'
    });
  }
  
  async stopRecording(): Promise<void> {
    this.broadcast({
      action: 'STOP_RECORDING'
    });
  }
  
  getCurrentMeeting(): Meeting | null {
    return this.currentMeeting;
  }
  
  getAllMeetings(): Meeting[] {
    return Array.from(this.meetings.values());
  }
  
  getParticipants(): Participant[] {
    return this.currentMeeting?.participants || [];
  }
  
  getTranscripts(): Transcript[] {
    return this.currentMeeting?.transcripts || [];
  }
  
  // Broadcast message to all connected extensions
  private broadcast(message: any) {
    const data = JSON.stringify(message);
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }
  
  // Get meeting summary
  async getMeetingSummary(): Promise<string> {
    if (!this.currentMeeting) {
      return "No active meeting.";
    }
    
    const transcripts = this.currentMeeting.transcripts;
    if (transcripts.length === 0) {
      return "No transcripts available yet.";
    }
    
    // Get recent transcripts (last 10)
    const recentTranscripts = transcripts.slice(-10);
    const content = recentTranscripts
      .map(t => `${t.speakerName}: ${t.text}`)
      .join("\n");
    
    const participantCount = this.currentMeeting.participants.length;
    const duration = Math.floor(
      (Date.now() - this.currentMeeting.startTime.getTime()) / 1000 / 60
    );
    
    return `Meeting Summary:
- Participants: ${participantCount}
- Duration: ${duration} minutes
- Recent discussion:
${content}`;
  }
  
  // Cleanup
  async stop(): Promise<void> {
    if (this.wss) {
      // Close all client connections
      this.clients.forEach((ws) => {
        ws.close();
      });
      this.clients.clear();
      
      // Close server
      this.wss.close();
      this.wss = null;
    }
  }
  
  // Required property
  capabilityDescription = "Google Meet automation via Chrome extension with WebSocket communication";
} 