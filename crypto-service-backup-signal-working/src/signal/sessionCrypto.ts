import {
  CiphertextMessageType,
  PreKeySignalMessage,
  ProtocolAddress,
  SignalMessage,
  processPreKeyBundle,
  signalDecrypt,
  signalDecryptPreKey,
  signalEncrypt,
} from "@signalapp/libsignal-client";

import { PublicBundle } from "../types";
import { base64ToBytes, bytesToBase64 } from "../utils/signalSerde";
import { buildPreKeyBundle } from "./bundle";
import {
  FileIdentityKeyStore,
  FileKyberPreKeyStore,
  FilePreKeyStore,
  FileSessionStore,
  FileSignedPreKeyStore,
} from "./stores";

export function makeAddress(userId: string, deviceId = 1): ProtocolAddress {
  return ProtocolAddress.new(userId, deviceId);
}

function mapCiphertextType(type: number): "prekey" | "signal" {
  if (type === CiphertextMessageType.PreKey) {
    return "prekey";
  }

  return "signal";
}

export async function ensureOutboundSession(
  senderId: string,
  recipientId: string,
  recipientBundle: PublicBundle
): Promise<{ address: ProtocolAddress; hadSession: boolean }> {
  const address = makeAddress(recipientId, recipientBundle.deviceId ?? 1);

  const sessionStore = new FileSessionStore();
  const identityStore = new FileIdentityKeyStore(senderId);

  const existing = await sessionStore.getSession(address);
  if (existing) {
    return { address, hadSession: true };
  }

  const bundle = buildPreKeyBundle(recipientBundle);
  await processPreKeyBundle(bundle, address, sessionStore, identityStore);

  return { address, hadSession: false };
}

export async function encryptWithSignal(
  senderId: string,
  recipientId: string,
  recipientBundle: PublicBundle,
  plaintext: string
): Promise<{
  ciphertext: string;
  messageType: "prekey" | "signal";
  sessionId: string;
}> {
  const { address } = await ensureOutboundSession(
    senderId,
    recipientId,
    recipientBundle
  );

  const sessionStore = new FileSessionStore();
  const identityStore = new FileIdentityKeyStore(senderId);

  const message = await signalEncrypt(
    new TextEncoder().encode(plaintext),
    address,
    sessionStore,
    identityStore
  );

  return {
    ciphertext: bytesToBase64(message.serialize()),
    messageType: mapCiphertextType(message.type()),
    sessionId: `${senderId}__${recipientId}`,
  };
}

export async function decryptWithSignal(
  recipientId: string,
  senderId: string,
  ciphertextBase64: string,
  messageType: "prekey" | "signal",
  senderDeviceId = 1
): Promise<string> {
  const address = makeAddress(senderId, senderDeviceId);

  const sessionStore = new FileSessionStore();
  const identityStore = new FileIdentityKeyStore(recipientId);
  const preKeyStore = new FilePreKeyStore(recipientId);
  const signedPreKeyStore = new FileSignedPreKeyStore(recipientId);
  const kyberPreKeyStore = new FileKyberPreKeyStore(recipientId);

  const bytes = base64ToBytes(ciphertextBase64);

  let plaintextBytes: Uint8Array;

  if (messageType === "prekey") {
    const msg = PreKeySignalMessage.deserialize(bytes);

    // catch missing prekeys stock issue. Thrown inside libsignal usually as "PreKey x not found" from FilePreKeyStore.getPreKey.
    plaintextBytes = await signalDecryptPreKey(
      msg,
      address,
      sessionStore,
      identityStore,
      preKeyStore,
      signedPreKeyStore,
      kyberPreKeyStore
    );
  } else {
    const msg = SignalMessage.deserialize(bytes);
    plaintextBytes = await signalDecrypt(
      msg,
      address,
      sessionStore,
      identityStore
    );
  }

  return new TextDecoder().decode(plaintextBytes);
}