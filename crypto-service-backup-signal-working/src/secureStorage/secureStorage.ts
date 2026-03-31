import crypto from "crypto";
import fs from "fs";
import path from "path";
import { readJsonFile, writeJsonFile, ensureDir } from "../utils/fileStore";
import { identityFile, prekeyFile } from "../keys/keyManager";
import { SessionRecord } from "../types";

const SESSION_DIR = path.join(process.cwd(), "storage", "sessions");

function deriveKey(pin: string, salt: Buffer): Buffer {
  return crypto.scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
}

function encodeBase64(b: Buffer): string {
  return b.toString("base64");
}

function decodeBase64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

type StoredSessionJson = {
  fileName: string;
  address: string;
  session: string;
};

async function collectSessions(userId: string): Promise<StoredSessionJson[]> {
  ensureDir(SESSION_DIR);
  const files = fs.existsSync(SESSION_DIR) ? fs.readdirSync(SESSION_DIR) : [];

  const sessions: StoredSessionJson[] = [];

  for (const fileName of files) {
    if (!fileName.endsWith(".json")) {
      continue;
    }

    // Session files are named `{recipientUserId}__{deviceId}.json` from the sender's perspective.
    // When backing up for a given userId, include:
    //   - sessions where this user is the recipient (file name starts with userId)
    //   - sessions where address contains userId (this user is involved as sender)
    const fileNameWithoutExt = fileName.replace(".json", "");
    const sessionPath = path.join(SESSION_DIR, fileName);
    try {
      const record = readJsonFile<{ address: string; session: string }>(sessionPath);
      if (record && record.address && record.session) {
        // address format from libsignal: "userId.deviceId"
        // include session if either side is our userId
        const addressUserId = record.address.split(".")[0];
        const [fileRecipientId] = fileNameWithoutExt.split("__");
        if (addressUserId === userId || fileRecipientId === userId) {
          sessions.push({ fileName, address: record.address, session: record.session });
        }
      }
    } catch (error) {
      // might be old format from previous versions; ignore invalid or legacy
      console.warn(`Skipping invalid/legacy session file ${sessionPath}: ${error}`);
    }
  }

  return sessions;
}


export async function backupUserState(userId: string, pin: string) {
  const identity = readJsonFile(identityFile(userId));
  const prekeys = readJsonFile(prekeyFile(userId));

  if (!identity || !prekeys) {
    throw new Error("User identity or prekeys not found, run key generation first");
  }

  const sessions = await collectSessions(userId);

  const clearState = JSON.stringify({ identity, prekeys, sessions });

  const salt = crypto.randomBytes(16);
  const key = deriveKey(pin, salt);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(clearState, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedState: encodeBase64(encrypted),
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    authTag: encodeBase64(authTag),
    version: 1
  };
}

function writeSessionFile(session: SessionRecord): void {
  const targetFile = path.join(SESSION_DIR, `${session.sessionId}.json`);
  writeJsonFile(targetFile, session);
}

export async function restoreUserState(
  userId: string,
  pin: string,
  encryptedState: string,
  salt: string,
  iv: string,
  authTag: string
) {
  console.log("[restoreUserState] request", { userId, pin: pin ? "***" : "", encryptedState: encryptedState?.slice(0, 16) + "...", salt, iv, authTag });
  const key = deriveKey(pin, decodeBase64(salt));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, decodeBase64(iv));
  decipher.setAuthTag(decodeBase64(authTag));

  let plain: string;
  try {
    const decrypted = Buffer.concat([
      decipher.update(decodeBase64(encryptedState)),
      decipher.final()
    ]);
    plain = decrypted.toString("utf8");
  } catch (error) {
    console.error("[restoreUserState] decryption failed", error instanceof Error ? error.stack || error.message : error);
    throw new Error("Invalid PIN or encrypted data (auth failed)");
  }

  const state = JSON.parse(plain) as {
    identity: unknown;
    prekeys: unknown;
    sessions: StoredSessionJson[];
  };

  writeJsonFile(identityFile(userId), state.identity);
  writeJsonFile(prekeyFile(userId), state.prekeys);
  ensureDir(SESSION_DIR);

  for (const session of state.sessions || []) {
    if (!session.address || !session.session) {
      console.warn(`Skipping invalid session object during restore: ${JSON.stringify(session)}`);
      continue;
    }

    const targetFile = session.fileName
      ? path.join(SESSION_DIR, session.fileName)
      : path.join(SESSION_DIR, `${session.address.replace(/:/g, "__")}.json`);

    writeJsonFile(targetFile, {
      address: session.address,
      session: session.session,
    });
  }

  console.log("[restoreUserState] restored sessions", (state.sessions || []).length);
  return {
    message: "Restore complete"
  };
}

export function secureStorageStatus(userId: string): { exists: boolean } {
  const identityPath = identityFile(userId);
  const prekeyPath = prekeyFile(userId);
  const sessions = fs.existsSync(SESSION_DIR)
    ? fs.readdirSync(SESSION_DIR).some((f) => f.endsWith(".json") && f.includes(userId))
    : false;

  if (fs.existsSync(identityPath) && fs.existsSync(prekeyPath) && sessions) {
    return { exists: true };
  }

  return { exists: false };
}
