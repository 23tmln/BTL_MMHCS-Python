import {
  KeyHelper,
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
  EncryptionResultMessageType,
  setWebCrypto,
  setCurve,
} from "@privacyresearch/libsignal-protocol-typescript";

import { Curve25519Wrapper } from "@privacyresearch/curve25519-typescript";

import { getKey, saveKey, getSession, saveSession, getAllKeys, getAllSessions, restoreKeys, restoreSessions, getAllCachedMessages, restoreCachedMessages } from "./secureStore.js";

// ⚠️ REQUIRED: Initialize Web Crypto API and real Curve25519 implementation
// This MUST run before any crypto operations. We initialize lazily on first use.
let _initialized = false;
let _curve = null;

async function initSignal() {
  if (_initialized) return;
  _curve = await Curve25519Wrapper.create();
  setWebCrypto(window.crypto);
  setCurve(_curve);
  _initialized = true;
  console.log("[E2EE] Signal protocol initialized with Curve25519Wrapper");
}

// --- UTILS --- //

export function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert a binary string (raw bytes) to base64
export function binaryStringToBase64(binaryStr) {
  return window.btoa(binaryStr);
}

// Convert base64 back to binary string
export function base64ToBinaryString(b64) {
  return window.atob(b64);
}

// --- SIGNAL STORE INTERFACE --- //

export class BrowserSignalProtocolStore {
  constructor(userId) {
    this.userId = userId;
  }

  /* Identity */
  async getIdentityKeyPair() {
    const data = await getKey(this.userId);
    if (!data || !data.identityPrivateKey || !data.identityPublicKey) return undefined;
    return {
      privKey: base64ToArrayBuffer(data.identityPrivateKey),
      pubKey: base64ToArrayBuffer(data.identityPublicKey),
    };
  }

  async getLocalRegistrationId() {
    const data = await getKey(this.userId);
    if (!data) return undefined;
    return data.registrationId;
  }

  async saveIdentity(identifier, identityKey) {
    return true;
  }

  async isTrustedIdentity(identifier, identityKey, direction) {
    return true;
  }

  async loadIdentityKey(identifier) {
    return undefined;
  }

  /* PreKeys */
  async storePreKey(keyId, keyPair) {
    const keyStr = `${this.userId}_prekey_${keyId}`;
    await saveKey(keyStr, {
      privKey: arrayBufferToBase64(keyPair.privKey),
      pubKey: arrayBufferToBase64(keyPair.pubKey),
    });
  }

  async loadPreKey(keyId) {
    const keyStr = `${this.userId}_prekey_${keyId}`;
    const data = await getKey(keyStr);
    if (!data) return undefined;
    return {
      privKey: base64ToArrayBuffer(data.privKey),
      pubKey: base64ToArrayBuffer(data.pubKey),
    };
  }

  async removePreKey(keyId) {
    const keyStr = `${this.userId}_prekey_${keyId}`;
    await saveKey(keyStr, null);
  }

  /* Signed PreKeys */
  async storeSignedPreKey(keyId, keyPair) {
    const keyStr = `${this.userId}_signed_prekey_${keyId}`;
    await saveKey(keyStr, {
      privKey: arrayBufferToBase64(keyPair.privKey),
      pubKey: arrayBufferToBase64(keyPair.pubKey),
    });
  }

  async loadSignedPreKey(keyId) {
    const keyStr = `${this.userId}_signed_prekey_${keyId}`;
    const data = await getKey(keyStr);
    if (!data) return undefined;
    return {
      privKey: base64ToArrayBuffer(data.privKey),
      pubKey: base64ToArrayBuffer(data.pubKey),
    };
  }

  async removeSignedPreKey(keyId) {
    const keyStr = `${this.userId}_signed_prekey_${keyId}`;
    await saveKey(keyStr, null);
  }

  /* Sessions — store as raw string (libsignal uses record strings internally) */
  async loadSession(identifier) {
    const data = await getSession(identifier);
    return data || undefined;
  }

  async storeSession(identifier, record) {
    await saveSession(identifier, record);
  }

  async removeSession(identifier) {
    await saveSession(identifier, null);
  }

  async removeAllSessions(identifier) {
    await saveSession(identifier, null);
  }
}

// --- KEY GENERATION & UPLOAD --- //

export async function hasKeysForUser(userId) {
  const data = await getKey(userId);
  return !!data;
}

/**
 * Export the FULL private bundle (all keys + all sessions + message plaintext cache) for backup.
 * Returns a plain JS object safe to JSON.stringify and then encrypt.
 * The message cache is what allows old messages to be readable after restore,
 * similar to how Zalo/WhatsApp cloud backups work.
 */
export async function exportFullPrivateBundle(userId) {
  await initSignal();
  const keys = await getAllKeys();
  const sessions = await getAllSessions();
  const messageCache = await getAllCachedMessages();
  return { userId, keys, sessions, messageCache, exportedAt: Date.now() };
}

/**
 * Import (restore) a full private bundle from backup.
 * Keys and sessions are replaced. Message cache is MERGED (not replaced)
 * so messages decrypted after the backup was taken are preserved.
 */
export async function importFullPrivateBundle(bundle) {
  await initSignal();
  if (bundle.keys) await restoreKeys(bundle.keys);
  if (bundle.sessions) await restoreSessions(bundle.sessions);
  // Merge message cache — don't overwrite newer cached messages
  if (bundle.messageCache) await restoreCachedMessages(bundle.messageCache);
  console.log("[E2EE] Full private bundle restored from backup (keys + sessions + message cache)");
}

export async function generateKeysForUser(userId) {
  await initSignal();
  const registrationId = KeyHelper.generateRegistrationId();
  const identityKeyPair = await KeyHelper.generateIdentityKeyPair();

  const signedPreKeyId = 1;
  const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId);

  const oneTimePreKeyId = 1;
  const oneTimePreKey = await KeyHelper.generatePreKey(oneTimePreKeyId);

  const deviceId = 1;

  // Save identity
  await saveKey(userId, {
    userId,
    registrationId,
    deviceId,
    identityPrivateKey: arrayBufferToBase64(identityKeyPair.privKey),
    identityPublicKey: arrayBufferToBase64(identityKeyPair.pubKey),
  });

  const store = new BrowserSignalProtocolStore(userId);
  await store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);
  await store.storePreKey(oneTimePreKeyId, oneTimePreKey.keyPair);
  
  // Save signature so we don't need to recalculate it later
  await saveKey(`${userId}_signed_prekey_signature`, arrayBufferToBase64(signedPreKey.signature));

  return {
    registrationId,
    deviceId,
    identityKey: arrayBufferToBase64(identityKeyPair.pubKey),
    signedPreKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
    signedPreKeyId,
    signedPreKeySignature: arrayBufferToBase64(signedPreKey.signature),
    oneTimePreKey: arrayBufferToBase64(oneTimePreKey.keyPair.pubKey),
    oneTimePreKeyId,
  };
}

// Rebuild the PUBLIC bundle from existing local keys (use when user already has keys in IndexedDB)
// This does NOT regenerate private keys — safe to call on every login to re-sync server bundle
export async function getPublicBundleForUser(userId) {
  await initSignal();
  const identity = await getKey(userId);
  if (!identity) throw new Error("No local identity found for user: " + userId);

  const signedPreKeyId = 1;
  const oneTimePreKeyId = 1;

  const signedKeyData = await getKey(`${userId}_signed_prekey_${signedPreKeyId}`);
  let oneTimeKeyData = await getKey(`${userId}_prekey_${oneTimePreKeyId}`);

  // If oneTimePreKey is missing (because it was used by a peer and deleted by the Signal ratchet),
  // we generate a new one right now so we can upload it. This prevents the "Missing prekey" error.
  if (!oneTimeKeyData) {
    console.log("[E2EE] OneTimePreKey missing (likely used). Generating a new one...");
    const oneTimePreKey = await KeyHelper.generatePreKey(oneTimePreKeyId);
    const store = new BrowserSignalProtocolStore(userId);
    await store.storePreKey(oneTimePreKeyId, oneTimePreKey.keyPair);
    oneTimeKeyData = await getKey(`${userId}_prekey_${oneTimePreKeyId}`);
  }

  if (!signedKeyData) {
    throw new Error("Missing signed prekey data in local store for user: " + userId);
  }

  // Read signature from IndexedDB instead of recalculating
  const signatureBase64 = await getKey(`${userId}_signed_prekey_signature`);
  let signature;

  if (signatureBase64) {
    signature = base64ToArrayBuffer(signatureBase64);
  } else {
    throw new Error("Signed PreKey signature not found in local store. Need to regenerate keys.");
  }

  return {
    registrationId: identity.registrationId,
    deviceId: identity.deviceId,
    identityKey: identity.identityPublicKey,
    signedPreKey: signedKeyData.pubKey,
    signedPreKeyId,
    signedPreKeySignature: arrayBufferToBase64(signature),
    oneTimePreKey: oneTimeKeyData.pubKey,
    oneTimePreKeyId,
  };
}

// --- MESSAGING --- //

export async function ensureOutboundSession(senderId, recipientId, recipientBundle) {
  await initSignal();
  const store = new BrowserSignalProtocolStore(senderId);
  const address = new SignalProtocolAddress(recipientId, recipientBundle.deviceId ?? 1);

  const existingSession = await store.loadSession(address.toString());
  if (existingSession) {
    return { address, stored: store };
  }

  const builder = new SessionBuilder(store, address);

  const protocolBundle = {
    registrationId: recipientBundle.registrationId,
    identityKey: base64ToArrayBuffer(recipientBundle.identityKey),
    signedPreKey: {
      keyId: recipientBundle.signedPreKeyId,
      publicKey: base64ToArrayBuffer(recipientBundle.signedPreKey),
      signature: base64ToArrayBuffer(recipientBundle.signedPreKeySignature),
    },
    preKey: {
      keyId: recipientBundle.oneTimePreKeyId,
      publicKey: base64ToArrayBuffer(recipientBundle.oneTimePreKey),
    },
  };

  await builder.processPreKey(protocolBundle);
  return { address, stored: store };
}

export async function encryptWithSignal(senderId, recipientId, recipientBundle, plaintextStr) {
  await initSignal();
  const { address, stored } = await ensureOutboundSession(senderId, recipientId, recipientBundle);
  const cipher = new SessionCipher(stored, address);

  // Encode plaintext to ArrayBuffer
  const plaintextBuffer = new TextEncoder().encode(plaintextStr).buffer;
  const ciphertextMessage = await cipher.encrypt(plaintextBuffer);

  // ciphertextMessage.body is a binary string — must convert to base64 for safe JSON transport
  const ciphertextBase64 = binaryStringToBase64(ciphertextMessage.body);
  const isPreKey = ciphertextMessage.type === EncryptionResultMessageType.PreKeyWhisperMessage;

  console.log("[E2EE] Encrypt success. Type:", ciphertextMessage.type, "isPreKey:", isPreKey);

  return {
    ciphertext: ciphertextBase64,
    messageType: isPreKey ? "prekey" : "signal",
    sessionId: `${senderId}__${recipientId}`,
  };
}

export async function decryptWithSignal(recipientId, senderId, ciphertextBase64, messageType, senderDeviceId = 1) {
  await initSignal();
  const store = new BrowserSignalProtocolStore(recipientId);
  const address = new SignalProtocolAddress(senderId, senderDeviceId);
  const cipher = new SessionCipher(store, address);

  // Convert base64 back to binary string for libsignal-protocol-typescript
  const ciphertextBinary = base64ToBinaryString(ciphertextBase64);

  let plaintextBuffer;

  if (messageType === "prekey") {
    plaintextBuffer = await cipher.decryptPreKeyWhisperMessage(ciphertextBinary, 'binary');
  } else {
    plaintextBuffer = await cipher.decryptWhisperMessage(ciphertextBinary, 'binary');
  }

  // decryptPreKeyWhisperMessage returns ArrayBuffer, decryptWhisperMessage returns ArrayBuffer too
  return new TextDecoder().decode(new Uint8Array(plaintextBuffer));
}
