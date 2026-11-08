import { site } from "../config/site";
import { tr } from "../i18n";
import { toDay } from "./date";
import { normalizeProgress } from "./storage";
import type { Progress } from "./types";

/**
 * Backup file: { app: "mempo", version: 1, exportedAt, progress }.
 * `progress` has the same format as localStorage (PLAN.md section 2), so a backup is easy to read and edit.
 */
const VERSION = 1;

export interface Backup {
  progress: Progress;
  exportedAt?: string; // ISO time
  dropped: number; // broken cards or days that were skipped
}

export function backupFileName(day = toDay()): string {
  return `${site.storageKey}-backup-${day}.json`;
}

/** The backup file's contents. Also what "Move to another device" sends. */
export function backupJson(progress: Progress, space?: number): string {
  return JSON.stringify({ app: site.storageKey, version: VERSION, exportedAt: new Date().toISOString(), progress }, null, space);
}

export function downloadBackup(progress: Progress): void {
  const url = URL.createObjectURL(new Blob([backupJson(progress, 1)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Reads a backup file. Also accepts a bare progress object (what localStorage holds). Throws a readable message. */
export function parseBackup(text: string): Backup {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(tr().backup.notJson);
  }
  const wrapped = data?.app === site.storageKey && typeof data.progress === "object";
  if (wrapped && typeof data.version === "number" && data.version > VERSION) {
    throw new Error(tr().backup.newer);
  }
  const raw = wrapped ? data.progress : data;
  if (!raw || typeof raw !== "object" || typeof raw.cards !== "object" || raw.cards === null) {
    throw new Error(tr().backup.notOurs);
  }
  const { progress, dropped } = normalizeProgress(raw);
  return { progress, dropped, exportedAt: wrapped && typeof data.exportedAt === "string" ? data.exportedAt : undefined };
}
