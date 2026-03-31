import path from "path";
import {
  KEMKeyPair,
  KyberPreKeyRecord,
  PrivateKey,
} from "@signalapp/libsignal-client";

import { PublicBundle, UserKeyRecord } from "../types";
import { readJsonFile, writeJsonFile } from "../utils/fileStore";
import {
  base64ToBytes,
  bytesToBase64,
  privateKeyFromBase64,
  privateKeyToBase64,
  publicKeyFromBase64,
  publicKeyToBase64,
} from "../utils/signalSerde";

const IDENTITY_DIR = path.join(process.cwd(), "storage", "identities");
const PREKEY_DIR = path.join(process.cwd(), "storage", "prekeys");

function randomId(): number {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

export function identityFile(userId: string): string {
  return path.join(IDENTITY_DIR, `${userId}.json`);
}

export function prekeyFile(userId: string): string {
  return path.join(PREKEY_DIR, `${userId}.json`);
}

type IdentityFileData = {
  userId: string;
  registrationId: number;
  deviceId: number;
  identityPrivateKey: string;
  identityPublicKey: string;
};

type PrekeyFileData = {
  userId: string;
  signedPreKeyId: number;
  signedPreKeyPrivate: string;
  signedPreKeyPublic: string;
  signedPreKeySignature: string;
  oneTimePreKeys: Array<{
    id: number;
    publicKey: string;
    privateKey: string;
  }>;
  kyberPreKeyId: number;
  kyberPreKeyPublic: string;
  kyberPreKeySecret: string;
  kyberPreKeySignature: string;
  kyberPreKeyRecord: string;
};

export function generateKeysForUser(userId: string): UserKeyRecord {
  const identityPrivate = PrivateKey.generate();
  const identityPublic = identityPrivate.getPublicKey();

  const signedPreKeyId = 1;
  const signedPreKeyPrivate = PrivateKey.generate();
  const signedPreKeyPublic = signedPreKeyPrivate.getPublicKey();

  const signedPreKeySignatureBytes = identityPrivate.sign(
    signedPreKeyPublic.serialize()
  );

  const oneTimePreKeys = [1, 2, 3].map((id) => {
    const priv = PrivateKey.generate();
    const pub = priv.getPublicKey();

    return {
      id,
      publicKey: publicKeyToBase64(pub),
      privateKey: privateKeyToBase64(priv),
    };
  });

  const kyberPreKeyId = 1;
  const kyberKeyPair = KEMKeyPair.generate();
  const kyberPublic = kyberKeyPair.getPublicKey();
  const kyberSecret = kyberKeyPair.getSecretKey();

  const kyberSignatureBytes = identityPrivate.sign(
    kyberPublic.serialize()
  );

  const kyberRecord = KyberPreKeyRecord.new(
    kyberPreKeyId,
    Date.now(),
    kyberKeyPair,
    kyberSignatureBytes
  );

  const identityData: IdentityFileData = {
    userId,
    registrationId: randomId(),
    deviceId: 1,
    identityPrivateKey: privateKeyToBase64(identityPrivate),
    identityPublicKey: publicKeyToBase64(identityPublic),
  };

  const prekeyData: PrekeyFileData = {
    userId,
    signedPreKeyId,
    signedPreKeyPrivate: privateKeyToBase64(signedPreKeyPrivate),
    signedPreKeyPublic: publicKeyToBase64(signedPreKeyPublic),
    signedPreKeySignature: bytesToBase64(signedPreKeySignatureBytes),
    oneTimePreKeys,
    kyberPreKeyId,
    kyberPreKeyPublic: bytesToBase64(kyberPublic.serialize()),
    kyberPreKeySecret: bytesToBase64(kyberSecret.serialize()),
    kyberPreKeySignature: bytesToBase64(kyberSignatureBytes),
    kyberPreKeyRecord: bytesToBase64(kyberRecord.serialize()),
  };

  writeJsonFile(identityFile(userId), identityData);
  writeJsonFile(prekeyFile(userId), prekeyData);

  return {
    userId,
    registrationId: identityData.registrationId,
    deviceId: identityData.deviceId,
    identityPrivateKey: identityData.identityPrivateKey,
    identityPublicKey: identityData.identityPublicKey,
    signedPreKeyId: prekeyData.signedPreKeyId,
    signedPreKeyPrivate: prekeyData.signedPreKeyPrivate,
    signedPreKeyPublic: prekeyData.signedPreKeyPublic,
    signedPreKeySignature: prekeyData.signedPreKeySignature,
    oneTimePreKeys: prekeyData.oneTimePreKeys,
    kyberPreKeyId: prekeyData.kyberPreKeyId,
    kyberPreKeyPublic: prekeyData.kyberPreKeyPublic,
    kyberPreKeySecret: prekeyData.kyberPreKeySecret,
    kyberPreKeySignature: prekeyData.kyberPreKeySignature,
    kyberPreKeyRecord: prekeyData.kyberPreKeyRecord,
  };
}

export function loadUserKeys(userId: string): UserKeyRecord | null {
  const identity = readJsonFile<IdentityFileData>(identityFile(userId));
  const prekeys = readJsonFile<PrekeyFileData>(prekeyFile(userId));

  if (!identity || !prekeys) {
    return null;
  }

  return {
    userId,
    registrationId: identity.registrationId,
    deviceId: identity.deviceId,
    identityPrivateKey: identity.identityPrivateKey,
    identityPublicKey: identity.identityPublicKey,
    signedPreKeyId: prekeys.signedPreKeyId,
    signedPreKeyPrivate: prekeys.signedPreKeyPrivate,
    signedPreKeyPublic: prekeys.signedPreKeyPublic,
    signedPreKeySignature: prekeys.signedPreKeySignature,
    oneTimePreKeys: prekeys.oneTimePreKeys,
    kyberPreKeyId: prekeys.kyberPreKeyId,
    kyberPreKeyPublic: prekeys.kyberPreKeyPublic,
    kyberPreKeySecret: prekeys.kyberPreKeySecret,
    kyberPreKeySignature: prekeys.kyberPreKeySignature,
    kyberPreKeyRecord: prekeys.kyberPreKeyRecord,
  };
}

export function getPublicBundle(userId: string): PublicBundle | null {
  const record = loadUserKeys(userId);
  if (!record) {
    return null;
  }

  const firstOneTimePreKey = record.oneTimePreKeys[0];
  if (!firstOneTimePreKey) {
    return null;
  }

  return {
    registrationId: record.registrationId,
    deviceId: record.deviceId,
    identityKey: record.identityPublicKey,
    signedPreKey: record.signedPreKeyPublic,
    signedPreKeyId: record.signedPreKeyId,
    signedPreKeySignature: record.signedPreKeySignature,
    oneTimePreKey: firstOneTimePreKey.publicKey,
    oneTimePreKeyId: firstOneTimePreKey.id,
    kyberPreKey: record.kyberPreKeyPublic,
    kyberPreKeyId: record.kyberPreKeyId,
    kyberPreKeySignature: record.kyberPreKeySignature,
  };
}

export function loadIdentityPrivateKey(userId: string): PrivateKey | null {
  const record = loadUserKeys(userId);
  if (!record) {
    return null;
  }
  return privateKeyFromBase64(record.identityPrivateKey);
}

export function loadIdentityPublicKey(userId: string) {
  const record = loadUserKeys(userId);
  if (!record) {
    return null;
  }
  return publicKeyFromBase64(record.identityPublicKey);
}

export function loadSignedPreKeyPrivate(userId: string): PrivateKey | null {
  const record = loadUserKeys(userId);
  if (!record) {
    return null;
  }
  return privateKeyFromBase64(record.signedPreKeyPrivate);
}

export function loadSignedPreKeyPublic(userId: string) {
  const record = loadUserKeys(userId);
  if (!record) {
    return null;
  }
  return publicKeyFromBase64(record.signedPreKeyPublic);
}

export function loadKyberSecretKeyBytes(userId: string): Uint8Array | null {
  const record = loadUserKeys(userId);
  if (!record || !record.kyberPreKeySecret) {
    return null;
  }
  return base64ToBytes(record.kyberPreKeySecret);
}

export function loadKyberPublicKeyBytes(userId: string): Uint8Array | null {
  const record = loadUserKeys(userId);
  if (!record || !record.kyberPreKeyPublic) {
    return null;
  }
  return base64ToBytes(record.kyberPreKeyPublic);
}