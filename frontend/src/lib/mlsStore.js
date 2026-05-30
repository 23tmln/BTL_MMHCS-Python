import { getKey, saveKey } from "./secureStore.js";

const mlsIdentityKey = (userId) => `mls_identity_${userId}`;
const mlsGroupStateKey = (groupId) => `mls_group_state_${groupId}`;
const mlsPendingWelcomeKey = (groupId) => `mls_pending_welcome_${groupId}`;

export async function getMlsIdentity(userId) {
  return getKey(mlsIdentityKey(userId));
}

export async function saveMlsIdentity(userId, identity) {
  return saveKey(mlsIdentityKey(userId), identity);
}

export async function getMlsGroupState(groupId) {
  return getKey(mlsGroupStateKey(groupId));
}

export async function saveMlsGroupState(groupId, state) {
  return saveKey(mlsGroupStateKey(groupId), state);
}

export async function getMlsPendingWelcome(groupId) {
  return getKey(mlsPendingWelcomeKey(groupId));
}

export async function saveMlsPendingWelcome(groupId, welcome) {
  return saveKey(mlsPendingWelcomeKey(groupId), welcome);
}
