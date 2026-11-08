import { tr } from "../i18n";
import { backupJson, parseBackup, type Backup } from "./backup";
import type { Progress } from "./types";

/**
 * "Move to another device": the backup file, sent through Mempo's server instead of a file.
 * This device gzips the backup and uploads it (api/move.ts); the server keeps it for 10 minutes under an
 * 8-character code. The other device scans a QR code with the link (…/?move=CODE) or types the code in
 * Settings, downloads the backup and restores it after the usual confirmation.
 * A QR code alone can't hold the backup: it fits ~3 KB, a few hundred words at most.
 */

const API = "/api/move";
const PARAM = "move";
const CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export interface Sent {
  code: string;
  /** When the server forgets it (ms since 1970). */
  expires: number;
}

/** "k7m2 qx9d", "K7M2-QX9D", "K7M2QX9O" → "K7M2QX9D"-style code, or null. Reads O as 0 and I / L as 1, like Crockford base32. */
export function normalizeCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return CODE.test(code) ? code : null;
}

/** "K7M2QX9D" → "K7M2-QX9D", easier to read out and type. */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

export const moveLink = (code: string, origin = location.origin) => `${origin}/?${PARAM}=${code}`;

/** The code in this page's address (opened from a QR code), removed from the address so a reload doesn't ask again. Not checked yet. */
export function takeCodeFromUrl(): string | null {
  const url = new URL(location.href);
  const raw = url.searchParams.get(PARAM);
  if (raw === null) return null;
  url.searchParams.delete(PARAM);
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  return raw;
}

// ---------- gzip + base64 ----------

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const supportsMove = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

// ---------- server ----------

const offline = () => new Error(tr().move.offline);

async function request(url: string, init?: RequestInit): Promise<Response> {
  if (!navigator.onLine) throw offline();
  try {
    return await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw offline();
  }
}

/** The server's messages are in English; show ours, in the app's language. */
function errorOf(res: Response): Error {
  const t = tr().move;
  return new Error(res.status === 413 ? t.tooBig : res.status === 503 ? t.notSetUp : t.noServer);
}

/** Uploads this device's progress. Returns the code to show. */
export async function sendProgress(progress: Progress): Promise<Sent> {
  const data = toBase64(await gzip(backupJson(progress)));
  const res = await request(API, { method: "POST", headers: { "Content-Type": "text/plain" }, body: data });
  if (!res.ok) throw errorOf(res);
  const { code, expiresIn } = (await res.json()) as { code: string; expiresIn: number };
  return { code, expires: Date.now() + expiresIn * 1000 };
}

/** Downloads the progress for a code. Throws a readable message. */
export async function receiveProgress(code: string): Promise<Backup> {
  const res = await request(`${API}?code=${encodeURIComponent(code)}`);
  if (res.status === 404) throw new Error(tr().move.wrongCode);
  if (!res.ok) throw errorOf(res);
  const { data } = (await res.json()) as { data: string };
  let text: string;
  try {
    text = await gunzip(fromBase64(data));
  } catch {
    throw new Error(tr().move.broken);
  }
  return parseBackup(text);
}
