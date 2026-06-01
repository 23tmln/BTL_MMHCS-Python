import { getKey, saveKey } from "./secureStore.js";

const mlsIdentityKey = (userId) => `mls_identity_${userId}`;
const mlsGroupStateKey = (groupId, userId) => userId ? `mls_group_state_${userId}_${groupId}` : `mls_group_state_${groupId}`;
const mlsPendingWelcomeKey = (groupId, userId) => userId ? `mls_pending_welcome_${userId}_${groupId}` : `mls_pending_welcome_${groupId}`;

export async function getMlsIdentity(userId) {
  return getKey(mlsIdentityKey(userId));
}

export async function saveMlsIdentity(userId, identity) {
  return saveKey(mlsIdentityKey(userId), identity);
}

export async function getMlsGroupState(groupId, userId) {
  return getKey(mlsGroupStateKey(groupId, userId));
}

export async function saveMlsGroupState(groupId, state, userId) {
  return saveKey(mlsGroupStateKey(groupId, userId), state);
}

export async function getMlsPendingWelcome(groupId, userId) {
  return getKey(mlsPendingWelcomeKey(groupId, userId));
}

export async function saveMlsPendingWelcome(groupId, welcome, userId) {
  return saveKey(mlsPendingWelcomeKey(groupId, userId), welcome);
}

