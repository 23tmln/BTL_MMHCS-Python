import path from "path";
import crypto from "crypto";
import { SessionRecord } from "../types";
import { readJsonFile, writeJsonFile } from "../utils/fileStore";

const SESSION_DIR = path.join(process.cwd(), "storage", "sessions");

function sessionFile(sessionId: string): string {
  return path.join(SESSION_DIR, `${sessionId}.json`);
}

function hashText(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function buildSessionId(from: string, to: string): string {
  return `${from}__${to}`;
}

export function createSession(from: string, to: string): SessionRecord {
  const sessionId = buildSessionId(from, to);

  const session: SessionRecord = {
    sessionId,
    from,
    to,
    rootKey: hashText(`${from}:${to}:root:${Date.now()}`),
    sendChainKey: hashText(`${from}:${to}:send:${Date.now()}`),
    receiveChainKey: hashText(`${from}:${to}:recv:${Date.now()}`),
    messageCount: 0
  };

  saveSession(session);
  return session;
}

export function loadSession(sessionId: string): SessionRecord | null {
  return readJsonFile<SessionRecord>(sessionFile(sessionId));
}

export function saveSession(session: SessionRecord): void {
  writeJsonFile(sessionFile(session.sessionId), session);
}

export function getOrCreateSession(from: string, to: string): SessionRecord {
  const sessionId = buildSessionId(from, to);
  const existing = loadSession(sessionId);

  if (existing) {
    return existing;
  }

  return createSession(from, to);
}