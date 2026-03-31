import { Router } from "express";
import { generateKeysForUser, getPublicBundle } from "../keys/keyManager";
import { encryptMessage } from "../crypto/encrypt";
import { decryptMessage } from "../crypto/decrypt";
import { backupUserState, restoreUserState, secureStorageStatus } from "../secureStorage/secureStorage";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Crypto service is running" });
});

router.post("/generate-keys", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  generateKeysForUser(userId);
  const bundle = getPublicBundle(userId);

  return res.json({
    userId,
    bundle,
  });
});

router.get("/bundle/:userId", (req, res) => {
  const { userId } = req.params;
  const bundle = getPublicBundle(userId);

  if (!bundle) {
    return res.status(404).json({ error: "Bundle not found for user" });
  }

  return res.json({
    userId,
    bundle,
  });
});

router.post("/encrypt", async (req, res) => {
  try {
    const result = await encryptMessage(req.body);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

router.post("/decrypt", async (req, res) => {
  try {
    const result = await decryptMessage(req.body);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

router.post("/secure-storage/backup", async (req, res) => {
  try {
    const { userId, pin } = req.body;
    if (!userId || !pin) {
      return res.status(400).json({ error: "userId and pin are required" });
    }

    const result = await backupUserState(userId, pin);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

router.post("/secure-storage/restore", async (req, res) => {
  try {
    const { userId, pin, encryptedState, salt, iv, authTag } = req.body;
    if (!userId || !pin || !encryptedState || !salt || !iv || !authTag) {
      return res.status(400).json({ error: "userId, pin, encryptedState, salt, iv, authTag are required" });
    }

    const result = await restoreUserState(userId, pin, encryptedState, salt, iv, authTag);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

router.get("/secure-storage/status/:userId", (_req, res) => {
  try {
    const { userId } = _req.params;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const result = secureStorageStatus(userId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

export default router;