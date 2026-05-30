import {
  createApplicationMessage,
  createGroup,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  processPrivateMessage,
} from "ts-mls";
import { getMlsGroupState, getMlsIdentity, saveMlsGroupState, saveMlsIdentity } from "./mlsStore.js";

export const MLS_CIPHER_SUITE = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519";

async function getMlsContext() {
  const cipherSuite = await getCiphersuiteImpl(getCiphersuiteFromName(MLS_CIPHER_SUITE));
  return { cipherSuite };
}

export async function ensureMlsIdentity(userId) {
  const existing = await getMlsIdentity(userId);
  if (existing?.credentialPayload && existing?.keyPackagePayload) {
    return existing;
  }

  const context = await getMlsContext();
  const keyPackage = await generateKeyPackage({ context, identity: userId });
  const identity = {
    privateMaterial: keyPackage.privateMaterial,
    credentialPayload: {
      credential: keyPackage.credential,
      publicKey: keyPackage.credential,
      cipherSuite: MLS_CIPHER_SUITE,
    },
    keyPackagePayload: {
      keyPackage: keyPackage.keyPackage,
      keyPackageRef: keyPackage.keyPackageRef,
      cipherSuite: MLS_CIPHER_SUITE,
    },
  };
  await saveMlsIdentity(userId, identity);
  return identity;
}

export async function createLocalMlsGroup(groupId, creatorUserId, memberKeyPackages) {
  const context = await getMlsContext();
  const group = await createGroup({ context, groupId, creatorUserId, memberKeyPackages });
  await saveMlsGroupState(groupId, { serializedState: group.serializedState, epoch: group.epoch });
  return group;
}

export async function encryptGroupMessage(groupId, plaintext) {
  const groupState = await getMlsGroupState(groupId);
  if (!groupState) throw new Error("Missing MLS group state");
  const message = await createApplicationMessage({ groupState, plaintext });
  await saveMlsGroupState(groupId, { ...groupState, epoch: message.epoch });
  return { ciphertext: message.ciphertext, mlsEpoch: message.epoch };
}

export async function decryptGroupMessage(groupId, message) {
  const groupState = await getMlsGroupState(groupId);
  if (!groupState) throw new Error("Missing MLS group state");
  return processPrivateMessage({ groupState, ciphertext: message.ciphertext });
}

export async function processMlsWelcome(groupId, welcomePayload) {
  await saveMlsGroupState(groupId, { serializedState: welcomePayload, epoch: 0 });
}

export async function processMlsCommit(groupId, commitPayload, epoch) {
  const current = await getMlsGroupState(groupId);
  if (!current) throw new Error("Missing MLS group state");
  await saveMlsGroupState(groupId, { ...current, lastCommit: commitPayload, epoch });
}
