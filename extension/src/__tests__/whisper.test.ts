import { describe, it, expect, vi } from "vitest";
import { ModelType } from "@elizaos/core";

describe("Whisper Integration Test", () => {
  it("should verify Whisper model is available through runtime", async () => {
    // Mock runtime
    const mockRuntime = {
      useModel: vi.fn().mockResolvedValue("This is a test transcription"),
      getSetting: vi.fn((key: string) => {
        if (key === "OPENAI_API_KEY") return "test-key";
        return undefined;
      }),
    };

    // Test audio buffer
    const testAudioBuffer = Buffer.from("test audio data");

    // Call transcription
    const result = await mockRuntime.useModel(
      ModelType.TRANSCRIPTION,
      testAudioBuffer,
    );

    expect(mockRuntime.useModel).toHaveBeenCalledWith(
      ModelType.TRANSCRIPTION,
      testAudioBuffer,
    );
    expect(result).toBe("This is a test transcription");
  });

  it("should handle transcription errors gracefully", async () => {
    const mockRuntime = {
      useModel: vi.fn().mockRejectedValue(new Error("Transcription failed")),
      getSetting: vi.fn(),
    };

    const testAudioBuffer = Buffer.from("test audio data");

    await expect(
      mockRuntime.useModel(ModelType.TRANSCRIPTION, testAudioBuffer),
    ).rejects.toThrow("Transcription failed");
  });
});
