import {
  PrivateKey,
  PublicKey,
  SignedPreKeyRecord,
  PreKeyRecord,
  KyberPreKeyRecord,
} from "@signalapp/libsignal-client";

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function privateKeyToBase64(key: PrivateKey): string {
  return bytesToBase64(key.serialize());
}

export function publicKeyToBase64(key: PublicKey): string {
  return bytesToBase64(key.serialize());
}

export function privateKeyFromBase64(base64: string): PrivateKey {
  return PrivateKey.deserialize(base64ToBytes(base64));
}

export function publicKeyFromBase64(base64: string): PublicKey {
  return PublicKey.deserialize(base64ToBytes(base64));
}

export function preKeyRecordToBase64(record: PreKeyRecord): string {
  return bytesToBase64(record.serialize());
}

export function preKeyRecordFromBase64(base64: string): PreKeyRecord {
  return PreKeyRecord.deserialize(base64ToBytes(base64));
}

export function signedPreKeyRecordToBase64(record: SignedPreKeyRecord): string {
  return bytesToBase64(record.serialize());
}

export function signedPreKeyRecordFromBase64(base64: string): SignedPreKeyRecord {
  return SignedPreKeyRecord.deserialize(base64ToBytes(base64));
}

export function kyberPreKeyRecordToBase64(record: KyberPreKeyRecord): string {
  return bytesToBase64(record.serialize());
}

export function kyberPreKeyRecordFromBase64(base64: string): KyberPreKeyRecord {
  return KyberPreKeyRecord.deserialize(base64ToBytes(base64));
}