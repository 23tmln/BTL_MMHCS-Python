import {
  acceptAll,
  bytesToBase64,
  createApplicationMessage,
  createCommit,
  createGroup,
  decodeGroupState,
  decodeMlsMessage,
  defaultCapabilities,
  defaultLifetime,
  encodeGroupState,
  encodeMlsMessage,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  makePskIndex,
  processMessage,
  processPrivateMessage,
} from "ts-mls";
import { defaultClientConfig } from "ts-mls/clientConfig.js";
import { decodeKeyPackage, encodeKeyPackage, makeKeyPackageRef } from "ts-mls/keyPackage.js";
import { base64ToBytes } from "ts-mls/util/byteArray.js";
import { getMlsGroupState, getMlsIdentity, saveMlsGroupState, saveMlsIdentity } from "./mlsStore.js";

export const MLS_CIPHER_SUITE = "MLS_128_DHKEMP256_AES128GCM_SHA256_P256";

async function getMlsContext() {
  const cipherSuite = await getCiphersuiteImpl(getCiphersuiteFromName(MLS_CIPHER_SUITE));
  return { cipherSuite };
}

function normalizeStoredMlsIdentity(identity) {
  if (!identity?.privateMaterial) return null;

  const credential = identity.credentialPayload?.credential ?? identity.credential;
  const publicKey = identity.credentialPayload?.publicKey ?? credential;
  const keyPackage = identity.keyPackagePayload?.keyPackage ?? identity.keyPackage;
  const keyPackageRef = identity.keyPackagePayload?.keyPackageRef ?? identity.keyPackageRef;

  let publicPackage = identity.publicPackage;
  if (!publicPackage && keyPackage) {
    const decoded = decodeKeyPackage(base64ToBytes(keyPackage), 0);
    publicPackage = decoded ? decoded[0] : null;
  }

  if (!credential || !keyPackage || !keyPackageRef || !publicPackage) return null;

  return {
    ...identity,
    publicPackage,
    credentialPayload: {
      credential,
      publicKey,
      cipherSuite: identity.credentialPayload?.cipherSuite ?? MLS_CIPHER_SUITE,
    },
    keyPackagePayload: {
      keyPackage,
      keyPackageRef,
      cipherSuite: identity.keyPackagePayload?.cipherSuite ?? MLS_CIPHER_SUITE,
    },
  };
}

export async function ensureMlsIdentity(userId) {
  const existing = normalizeStoredMlsIdentity(await getMlsIdentity(userId));
  if (existing) {
    await saveMlsIdentity(userId, existing);
    return existing;
  }

  const context = await getMlsContext();
  const credential = { credentialType: "basic", identity: new TextEncoder().encode(userId) };
  const keyPackage = await generateKeyPackage(credential, defaultCapabilities(), defaultLifetime, [], context.cipherSuite);
  const keyPackageRef = await makeKeyPackageRef(keyPackage.publicPackage, context.cipherSuite.hash);
  const encodedKeyPackage = bytesToBase64(encodeKeyPackage(keyPackage.publicPackage));
  const encodedKeyPackageRef = bytesToBase64(keyPackageRef);
  const identity = {
    privateMaterial: keyPackage.privatePackage,
    publicPackage: keyPackage.publicPackage,
    credentialPayload: {
      credential: userId,
      publicKey: userId,
      cipherSuite: MLS_CIPHER_SUITE,
    },
    keyPackagePayload: {
      keyPackage: encodedKeyPackage,
      keyPackageRef: encodedKeyPackageRef,
      cipherSuite: MLS_CIPHER_SUITE,
    },
  };
  await saveMlsIdentity(userId, identity);
  return identity;
}

function restoreClientState(serializedState) {
  const bytes = base64ToBytes(serializedState);
  const decoded = decodeGroupState(bytes, 0);
  if (!decoded) throw new Error("Failed to decode MLS group state");
  return { ...decoded[0], clientConfig: defaultClientConfig };
}

export async function createLocalMlsGroup(groupId, creatorUserId, memberKeyPackages) {
  const context = await getMlsContext();
  const identity = await ensureMlsIdentity(creatorUserId);
  if (!identity?.publicPackage || !identity?.privateMaterial) throw new Error("Missing MLS identity");

  let state = await createGroup(
    new TextEncoder().encode(groupId),
    identity.publicPackage,
    identity.privateMaterial,
    [],
    context.cipherSuite,
    defaultClientConfig
  );
  let welcomePayload;
  let commitPayload;

  const addProposals = memberKeyPackages.map((keyPackage) => {
    const decoded = decodeKeyPackage(base64ToBytes(keyPackage.keyPackage), 0);
    if (!decoded) throw new Error("Failed to decode member KeyPackage");
    return {
      proposalType: "add",
      add: { keyPackage: decoded[0] },
    };
  });

  if (addProposals.length > 0) {
    const commit = await createCommit(
      { state, cipherSuite: context.cipherSuite },
      { extraProposals: addProposals, ratchetTreeExtension: true }
    );
    state = commit.newState;
    welcomePayload = commit.welcome ? bytesToBase64(encodeMlsMessage({ version: "mls10", wireformat: "mls_welcome", welcome: commit.welcome })) : undefined;
    commitPayload = bytesToBase64(encodeMlsMessage(commit.commit));
  }

  const serializedState = bytesToBase64(encodeGroupState(state));
  const epoch = Number(state.groupContext.epoch);
  await saveMlsGroupState(groupId, { serializedState, epoch }, creatorUserId);
  return { serializedState, epoch, welcomePayload, commitPayload };
}

export async function encryptGroupMessage(groupId, plaintext, userId) {
  const groupState = await getMlsGroupState(groupId, userId);
  if (!groupState) throw new Error("Missing MLS group state");
  const context = await getMlsContext();
  const clientState = restoreClientState(groupState.serializedState);
  const result = await createApplicationMessage(clientState, new TextEncoder().encode(plaintext), context.cipherSuite);
  const serializedState = bytesToBase64(encodeGroupState(result.newState));
  const epoch = Number(result.newState.groupContext.epoch);
  await saveMlsGroupState(groupId, { serializedState, epoch }, userId);
  const ciphertext = bytesToBase64(
    encodeMlsMessage({
      version: "mls10",
      wireformat: "mls_private_message",
      privateMessage: result.privateMessage,
    })
  );
  return { ciphertext, mlsEpoch: epoch };
}

export async function decryptGroupMessage(groupId, message, userId) {
  const groupState = await getMlsGroupState(groupId, userId);
  if (!groupState) throw new Error("Missing MLS group state");
  const context = await getMlsContext();
  const clientState = restoreClientState(groupState.serializedState);
  const decoded = decodeMlsMessage(base64ToBytes(message.ciphertext), 0);
  if (!decoded) throw new Error("Failed to decode MLS message");
  const decodedMessage = decoded[0];
  if (decodedMessage.wireformat !== "mls_private_message") {
    throw new Error("Expected private message");
  }
  const pskIndex = makePskIndex(clientState, {});
  const result = await processPrivateMessage(clientState, decodedMessage.privateMessage, pskIndex, context.cipherSuite);
  if (result.newState) {
    const serializedState = bytesToBase64(encodeGroupState(result.newState));
    await saveMlsGroupState(groupId, { serializedState, epoch: Number(result.newState.groupContext.epoch) }, userId);
  }
  if (result.kind === "applicationMessage") {
    return new TextDecoder().decode(result.message);
  }
  return "";
}

export async function processMlsWelcome(groupId, userId, welcomePayload) {
  if (await getMlsGroupState(groupId, userId)) return;

  const context = await getMlsContext();
  const identity = await ensureMlsIdentity(userId);
  const decoded = decodeMlsMessage(base64ToBytes(welcomePayload), 0);
  if (!decoded) throw new Error("Failed to decode MLS welcome message");
  const message = decoded[0];
  if (message.wireformat !== "mls_welcome") throw new Error("Invalid MLS welcome message");

  const state = await joinGroup(
    message.welcome,
    identity.publicPackage,
    identity.privateMaterial,
    makePskIndex(undefined, {}),
    context.cipherSuite,
    undefined,
    undefined,
    defaultClientConfig
  );
  const serializedState = bytesToBase64(encodeGroupState(state));
  await saveMlsGroupState(groupId, { serializedState, epoch: Number(state.groupContext.epoch) }, userId);
}

export async function processMlsCommit(groupId, commitPayload, epoch, userId) {
  const stored = await getMlsGroupState(groupId, userId);
  if (!stored) throw new Error("Missing MLS group state");
  if (stored.epoch >= epoch) {
    console.log(`[MLS] Skipping commit for group ${groupId} because current epoch ${stored.epoch} >= handshake epoch ${epoch}`);
    return;
  }
  const context = await getMlsContext();
  const clientState = restoreClientState(stored.serializedState);
  const decoded = decodeMlsMessage(base64ToBytes(commitPayload), 0);
  if (!decoded) throw new Error("Failed to decode MLS commit message");
  const commitMsg = decoded[0];
  const pskIndex = makePskIndex(clientState, {});
  const result = await processMessage(commitMsg, clientState, pskIndex, acceptAll, context.cipherSuite);
  if (result.newState) {
    const serializedState = bytesToBase64(encodeGroupState(result.newState));
    await saveMlsGroupState(groupId, {
      serializedState,
      epoch: Number(result.newState.groupContext.epoch),
      lastCommit: commitPayload
    }, userId);
  }
}


