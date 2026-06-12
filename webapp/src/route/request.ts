import { ENDPOINTS } from "./config";
import type { MediaRecord } from "../shared/types/media.types";
import type { UploadStatus } from "../shared/types/upload.types";

export class UnauthorizedError extends Error {}

export const fetchMediaList = async (token: string): Promise<MediaRecord[]> => {
  const res = await fetch(ENDPOINTS.media, {
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error("Network error");
  return (await res.json()) ?? [];
};

export interface UploadResult {
  status: UploadStatus;
  error?: string;
  duplicate?: string;
  unauthorized?: boolean;
}

const CHUNK_SIZE = 16 * 1024 * 1024;
const MAX_RETRIES = 6;
const CHUNK_TIMEOUT = 10 * 60 * 1000;

const ERROR_MESSAGES: Record<string, string> = {
  "Not allowed media format": "Format not supported",
  "File size exceeds limit or invalid form": "File too large (max 10 GB)",
  "Invalid form": "Invalid file",
  "Error processing file": "Could not process file",
};

const bearer = (token: string) => `Bearer ${token.trim()}`;
const friendly = (msg: string) => ERROR_MESSAGES[msg] ?? msg ?? "Upload failed";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface InitResponse {
  uploadId: string;
  offset: number;
}

const initUpload = async (
  file: File,
  token: string,
): Promise<InitResponse | UploadResult> => {
  const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
  let res: Response;
  try {
    res = await fetch(ENDPOINTS.uploadInit, {
      method: "POST",
      headers: {
        Authorization: bearer(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename: file.name, size: file.size, fingerprint }),
    });
  } catch {
    return { status: "error", error: "No connection" };
  }

  if (res.status === 401)
    return { status: "error", error: "Session expired", unauthorized: true };
  if (res.status === 400)
    return { status: "error", error: friendly((await res.text()).trim()) };
  if (!res.ok) return { status: "error", error: "Server error — try again" };

  const data = await res.json();
  return { uploadId: data.uploadId, offset: data.offset ?? 0 };
};

const headOffset = async (
  uploadId: string,
  token: string,
): Promise<number | null> => {
  try {
    const res = await fetch(ENDPOINTS.uploadSession(uploadId), {
      method: "HEAD",
      headers: { Authorization: bearer(token) },
    });
    if (!res.ok) return null;
    const offset = res.headers.get("Upload-Offset");
    return offset === null ? null : Number(offset);
  } catch {
    return null;
  }
};

type ChunkOutcome =
  | { kind: "progress"; offset: number }
  | { kind: "mismatch"; offset: number }
  | { kind: "final"; result: UploadResult }
  | { kind: "error"; result: UploadResult }
  | { kind: "retry" };

const sendChunk = (
  uploadId: string,
  offset: number,
  chunk: Blob,
  token: string,
  onLoaded: (loaded: number) => void,
): Promise<ChunkOutcome> =>
  new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded);
    };
    xhr.onload = () => {
      const status = xhr.status;
      if (status === 204) {
        resolve({
          kind: "progress",
          offset: Number(xhr.getResponseHeader("Upload-Offset")),
        });
      } else if (status === 201) {
        resolve({ kind: "final", result: { status: "done" } });
      } else if (status === 409) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve({
            kind: "final",
            result: { status: "duplicate", duplicate: json.existing ?? "unknown" },
          });
        } catch {
          resolve({ kind: "final", result: { status: "duplicate" } });
        }
      } else if (status === 412) {
        resolve({
          kind: "mismatch",
          offset: Number(xhr.getResponseHeader("Upload-Offset")),
        });
      } else if (status === 401) {
        resolve({
          kind: "error",
          result: { status: "error", error: "Session expired", unauthorized: true },
        });
      } else if (status === 400) {
        resolve({
          kind: "error",
          result: { status: "error", error: friendly(xhr.responseText.trim()) },
        });
      } else if (status === 0 || status >= 500) {
        resolve({ kind: "retry" });
      } else {
        resolve({
          kind: "error",
          result: { status: "error", error: `Unexpected error (${status})` },
        });
      }
    };
    xhr.onerror = () => resolve({ kind: "retry" });
    xhr.ontimeout = () => resolve({ kind: "retry" });

    xhr.open("PATCH", ENDPOINTS.uploadSession(uploadId));
    xhr.setRequestHeader("Authorization", bearer(token));
    xhr.setRequestHeader("Upload-Offset", String(offset));
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.timeout = CHUNK_TIMEOUT;
    xhr.send(chunk);
  });

export const uploadMedia = async (
  file: File,
  token: string,
  onProgress: (pct: number) => void,
): Promise<UploadResult> => {
  const init = await initUpload(file, token);
  if ("status" in init) return init;

  const { uploadId } = init;
  let offset = init.offset;
  let retries = 0;

  if (offset > 0) onProgress(Math.round((offset / file.size) * 100));

  while (offset < file.size) {
    const base = offset;
    const chunk = file.slice(base, Math.min(base + CHUNK_SIZE, file.size));
    const outcome = await sendChunk(uploadId, base, chunk, token, (loaded) =>
      onProgress(Math.round(((base + loaded) / file.size) * 100)),
    );

    if (outcome.kind === "final" || outcome.kind === "error")
      return outcome.result;
    if (outcome.kind === "progress" || outcome.kind === "mismatch") {
      offset = outcome.offset;
      retries = 0;
      continue;
    }

    if (++retries > MAX_RETRIES)
      return { status: "error", error: "Connection lost — tap to retry" };
    await delay(Math.min(1000 * 2 ** retries, 15000));
    const synced = await headOffset(uploadId, token);
    if (synced !== null) offset = synced;
  }

  return { status: "error", error: "Upload finished without confirmation" };
};
