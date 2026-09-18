import type {
  MusicGenParams,
  MusicGenStartResult,
  MusicGenStatusResult,
  MusicProvider,
} from "../types";

/**
 * Adapter for Suno-compatible third-party APIs (e.g. kie.ai, sunoapi.org,
 * goapi.ai) that proxy the real Suno models — the closest thing to native
 * Suno quality without an official Suno API.
 *
 * These vendors are unofficial wrappers and their exact JSON field names
 * drift between providers/versions. This adapter targets the common
 * "kie.ai Suno API" shape (POST /api/v1/generate -> { data: { taskId } },
 * GET /api/v1/generate/record-info?taskId=... -> { data: { status, response
 * : { sunoData: [{ audioUrl, duration }] } } }) and parses defensively with
 * fallbacks for slightly different vendor shapes. If you switch providers,
 * this is the one file to adjust — the rest of the app only talks to the
 * MusicProvider interface.
 */
export class SunoApiProvider implements MusicProvider {
  readonly name = "suno-api";

  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.baseUrl = (process.env.MUSIC_API_BASE_URL ?? "https://api.kie.ai").replace(/\/$/, "");
    this.apiKey = process.env.MUSIC_API_KEY ?? "";
    this.model = process.env.MUSIC_API_MODEL ?? "V4_5";

    if (!this.apiKey) {
      throw new Error(
        "MUSIC_API_KEY não configurada. Defina MUSIC_API_KEY (e opcionalmente MUSIC_API_BASE_URL/MUSIC_API_MODEL) no .env, ou use MUSIC_PROVIDER=mock para testar sem API real."
      );
    }
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async start(params: MusicGenParams): Promise<MusicGenStartResult> {
    const body = {
      customMode: true,
      instrumental: params.instrumental,
      title: params.title,
      style: [params.style, voiceGenderTag(params.voiceGender)].filter(Boolean).join(", "),
      prompt: params.instrumental ? undefined : params.lyrics,
      model: this.model,
    };

    const res = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Falha ao iniciar geração de música (${res.status}): ${text}`);
    }

    const json = await res.json();
    const taskId = json?.data?.taskId ?? json?.taskId ?? json?.data?.task_id;
    if (!taskId) {
      throw new Error(
        `Resposta inesperada da API de música, não encontrei taskId: ${JSON.stringify(json)}`
      );
    }

    return { providerJobId: String(taskId) };
  }

  async checkStatus(providerJobId: string): Promise<MusicGenStatusResult> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/generate/record-info?taskId=${encodeURIComponent(providerJobId)}`,
      { headers: this.headers() }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { status: "FAILED", error: `Erro ao consultar status (${res.status}): ${text}` };
    }

    const json = await res.json();
    const data = json?.data ?? json;
    const rawStatus = String(data?.status ?? "").toUpperCase();

    if (["FAILED", "ERROR", "CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED"].includes(rawStatus)) {
      return { status: "FAILED", error: data?.errorMessage ?? data?.msg ?? "Geração falhou" };
    }

    const tracks: Array<Record<string, unknown>> =
      data?.response?.sunoData ?? data?.sunoData ?? data?.tracks ?? [];

    const firstTrack = tracks[0];
    const audioUrl =
      (firstTrack?.audioUrl as string | undefined) ??
      (firstTrack?.audio_url as string | undefined);

    if (rawStatus === "SUCCESS" && audioUrl) {
      return {
        status: "COMPLETED",
        audioUrl,
        durationSec: (firstTrack?.duration as number | undefined) ?? undefined,
      };
    }

    if (rawStatus === "SUCCESS" && !audioUrl) {
      return { status: "FAILED", error: "Status SUCCESS mas nenhuma faixa de áudio retornada" };
    }

    return { status: "PROCESSING" };
  }
}

function voiceGenderTag(voiceGender: MusicGenParams["voiceGender"]) {
  if (voiceGender === "MALE") return "male vocal";
  if (voiceGender === "FEMALE") return "female vocal";
  return "";
}
