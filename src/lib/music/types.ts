export type VoiceGender = "MALE" | "FEMALE" | "INSTRUMENTAL";

export type MusicGenParams = {
  title: string;
  lyrics: string;
  style: string;
  voiceGender: VoiceGender;
  instrumental: boolean;
};

export type MusicGenStartResult = {
  providerJobId: string;
};

export type MusicGenStatusResult =
  | { status: "PROCESSING" }
  | {
      status: "COMPLETED";
      audioUrl?: string;
      localStorageKey?: string;
      durationSec?: number;
      sizeBytes?: number;
    }
  | { status: "FAILED"; error: string };

export interface MusicProvider {
  readonly name: string;
  start(params: MusicGenParams): Promise<MusicGenStartResult>;
  checkStatus(providerJobId: string): Promise<MusicGenStatusResult>;
}
