import {
  Action,
  IAgentRuntime,
  Memory,
  logger,
} from "@elizaos/core";
import { ExtensionMeetService } from "../services/extensionMeetService";

export const summarizeMeetingAction: Action = {
  name: "SUMMARIZE_MEETING",
  similes: ["MEETING_SUMMARY", "WHAT_HAPPENED_IN_MEETING", "MEETING_RECAP", "SUMMARIZE_DISCUSSION"],
  description: "Summarize the current meeting based on captured transcripts",
  
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const meetService = runtime.getService<ExtensionMeetService>("extension-meet");
    return !!meetService;
  },
  
  handler: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      const meetService = runtime.getService<ExtensionMeetService>("extension-meet");
      if (!meetService) {
        throw new Error("Google Meet service not available");
      }
      
      const currentMeeting = meetService.getCurrentMeeting();
      if (!currentMeeting) {
        return {
          success: false,
          message: "No active meeting to summarize. Join a meeting first."
        };
      }
      
      const transcripts = meetService.getTranscripts();
      if (transcripts.length === 0) {
        return {
          success: false,
          message: "No transcripts available yet. Enable closed captions in Google Meet or wait for audio transcription."
        };
      }
      
      // Get meeting stats
      const participants = meetService.getParticipants();
      const duration = Math.floor((Date.now() - currentMeeting.startTime.getTime()) / 1000 / 60);
      
      // Group transcripts by speaker
      const speakerMap = new Map<string, string[]>();
      transcripts.forEach(t => {
        if (!speakerMap.has(t.speakerName)) {
          speakerMap.set(t.speakerName, []);
        }
        speakerMap.get(t.speakerName)!.push(t.text);
      });
      
      // Get last 20 transcript entries for recent discussion
      const recentTranscripts = transcripts.slice(-20);
      const recentDiscussion = recentTranscripts
        .map(t => `${t.speakerName}: ${t.text}`)
        .join('\n');
      
      // Build summary
      const response = `📊 **Meeting Summary**

**Meeting URL:** ${currentMeeting.url}
**Duration:** ${duration} minutes
**Participants:** ${participants.length} people
${participants.slice(0, 5).map(p => `  • ${p.name}`).join('\n')}${participants.length > 5 ? `\n  • ... and ${participants.length - 5} more` : ''}

**Transcript Summary:**
- Total segments captured: ${transcripts.length}
- Speakers identified: ${speakerMap.size}

**Speaker Contributions:**
${Array.from(speakerMap.entries())
  .slice(0, 5)
  .map(([speaker, texts]) => `  • ${speaker}: ${texts.length} segments`)
  .join('\n')}

**Recent Discussion (last 20 segments):**
${recentDiscussion}

💡 **Tip:** To get better transcripts, ensure closed captions are enabled in Google Meet, or use the recording feature to capture audio for Whisper transcription.`;
      
      logger.info(`Generated meeting summary: ${duration} minutes, ${participants.length} participants, ${transcripts.length} transcripts`);
      
      return {
        success: true,
        message: response,
        data: {
          meetingId: currentMeeting.id,
          duration,
          participantCount: participants.length,
          transcriptCount: transcripts.length,
          speakerCount: speakerMap.size
        }
      };
      
    } catch (error) {
      logger.error("Failed to summarize meeting:", error);
      return {
        success: false,
        message: `Failed to summarize meeting: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
  
  examples: []
}; 