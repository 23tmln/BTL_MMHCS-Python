import { beforeEach, describe, expect, it, vi } from "vitest";

const saved = new Map();

vi.mock("./mlsStore.js", () => ({
  getMlsIdentity: vi.fn((userId) => Promise.resolve(saved.get(`identity:${userId}`))),
  saveMlsIdentity: vi.fn((userId, identity) => {
    saved.set(`identity:${userId}`, identity);
    return Promise.resolve();
  }),
  getMlsGroupState: vi.fn((groupId) => Promise.resolve(saved.get(`group:${groupId}`))),
  saveMlsGroupState: vi.fn((groupId, state) => {
    saved.set(`group:${groupId}`, state);
    return Promise.resolve();
  }),
}));

vi.mock("ts-mls", () => ({
  Credential: class Credential {
    constructor(data) {
      this.data = data;
    }
  },
  createApplicationMessage: vi.fn(async ({ plaintext }) => ({
    ciphertext: `encrypted:${plaintext}`,
    epoch: 1,
  })),
  createGroup: vi.fn(async () => ({ serializedState: "group-state", epoch: 0 })),
  generateKeyPackage: vi.fn(async () => ({
    credential: "credential-public",
    keyPackage: "key-package-public",
    keyPackageRef: "key-package-ref",
    privateMaterial: "key-package-private",
  })),
  getCiphersuiteImpl: vi.fn(async () => ({ name: "suite" })),
  getCiphersuiteFromName: vi.fn((name) => name),
  processPrivateMessage: vi.fn(async ({ ciphertext }) => ciphertext.replace("encrypted:", "")),
}));

const { generateKeyPackage } = await import("ts-mls");
const { MLS_CIPHER_SUITE, ensureMlsIdentity, encryptGroupMessage, decryptGroupMessage } = await import("./mlsClient.js");

describe("mlsClient", () => {
  it("uses a browser-supported WebCrypto MLS ciphersuite", () => {
    expect(MLS_CIPHER_SUITE).toBe("MLS_128_DHKEMP256_AES128GCM_SHA256_P256");
  });

  beforeEach(() => {
    saved.clear();
    vi.clearAllMocks();
  });

  it("creates and persists identity with public upload payload", async () => {
    const result = await ensureMlsIdentity("user-1");

    expect(result.credentialPayload).toEqual({
      credential: "credential-public",
      publicKey: "credential-public",
      cipherSuite: "MLS_128_DHKEMP256_AES128GCM_SHA256_P256",
    });
    expect(result.keyPackagePayload).toEqual({
      keyPackage: "key-package-public",
      keyPackageRef: "key-package-ref",
      cipherSuite: "MLS_128_DHKEMP256_AES128GCM_SHA256_P256",
    });
  });

  it("restores missing MLS upload payloads without generating a new key package", async () => {
    saved.set("identity:user-1", {
      privateMaterial: "key-package-private",
      credential: "credential-public",
      keyPackage: "key-package-public",
      keyPackageRef: "key-package-ref",
    });

    const result = await ensureMlsIdentity("user-1");

    expect(generateKeyPackage).not.toHaveBeenCalled();
    expect(result.credentialPayload).toEqual({
      credential: "credential-public",
      publicKey: "credential-public",
      cipherSuite: "MLS_128_DHKEMP256_AES128GCM_SHA256_P256",
    });
    expect(result.keyPackagePayload).toEqual({
      keyPackage: "key-package-public",
      keyPackageRef: "key-package-ref",
      cipherSuite: "MLS_128_DHKEMP256_AES128GCM_SHA256_P256",
    });
  });

  it("encrypts group plaintext into ciphertext payload", async () => {
    saved.set("group:group-1", { serializedState: "group-state", epoch: 1 });

    await expect(encryptGroupMessage("group-1", "hello")).resolves.toEqual({
      ciphertext: "encrypted:hello",
      mlsEpoch: 1,
    });
  });

  it("decrypts group ciphertext", async () => {
    saved.set("group:group-1", { serializedState: "group-state", epoch: 1 });

    await expect(decryptGroupMessage("group-1", { ciphertext: "encrypted:hello" })).resolves.toBe("hello");
  });
});
