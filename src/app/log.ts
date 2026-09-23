import { reactive } from "vue";

export type LogLevel = "info" | "success" | "warn" | "error" | "device" | "command";

export interface LogEntry {
  id: number;
  time: Date;
  level: LogLevel;
  text: string;
}

const MAX_ENTRIES = 2000;
let nextId = 0;

export const logs = reactive<LogEntry[]>([]);

export function log(level: LogLevel, text: string): void {
  logs.push({ id: nextId++, time: new Date(), level, text });
  if (logs.length > MAX_ENTRIES) logs.splice(0, logs.length - MAX_ENTRIES);
}

export function clearLogs(): void {
  logs.splice(0);
}

export function formatLogs(): string {
  return logs.map((e) => `${e.time.toISOString()} [${e.level}] ${e.text}`).join("\n");
}
