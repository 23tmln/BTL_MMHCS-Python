import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map();

vi.mock("./secureStore.js", () => ({
  getKey: vi.fn((key) => Promise.resolve(memory.get(key))),
  saveKey: vi.fn((key, value) => {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
    return Promise.resolve();
  }),
}));

const {
  getMlsIdentity,
  saveMlsIdentity,
  getMlsGroupState,
  saveMlsGroupState,
  getMlsPendingWelcome,
  saveMlsPendingWelcome,
} = await import("./mlsStore.js");

describe("mlsStore", () => {
  beforeEach(() => memory.clear());

  it("stores MLS identity by user id", async () => {
    await saveMlsIdentity("user-1", { credential: "cred", signaturePrivateKey: "sig" });

    await expect(getMlsIdentity("user-1")).resolves.toEqual({
      credential: "cred",
      signaturePrivateKey: "sig",
    });
  });

  it("stores MLS group state by group id", async () => {
    await saveMlsGroupState("group-1", { epoch: 3, state: "serialized" }, "user-1");

    await expect(getMlsGroupState("group-1", "user-1")).resolves.toEqual({
      epoch: 3,
      state: "serialized",
    });
  });

  it("stores pending Welcome by group id", async () => {
    await saveMlsPendingWelcome("group-1", { welcome: "abc" }, "user-1");

    await expect(getMlsPendingWelcome("group-1", "user-1")).resolves.toEqual({ welcome: "abc" });
  });
});
