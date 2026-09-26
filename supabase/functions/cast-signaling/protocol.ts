// Pure, dependency-free protocol helpers (unit-tested with Deno + Vitest).

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars → no modulo bias on a byte

export function generatePairingCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b & 31];
  return out;
}

export function generateReceiverSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isSafeMediaUrl(u: string): boolean {
  if (u.length > 4096) return false;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || (p.protocol === "http:" && (p.hostname === "localhost" || p.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export type CommandResult =
  | { ok: true; command: string; bump: boolean; patch: Record<string, unknown> }
  | { ok: false; error: string };

export function validateCommand(command: unknown, payload: unknown): CommandResult {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  switch (command) {
    case "LOAD": {
      const videoUrl = str(p.videoUrl ?? p.url, 4096);
      if (!videoUrl) return { ok: false, error: "LOAD requires videoUrl" };
      const startTime = num(p.startTime ?? 0, 0, 172800) ?? 0;
      const title = str(p.title, 300) ?? "";
      return {
        ok: true, command: "LOAD", bump: true,
        patch: {
          status: "active", video_url: videoUrl, video_title: title,
          video_thumbnail: str(p.thumbnail, 2048), playback_time: startTime,
          video_duration: num(p.duration ?? 0, 0, 172800) ?? 0, is_playing: true,
          command_payload: { videoUrl, title, startTime },
        },
      };
    }
    case "PLAY":
      return { ok: true, command: "PLAY", bump: true, patch: { is_playing: true, command_payload: {} } };
    case "PAUSE":
      return { ok: true, command: "PAUSE", bump: true, patch: { is_playing: false, command_payload: {} } };
    case "SEEK": {
      const time = num(p.time, 0, 172800);
      if (time === null) return { ok: false, error: "SEEK requires valid time" };
      return { ok: true, command: "SEEK", bump: true, patch: { playback_time: time, command_payload: { time } } };
    }
    case "VOLUME": {
      const volume = num(p.volume, 0, 100);
      if (volume === null) return { ok: false, error: "VOLUME requires 0-100" };
      return { ok: true, command: "VOLUME", bump: true, patch: { volume_level: Math.round(volume), command_payload: { volume } } };
    }
    case "STOP":
      return {
        ok: true, command: "STOP", bump: true,
        patch: { is_playing: false, video_url: null, video_title: null, playback_time: 0, command_payload: {} },
      };
    case "UPDATE_QUEUE": {
      if (!Array.isArray(p.queue) || p.queue.length > 50) return { ok: false, error: "queue must be ≤50 items" };
      const queue = p.queue.map((q: any) => ({
        id: str(q?.id, 100), url: str(q?.url, 4096), title: str(q?.title, 300), thumbnail: str(q?.thumbnail, 2048),
      }));
      return { ok: true, command: "UPDATE_QUEUE", bump: true, patch: { queue, command_payload: { queueLength: queue.length } } };
    }
    default:
      return { ok: false, error: "Unknown command" };
  }
}
