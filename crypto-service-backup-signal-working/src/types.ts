export type PublicBundle = {
  registrationId?: number;
  deviceId?: number;
  identityKey: string;
  signedPreKey: string;
  signedPreKeyId?: number;
  signedPreKeySignature: string;
  oneTimePreKey: string;
  oneTimePreKeyId?: number;
  kyberPreKey?: string;
  kyberPreKeyId?: number;
  kyberPreKeySignature?: string;
};

export type UserKeyRecord = {
  userId: string;
  registrationId: number;
  deviceId: number;
  identityPrivateKey: string;
  identityPublicKey: string;

  signedPreKeyId: number;
  signedPreKeyPrivate: string;
  signedPreKeyPublic: string;
  signedPreKeySignature: string;

  oneTimePreKeys: Array<{
    id: number;
    publicKey: string;
    privateKey: string;
  }>;

    kyberPreKeyId?: number;
    kyberPreKeyPublic?: string;
    kyberPreKeySecret?: string;
    kyberPreKeySignature?: string;
    kyberPreKeyRecord?: string;
};

export type SessionRecord = {
  sessionId: string;
  from: string;
  to: string;
  rootKey: string;
  sendChainKey: string;
  receiveChainKey: string;
  messageCount: number;
};

export type EncryptInput = {
  from: string;
  to: string;
  plaintext: string;
  recipientBundle: PublicBundle;
};

export type EncryptOutput = {
  ciphertext: string;
  messageType: "prekey" | "signal";
  sessionId: string;
};

export type DecryptInput = {
  from: string;
  to: string;
  ciphertext: string;
  messageType: "prekey" | "signal";
  sessionId: string;
};

export type DecryptOutput = {
  plaintext: string;
};