import { beforeEach, describe, expect, it, vi } from "vitest";

const saved = new Map();

vi.mock("ts-mls/keyPackage.js", () => ({
  decodeKeyPackage: vi.fn(() => "decoded-key-package"),
  encodeKeyPackage: vi.fn(() => new Uint8Array([1, 2, 3])),
  makeKeyPackageRef: vi.fn(async () => new Uint8Array([4, 5, 6])),
}));

vi.mock("ts-mls/util/byteArray.js", () => ({
  base64ToBytes: vi.fn((base64) => new Uint8Array(base64.replace("base64:", "").split(",").filter(Boolean).map(Number))),
}));

vi.mock("./mlsStore.js", () => ({
  getMlsIdentity: vi.fn((userId) => Promise.resolve(saved.get(`identity:${userId}`))),
  saveMlsIdentity: vi.fn((userId, identity) => {
    saved.set(`identity:${userId}`, identity);
    return Promise.resolve();
  }),
  getMlsGroupState: vi.fn((groupId, userId) => {
    const key = userId ? `group:${userId}:${groupId}` : `group:${groupId}`;
    return Promise.resolve(saved.get(key));
  }),
  saveMlsGroupState: vi.fn((groupId, state, userId) => {
    const key = userId ? `group:${userId}:${groupId}` : `group:${groupId}`;
    saved.set(key, state);
    return Promise.resolve();
  }),
}));

vi.mock("ts-mls/clientConfig.js", () => ({
  defaultClientConfig: { keyRetentionConfig: {} }
}));

vi.mock("ts-mls", () => ({
  Credential: class Credential {
    constructor(data) {
      this.data = data;
    }
  },
  bytesToBase64: vi.fn((bytes) => `base64:${Array.from(bytes).join(",")}`),
  createApplicationMessage: vi.fn(async (state, messageBytes, cs) => {
    const plaintext = new TextDecoder().decode(messageBytes);
    return {
      newState: { groupContext: { epoch: BigInt(Number(state.groupContext.epoch) + 1) } },
      privateMessage: { ciphertext: `encrypted:${plaintext}` },
      consumed: [],
    };
  }),
  createCommit: vi.fn(async () => ({
    newState: { groupContext: { epoch: 1n } },
    welcome: "welcome-payload",
    commit: "commit-payload",
  })),
  createGroup: vi.fn(async () => ({ groupContext: { epoch: 0n } })),
  decodeGroupState: vi.fn((bytes, offset) => [
    { groupContext: { epoch: 1n } },
    bytes.length
  ]),
  decodeMlsMessage: vi.fn((bytes, offset) => {
    const bytesStr = Array.from(bytes).join(",");
    if (bytesStr === "20,21,22") {
      return [
        { wireformat: "mls_welcome", welcome: "decoded-welcome" },
        bytes.length
      ];
    }
    if (bytesStr === "30,31,32") {
      return [
        {
          wireformat: "mls_private_message",
          privateMessage: { ciphertext: "encrypted:hello" }
        },
        bytes.length
      ];
    }
    if (bytesStr === "40,41,42") {
      return [
        {
          wireformat: "mls_private_message",
          privateMessage: { ciphertext: "encrypted:commit" }
        },
        bytes.length
      ];
    }
    return [
      {
        wireformat: "mls_private_message",
        privateMessage: { ciphertext: "encrypted:hello" }
      },
      bytes.length
    ];
  }),
  defaultCapabilities: vi.fn(() => "default-capabilities"),
  defaultLifetime: "default-lifetime",
  encodeGroupState: vi.fn(() => new Uint8Array([7, 8, 9])),
  encodeMlsMessage: vi.fn((msg) => {
    if (msg.wireformat === "mls_welcome") {
      return new Uint8Array([20, 21, 22]);
    }
    if (msg.wireformat === "mls_private_message") {
      return new Uint8Array([30, 31, 32]);
    }
    return new Uint8Array([40, 41, 42]);
  }),
  generateKeyPackage: vi.fn(async () => ({
    publicPackage: "key-package-public",
    privatePackage: "key-package-private",
  })),
  getCiphersuiteImpl: vi.fn(async () => ({ name: "suite", hash: "hash" })),
  getCiphersuiteFromName: vi.fn((name) => name),
  joinGroup: vi.fn(async () => ({ groupContext: { epoch: 2n } })),
  makePskIndex: vi.fn(() => "psk-index"),
  processPrivateMessage: vi.fn(async (state, pm, pskSearch, cs) => {
    const ciphertext = pm.ciphertext;
    const plaintext = ciphertext.replace("encrypted:", "");
    return {
      kind: "applicationMessage",
      message: new TextEncoder().encode(plaintext),
      newState: state,
      consumed: [],
    };
  }),
  processMessage: vi.fn(async (message, state, pskIndex, action, cs) => {
    return {
      kind: "newState",
      newState: { groupContext: { epoch: BigInt(Number(state.groupContext.epoch) + 1) } },
      consumed: [],
    };
  }),
  acceptAll: vi.fn(() => "accept"),
}));

const { generateKeyPackage } = await import("ts-mls");
const {
  MLS_CIPHER_SUITE,
  ensureMlsIdentity,
  createLocalMlsGroup,
  encryptGroupMessage,
  decryptGroupMessage,
  processMlsWelcome,
  processMlsCommit,
} = await import("./mlsClient.js");

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
      credential: "user-1",
      publicKey: "user-1",
      cipherSuite: "MLS_128_DHKEMP256_AES128GCM_SHA256_P256",
    });
    expect(result.keyPackagePayload).toEqual({
      keyPackage: "base64:1,2,3",
      keyPackageRef: "base64:4,5,6",
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

  it("creates local MLS group and exposes handshake payloads for backend persistence", async () => {
    saved.set("identity:creator-1", {
      privateMaterial: "key-package-private",
      publicPackage: "key-package-public",
      credentialPayload: { credential: "creator-1", publicKey: "creator-1", cipherSuite: MLS_CIPHER_SUITE },
      keyPackagePayload: { keyPackage: "base64:1,2,3", keyPackageRef: "base64:4,5,6", cipherSuite: MLS_CIPHER_SUITE },
    });

    await expect(createLocalMlsGroup("group-1", "creator-1", [{ userId: "member-1", keyPackage: "base64:1,2,3" }])).resolves.toEqual({
      serializedState: "base64:7,8,9",
      epoch: 1,
      welcomePayload: "base64:20,21,22",
      commitPayload: "base64:40,41,42",
    });
    expect(saved.get("group:creator-1:group-1")).toEqual({ serializedState: "base64:7,8,9", epoch: 1 });
  });

  it("processes persisted MLS welcome into local group state", async () => {
    saved.set("identity:user-1", {
      privateMaterial: "key-package-private",
      publicPackage: "key-package-public",
      credentialPayload: { credential: "user-1", publicKey: "user-1", cipherSuite: MLS_CIPHER_SUITE },
      keyPackagePayload: { keyPackage: "base64:1,2,3", keyPackageRef: "base64:4,5,6", cipherSuite: MLS_CIPHER_SUITE },
    });

    await processMlsWelcome("group-1", "user-1", "base64:20,21,22");

    expect(saved.get("group:user-1:group-1")).toEqual({ serializedState: "base64:7,8,9", epoch: 2 });
  });

  it("encrypts group plaintext into ciphertext payload", async () => {
    saved.set("group:group-1", { serializedState: "base64:7,8,9", epoch: 1 });

    await expect(encryptGroupMessage("group-1", "hello")).resolves.toEqual({
      ciphertext: "base64:30,31,32",
      mlsEpoch: 2,
    });
  });

  it("decrypts group ciphertext", async () => {
    saved.set("group:group-1", { serializedState: "base64:7,8,9", epoch: 1 });

    await expect(decryptGroupMessage("group-1", { ciphertext: "base64:30,31,32" })).resolves.toBe("hello");
  });

  it("processes group handshake commits", async () => {
    saved.set("group:group-1", { serializedState: "base64:7,8,9", epoch: 1 });

    await processMlsCommit("group-1", "base64:40,41,42", 2);

    expect(saved.get("group:group-1")).toEqual({
      serializedState: "base64:7,8,9",
      epoch: 2,
      lastCommit: "base64:40,41,42",
    });
  });
});

