import path from "path";
import {
  Direction,
  IdentityChange,
  IdentityKeyStore,
  KyberPreKeyRecord,
  KyberPreKeyStore,
  PreKeyRecord,
  PreKeyStore,
  PrivateKey,
  ProtocolAddress,
  PublicKey,
  SessionRecord,
  SessionStore,
  SignedPreKeyRecord,
  SignedPreKeyStore,
} from "@signalapp/libsignal-client";

import { loadUserKeys } from "../keys/keyManager";
import { readJsonFile, writeJsonFile } from "../utils/fileStore";
import { base64ToBytes, publicKeyFromBase64 } from "../utils/signalSerde";

const SESSION_DIR = path.join(process.cwd(), "storage", "sessions");
const PREKEY_DIR = path.join(process.cwd(), "storage", "prekeys");

type StoredSessionJson = {
  address: string;
  session: string;
};

type StoredPrekeysJson = {
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

function sessionFile(address: ProtocolAddress): string {
  const safe = `${address.name()}__${address.deviceId()}`;
  return path.join(SESSION_DIR, `${safe}.json`);
}

function prekeyFile(userId: string): string {
  return path.join(PREKEY_DIR, `${userId}.json`);
}

function sessionRecordToBase64(record: SessionRecord): string {
  return Buffer.from(record.serialize()).toString("base64");
}

function sessionRecordFromBase64(base64: string): SessionRecord {
  return SessionRecord.deserialize(base64ToBytes(base64));
}

export class FileIdentityKeyStore extends IdentityKeyStore {
  constructor(private readonly userId: string) {
    super();
  }

  async getIdentityKey() {
    const user = loadUserKeys(this.userId);
    if (!user) {
      throw new Error(`Identity not found for user ${this.userId}`);
    }

    return PrivateKey.deserialize(base64ToBytes(user.identityPrivateKey));
  }

  async getLocalRegistrationId(): Promise<number> {
    const user = loadUserKeys(this.userId);
    if (!user) {
      throw new Error(`Registration id not found for user ${this.userId}`);
    }

    return user.registrationId;
  }

  async saveIdentity(
    name: ProtocolAddress,
    key: PublicKey
  ): Promise<IdentityChange> {
    const existing = await this.getIdentity(name);

    if (!existing) {
      return IdentityChange.NewOrUnchanged;
    }

    return existing.equals(key)
      ? IdentityChange.NewOrUnchanged
      : IdentityChange.ReplacedExisting;
  }

  async isTrustedIdentity(
    _name: ProtocolAddress,
    _key: PublicKey,
    _direction: Direction
  ): Promise<boolean> {
    return true;
  }

  async getIdentity(name: ProtocolAddress): Promise<PublicKey | null> {
    const user = loadUserKeys(name.name());
    if (!user) {
      return null;
    }

    return publicKeyFromBase64(user.identityPublicKey);
  }
}

export class FileSessionStore extends SessionStore {
  constructor() {
    super();
  }

  async saveSession(name: ProtocolAddress, record: SessionRecord): Promise<void> {
    const data: StoredSessionJson = {
      address: name.toString(),
      session: sessionRecordToBase64(record),
    };

    writeJsonFile(sessionFile(name), data);
  }

  async getSession(name: ProtocolAddress): Promise<SessionRecord | null> {
    const data = readJsonFile<StoredSessionJson>(sessionFile(name));
    if (!data) {
      return null;
    }

    return sessionRecordFromBase64(data.session);
  }

  async getExistingSessions(
    addresses: ProtocolAddress[]
  ): Promise<SessionRecord[]> {
    const result: SessionRecord[] = [];

    for (const address of addresses) {
      const session = await this.getSession(address);
      if (session) {
        result.push(session);
      }
    }

    return result;
  }
}

export class FilePreKeyStore extends PreKeyStore {
  constructor(private readonly userId: string) {
    super();
  }

  async savePreKey(id: number, record: PreKeyRecord): Promise<void> {
    const prekeys = readJsonFile<StoredPrekeysJson>(prekeyFile(this.userId)) || {
      userId: this.userId,
      signedPreKeyId: 1,
      signedPreKeyPrivate: "",
      signedPreKeyPublic: "",
      signedPreKeySignature: "",
      oneTimePreKeys: [],
      kyberPreKeyId: 1,
      kyberPreKeyPublic: "",
      kyberPreKeySecret: "",
      kyberPreKeySignature: "",
      kyberPreKeyRecord: "",
    };

    const existingIndex = prekeys.oneTimePreKeys.findIndex(p => p.id === id);
    if (existingIndex >= 0) {
      prekeys.oneTimePreKeys[existingIndex] = {
        id,
        publicKey: Buffer.from(record.publicKey().serialize()).toString("base64"),
        privateKey: Buffer.from(record.privateKey().serialize()).toString("base64"),
      };
    } else {
      prekeys.oneTimePreKeys.push({
        id,
        publicKey: Buffer.from(record.publicKey().serialize()).toString("base64"),
        privateKey: Buffer.from(record.privateKey().serialize()).toString("base64"),
      });
    }

    writeJsonFile(prekeyFile(this.userId), prekeys);
  }

  async getPreKey(id: number): Promise<PreKeyRecord | null> {
    const prekeys = readJsonFile<StoredPrekeysJson>(prekeyFile(this.userId));
    if (!prekeys) {
      return null;
    }

    const found = prekeys.oneTimePreKeys.find((p) => p.id === id);
    if (!found) {
      return null;
    }

    return PreKeyRecord.new(
      found.id,
      PublicKey.deserialize(base64ToBytes(found.publicKey)),
      PrivateKey.deserialize(base64ToBytes(found.privateKey))
    );
  }

  async removePreKey(id: number): Promise<void> {
    const prekeys = readJsonFile<StoredPrekeysJson>(prekeyFile(this.userId));
    if (!prekeys) {
      return;
    }

    prekeys.oneTimePreKeys = prekeys.oneTimePreKeys.filter(p => p.id !== id);
    writeJsonFile(prekeyFile(this.userId), prekeys);
  }
}

export class FileSignedPreKeyStore extends SignedPreKeyStore {
  constructor(private readonly userId: string) {
    super();
  }

  async saveSignedPreKey(id: number, record: SignedPreKeyRecord): Promise<void> {
    const prekeys = readJsonFile<StoredPrekeysJson>(prekeyFile(this.userId)) || {
      userId: this.userId,
      signedPreKeyId: 1,
      signedPreKeyPrivate: "",
      signedPreKeyPublic: "",
      signedPreKeySignature: "",
      oneTimePreKeys: [],
      kyberPreKeyId: 1,
      kyberPreKeyPublic: "",
      kyberPreKeySecret: "",
      kyberPreKeySignature: "",
      kyberPreKeyRecord: "",
    };

    prekeys.signedPreKeyId = id;
    prekeys.signedPreKeyPrivate = Buffer.from(record.privateKey().serialize()).toString("base64");
    prekeys.signedPreKeyPublic = Buffer.from(record.publicKey().serialize()).toString("base64");
    prekeys.signedPreKeySignature = Buffer.from(record.signature()).toString("base64");

    writeJsonFile(prekeyFile(this.userId), prekeys);
  }

  async getSignedPreKey(id: number): Promise<SignedPreKeyRecord | null> {
    const prekeys = readJsonFile<StoredPrekeysJson>(prekeyFile(this.userId));
    if (!prekeys) {
      return null;
    }

    if (prekeys.signedPreKeyId !== id) {
      return null;
    }

    return SignedPreKeyRecord.new(
      prekeys.signedPreKeyId,
      Date.now(),
      PublicKey.deserialize(base64ToBytes(prekeys.signedPreKeyPublic)),
      PrivateKey.deserialize(base64ToBytes(prekeys.signedPreKeyPrivate)),
      base64ToBytes(prekeys.signedPreKeySignature)
    );
  }
}

export class FileKyberPreKeyStore extends KyberPreKeyStore {
  constructor(private readonly userId: string) {
    super();
  }

  async saveKyberPreKey(kyberPreKeyId: number, record: KyberPreKeyRecord): Promise<void> {
    const prekeys = readJsonFile<StoredPrekeysJson>(prekeyFile(this.userId)) || {
      userId: this.userId,
      signedPreKeyId: 1,
      signedPreKeyPrivate: "",
      signedPreKeyPublic: "",
      signedPreKeySignature: "",
      oneTimePreKeys: [],
      kyberPreKeyId: 1,
      kyberPreKeyPublic: "",
      kyberPreKeySecret: "",
      kyberPreKeySignature: "",
      kyberPreKeyRecord: "",
    };

    prekeys.kyberPreKeyId = kyberPreKeyId;
    prekeys.kyberPreKeyPublic = Buffer.from(record.publicKey().serialize()).toString("base64");
    prekeys.kyberPreKeySecret = Buffer.from(record.secretKey().serialize()).toString("base64");
    prekeys.kyberPreKeySignature = Buffer.from(record.signature()).toString("base64");
    prekeys.kyberPreKeyRecord = Buffer.from(record.serialize()).toString("base64");

    writeJsonFile(prekeyFile(this.userId), prekeys);
  }

  async getKyberPreKey(kyberPreKeyId: number): Promise<KyberPreKeyRecord | null> {
    const prekeys = readJsonFile<StoredPrekeysJson>(prekeyFile(this.userId));
    if (!prekeys) {
      return null;
    }

    if (prekeys.kyberPreKeyId !== kyberPreKeyId) {
      return null;
    }

    return KyberPreKeyRecord.deserialize(
      base64ToBytes(prekeys.kyberPreKeyRecord)
    );
  }

  async markKyberPreKeyUsed(
    kyberPreKeyId: number,
    signedPreKeyId: number,
    baseKey: PublicKey
  ): Promise<void> {
    // For now, just log usage. In production, might need to track or rotate
    console.log(`KyberPreKey ${kyberPreKeyId} marked as used for signedPreKey ${signedPreKeyId}`);
  }
}