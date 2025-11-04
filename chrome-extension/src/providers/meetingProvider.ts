import { Provider, IAgentRuntime, Memory, State, logger } from "@elizaos/core";
import { ExtensionMeetService } from "../services/extensionMeetService";

export const meetingProvider: Provider = {
  name: "google-meet-meeting",
  description: "Provides current Google Meet meeting context and status",

  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    try {
      const meetService = runtime.getService<ExtensionMeetService>("extension-meet");
      if (!meetService) {
        return { text: "" };
      }

      const currentMeeting = meetService.getCurrentMeeting();
      if (!currentMeeting) {
        return { text: "Not currently in a Google Meet meeting." };
      }

      const duration = Math.round(
        (Date.now() - currentMeeting.startTime.getTime()) / 60000,
      );
      const transcriptCount = currentMeeting.transcripts.length;
      const participantCount = currentMeeting.participants.length;

      const text = `Currently in Google Meet:
- Meeting ID: ${currentMeeting.id}
- URL: ${currentMeeting.url}
- Status: ${currentMeeting.status}
- Duration: ${duration} minutes
- Participants: ${participantCount}
- Transcripts collected: ${transcriptCount}`;

      return { text };
    } catch (error) {
      logger.error("Error in meeting provider:", error);
      return { text: "" };
    }
  },
};
