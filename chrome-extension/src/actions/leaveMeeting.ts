import { Action, IAgentRuntime, Memory, logger } from "@elizaos/core";
import { ExtensionMeetService } from "../services/extensionMeetService";

export const leaveMeetingAction: Action = {
  name: "LEAVE_GOOGLE_MEET",
  description: "Leave the current Google Meet meeting",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";

    // Check if message contains leave intent
    const hasLeaveIntent = /leave|exit|quit|end|stop|disconnect/.test(text);
    const hasMeetingContext = /meet|meeting|call/.test(text);

    return hasLeaveIntent && hasMeetingContext;
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      // Get the Google Meet service
      const meetService = runtime.getService<ExtensionMeetService>("extension-meet");
      if (!meetService) {
        throw new Error("Google Meet service not available");
      }

      // Check if currently in a meeting
      const currentMeeting = meetService.getCurrentMeeting();
      if (!currentMeeting) {
        return {
          success: false,
          error: "Not currently in a meeting",
        };
      }

      // Leave the meeting
      await meetService.leaveMeeting();

      logger.info("Successfully left meeting");

      return {
        success: true,
        message: `Left the Google Meet successfully. Meeting lasted ${Math.round((currentMeeting.endTime?.getTime() || Date.now() - currentMeeting.startTime.getTime()) / 60000)} minutes.`,
      };
    } catch (error) {
      logger.error("Failed to leave meeting:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to leave meeting",
      };
    }
  },

  examples: [],

  similes: ["EXIT_MEET", "QUIT_MEETING", "END_CALL", "DISCONNECT_MEET"],
};
