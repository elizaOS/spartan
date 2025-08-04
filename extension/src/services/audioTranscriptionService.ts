import { IAgentRuntime, logger } from "@elizaos/core";
import OpenAI from "openai";
import { Transcript } from "../types";
import { v4 as uuidv4 } from "uuid";

export class AudioTranscriptionService {
  private openai: OpenAI | null = null;
  private runtime: IAgentRuntime;
  private audioBuffer: Float32Array[] = [];
  private isRecording = false;
  private transcriptionInterval: NodeJS.Timeout | null = null;
  
  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.initializeOpenAI();
  }
  
  private initializeOpenAI() {
    const apiKey = this.runtime.getSetting("OPENAI_API_KEY");
    if (!apiKey) {
      logger.warn("No OpenAI API key found - transcription disabled");
      return;
    }
    
    this.openai = new OpenAI({ apiKey });
    logger.info("OpenAI Whisper transcription service initialized");
  }
  
  startTranscription() {
    if (!this.openai) {
      logger.warn("Cannot start transcription - OpenAI not initialized");
      return;
    }
    
    this.isRecording = true;
    
    // Process audio buffer every 30 seconds
    this.transcriptionInterval = setInterval(() => {
      if (this.audioBuffer.length > 0) {
        this.processAudioBuffer();
      }
    }, 30000);
  }
  
  stopTranscription() {
    this.isRecording = false;
    
    if (this.transcriptionInterval) {
      clearInterval(this.transcriptionInterval);
      this.transcriptionInterval = null;
    }
    
    // Process remaining audio
    if (this.audioBuffer.length > 0) {
      this.processAudioBuffer();
    }
  }
  
  addAudioChunk(audioData: number[], sampleRate: number) {
    if (!this.isRecording || !this.openai) return;
    
    // Convert to Float32Array
    const float32Data = new Float32Array(audioData);
    this.audioBuffer.push(float32Data);
    
    // If buffer is getting large, process it
    const totalSamples = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    if (totalSamples > sampleRate * 60) { // 60 seconds of audio
      this.processAudioBuffer();
    }
  }
  
  private async processAudioBuffer() {
    if (this.audioBuffer.length === 0 || !this.openai) return;
    
    try {
      // Combine all chunks
      const totalLength = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedBuffer = new Float32Array(totalLength);
      let offset = 0;
      
      for (const chunk of this.audioBuffer) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Clear buffer
      this.audioBuffer = [];
      
      // Convert to WAV format
      const wavBuffer = this.float32ToWav(combinedBuffer, 16000); // Whisper prefers 16kHz
      
      // Create a Blob from the buffer
      const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      
      // Create a File object (required by OpenAI SDK)
      const audioFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });
      
      // Transcribe with Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en",
        response_format: "verbose_json",
        timestamp_granularities: ["segment", "word"]
      });
      
      // Process transcription segments
      const transcripts: Transcript[] = [];
      
      if (transcription.segments) {
        for (const segment of transcription.segments) {
          transcripts.push({
            id: uuidv4(),
            speakerName: "Speaker", // Whisper doesn't do speaker diarization
            speakerId: "unknown",
            text: segment.text.trim(),
            timestamp: new Date(),
            confidence: segment.avg_logprob ? Math.exp(segment.avg_logprob) : 0.9,
            startTime: segment.start,
            endTime: segment.end
          });
        }
      }
      
      logger.info(`Transcribed ${transcripts.length} segments from audio`);
      
      // Return transcripts for further processing
      return transcripts;
      
    } catch (error) {
      logger.error("Failed to transcribe audio:", error);
      return [];
    }
  }
  
  // Convert Float32Array to WAV format
  private float32ToWav(buffer: Float32Array, sampleRate: number): ArrayBuffer {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float32 to int16
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return arrayBuffer;
  }
  
  // Transcribe audio file directly (for recordings)
  async transcribeAudioFile(audioData: Buffer | ArrayBuffer, mimeType: string): Promise<Transcript[]> {
    if (!this.openai) {
      logger.warn("Cannot transcribe - OpenAI not initialized");
      return [];
    }
    
    try {
      // Create a File object
      const audioFile = new File([audioData], 'recording.webm', { type: mimeType });
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"]
      });
      
      const transcripts: Transcript[] = [];
      
      if (transcription.segments) {
        for (const segment of transcription.segments) {
          transcripts.push({
            id: uuidv4(),
            speakerName: "Speaker",
            speakerId: "unknown",
            text: segment.text.trim(),
            timestamp: new Date(),
            confidence: segment.avg_logprob ? Math.exp(segment.avg_logprob) : 0.9,
            startTime: segment.start,
            endTime: segment.end
          });
        }
      }
      
      return transcripts;
      
    } catch (error) {
      logger.error("Failed to transcribe audio file:", error);
      return [];
    }
  }
} 