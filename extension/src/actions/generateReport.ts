import {
  Action,
  IAgentRuntime,
  Memory,
  logger,
  ModelType,
} from "@elizaos/core";
import { ExtensionMeetService } from "../services/extensionMeetService";
import { MeetingReport, Transcript } from "../types";
import fs from "fs/promises";
import path from "path";

export const generateReportAction: Action = {
  name: "GENERATE_MEETING_REPORT",
  description: "Generate a report/summary from a Google Meet meeting",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";

    // Check if message contains report generation intent
    const hasReportIntent = /generate|create|make|write|prepare/.test(text);
    const hasReportContext = /report|summary|notes|transcript|recap/.test(text);

    return hasReportIntent && hasReportContext;
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    try {
      // Get the Google Meet service
      const meetService = runtime.getService<ExtensionMeetService>("extension-meet");
      if (!meetService) {
        throw new Error("Google Meet service not available");
      }

      // Get current or most recent meeting
      let meeting = meetService.getCurrentMeeting();
      if (!meeting) {
        const allMeetings = meetService.getAllMeetings();
        if (allMeetings.length === 0) {
          return {
            success: false,
            error: "No meetings found to generate report from",
          };
        }
        // Use the most recent meeting
        meeting = allMeetings[allMeetings.length - 1];
      }

      const transcripts = meeting.transcripts;
      if (transcripts.length === 0) {
        return {
          success: false,
          error: "No transcripts available for this meeting",
        };
      }

      // Generate summary using LLM
      const summary = await generateSummary(runtime, transcripts);
      const keyPoints = await extractKeyPoints(runtime, transcripts);
      const actionItems = await extractActionItems(runtime, transcripts);

      // Create report
      const report: MeetingReport = {
        meetingId: meeting.id,
        title: meeting.title || "Google Meet Session",
        date: meeting.startTime,
        duration: meeting.endTime
          ? Math.round(
              (meeting.endTime.getTime() - meeting.startTime.getTime()) / 60000,
            )
          : Math.round((Date.now() - meeting.startTime.getTime()) / 60000),
        participants: [...new Set(meeting.participants.map((p) => p.name))],
        summary,
        keyPoints,
        actionItems,
        fullTranscript: transcripts,
      };

      // Save report to file
      const reportDir =
        runtime.getSetting("REPORT_OUTPUT_DIR") || "./meeting-reports";
      await fs.mkdir(reportDir, { recursive: true });

      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .split(".")[0];
      const filename = `meeting-report-${timestamp}.json`;
      const filepath = path.join(reportDir, filename);

      await fs.writeFile(filepath, JSON.stringify(report, null, 2));

      logger.info(`Meeting report saved to ${filepath}`);

      // Format response
      const response = formatReportResponse(report);

      return {
        success: true,
        data: {
          reportPath: filepath,
          report,
        },
        message: response,
      };
    } catch (error) {
      logger.error("Failed to generate report:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate report",
      };
    }
  },

  examples: [],

  similes: [
    "CREATE_MEETING_SUMMARY",
    "GENERATE_TRANSCRIPT",
    "MAKE_MEETING_NOTES",
    "PREPARE_RECAP",
  ],
};

// Helper functions

async function generateSummary(
  runtime: IAgentRuntime,
  transcripts: Transcript[],
): Promise<string> {
  const transcriptText = transcripts
    .map((t) => `${t.speakerName}: ${t.text}`)
    .join("\n");

  const prompt = `Generate a concise summary of this meeting transcript:

${transcriptText}

Provide a 2-3 paragraph summary highlighting the main discussion points and outcomes.`;

  const response = await runtime.useModel(ModelType.TEXT_LARGE, {
    prompt,
    temperature: 0.3,
    max_tokens: 500,
  });

  return response;
}

async function extractKeyPoints(
  runtime: IAgentRuntime,
  transcripts: Transcript[],
): Promise<string[]> {
  const transcriptText = transcripts
    .map((t) => `${t.speakerName}: ${t.text}`)
    .join("\n");

  const prompt = `Extract the key points from this meeting transcript:

${transcriptText}

List 3-5 most important points discussed in the meeting as bullet points.`;

  const response = await runtime.useModel(ModelType.TEXT_LARGE, {
    prompt,
    temperature: 0.2,
    max_tokens: 400,
  });

  // Parse bullet points from response
  return response
    .split("\n")
    .filter(
      (line) =>
        line.trim().startsWith("•") ||
        line.trim().startsWith("-") ||
        line.trim().startsWith("*"),
    )
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim());
}

async function extractActionItems(
  runtime: IAgentRuntime,
  transcripts: Transcript[],
): Promise<any[]> {
  const transcriptText = transcripts
    .map((t) => `${t.speakerName}: ${t.text}`)
    .join("\n");

  const prompt = `Extract action items from this meeting transcript:

${transcriptText}

Identify any tasks, follow-ups, or action items mentioned. For each, note:
- Description of the task
- Who it's assigned to (if mentioned)
- Due date (if mentioned)
- Priority (high/medium/low based on context)

Format as JSON array.`;

  const response = await runtime.useModel(ModelType.TEXT_LARGE, {
    prompt,
    temperature: 0.2,
    max_tokens: 600,
  });

  try {
    return JSON.parse(response);
  } catch {
    return [];
  }
}

function formatReportResponse(report: MeetingReport): string {
  return `📊 Meeting Report Generated

**Meeting:** ${report.title}
**Date:** ${report.date.toLocaleDateString()}
**Duration:** ${report.duration} minutes
**Participants:** ${report.participants.join(", ")}

**Summary:**
${report.summary}

**Key Points:**
${report.keyPoints.map((point) => `• ${point}`).join("\n")}

${
  report.actionItems.length > 0
    ? `**Action Items:**
${report.actionItems.map((item) => `• ${item.description}${item.assignee ? ` (Assigned to: ${item.assignee})` : ""}`).join("\n")}`
    : ""
}

The full report has been saved and includes the complete transcript.`;
}
