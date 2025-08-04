import { z } from "zod";

// Configuration schema
export const googleMeetConfigSchema = z.object({
  TRANSCRIPTION_LANGUAGE: z.string().default("en"),
  REPORT_OUTPUT_DIR: z.string().default("./meeting-reports"),
  ENABLE_REAL_TIME_TRANSCRIPTION: z.union([z.boolean(), z.string()]).transform(val => 
    typeof val === 'string' ? val === 'true' : val
  ).default(true),
  AUDIO_CHUNK_DURATION_MS: z.union([z.number(), z.string()]).transform(val => 
    typeof val === 'string' ? parseInt(val, 10) : val
  ).default(30000), // 30 seconds chunks for Whisper
});

export type GoogleMeetConfig = z.infer<typeof googleMeetConfigSchema>;

// Meeting types
export interface Meeting {
  id: string;
  url: string;
  title?: string;
  startTime: Date;
  endTime?: Date;
  participants: Participant[];
  transcripts: Transcript[];
  status: MeetingStatus;
}

export interface Participant {
  id: string;
  name: string;
  joinTime: Date;
  leaveTime?: Date;
  isSpeaking: boolean;
}

export interface Transcript {
  id: string;
  speakerName: string;
  speakerId: string;
  text: string;
  timestamp: Date;
  confidence: number;
  startTime?: number; // Start time in seconds
  endTime?: number;   // End time in seconds
}

export type MeetingStatus = "waiting" | "joined" | "active" | "ended" | "error";

// Audio streaming types
export interface AudioChunk {
  data: Buffer;
  timestamp: Date;
  speakerId?: string;
}

// Report types
export interface MeetingReport {
  meetingId: string;
  title: string;
  date: Date;
  duration: number; // in minutes
  participants: string[];
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  fullTranscript: Transcript[];
}

export interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: Date;
  priority: "low" | "medium" | "high";
}

// Service state
export interface ExtensionMeetServiceState {
  currentMeeting?: Meeting;
  isRecording: boolean;
  isConnected: boolean;
  activeClients: number;
}

// Action parameters
export interface JoinMeetingParams {
  meetingUrl: string;
  displayName?: string;
}

export interface GenerateReportParams {
  meetingId: string;
  includeSummary?: boolean;
  includeActionItems?: boolean;
}
