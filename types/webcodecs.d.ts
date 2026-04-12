// WebCodecs API 类型声明
// https://w3c.github.io/webcodecs/

interface AudioEncoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  bitrate?: number;
}

interface AudioEncoderInit {
  output: (chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void;
  error: (error: DOMException) => void;
}

interface EncodedAudioChunkMetadata {
  decoderConfig?: AudioDecoderConfig;
}

interface AudioDecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
}

interface AudioDataInit {
  format: AudioSampleFormat;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  timestamp: number;
  data: BufferSource;
}

type AudioSampleFormat =
  | 'u8'
  | 'u8-planar'
  | 's16'
  | 's16-planar'
  | 's32'
  | 's32-planar'
  | 'f32'
  | 'f32-planar';

declare class AudioEncoder {
  constructor(init: AudioEncoderInit);
  readonly queue: number;
  readonly state: 'unconfigured' | 'configured' | 'closed';
  configure(config: AudioEncoderConfig): Promise<void>;
  encode(data: AudioData): void;
  flush(): Promise<void>;
  close(): void;
  reset(): void;
  static isConfigSupported(config: AudioEncoderConfig): Promise<{ supported: boolean; config?: AudioEncoderConfig }>;
}

declare class AudioData {
  constructor(init: AudioDataInit);
  readonly format: AudioSampleFormat;
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly timestamp: number;
  readonly duration: number | null;
  copyTo(destination: BufferSource, options?: { planeIndex?: number; format?: AudioSampleFormat }): void;
  close(): void;
}

declare class EncodedAudioChunk {
  constructor(init: { type: 'key' | 'delta'; timestamp: number; data: BufferSource });
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;
  copyTo(destination: BufferSource): void;
}
