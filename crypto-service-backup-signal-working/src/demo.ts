import { generateKeysForUser, getPublicBundle } from "./keys/keyManager";
import { encryptMessage } from "./crypto/encrypt";
import { decryptMessage } from "./crypto/decrypt";

async function main() {
  console.log("=== SIGNAL DEMO START ===");

  generateKeysForUser("alice");
  generateKeysForUser("bob");

  const bobBundle = getPublicBundle("bob");
  if (!bobBundle) {
    throw new Error("Bob bundle not found");
  }

  const encrypted1 = await encryptMessage({
    from: "alice",
    to: "bob",
    plaintext: "xin chao bob",
    recipientBundle: bobBundle,
  });

  console.log("Encrypted #1:");
  console.log(encrypted1);

  const decrypted1 = await decryptMessage({
    from: "alice",
    to: "bob",
    ciphertext: encrypted1.ciphertext,
    messageType: encrypted1.messageType,
    sessionId: encrypted1.sessionId,
  });

  console.log("Decrypted #1:");
  console.log(decrypted1);

  const encrypted2 = await encryptMessage({
    from: "alice",
    to: "bob",
    plaintext: "day la tin nhan thu hai",
    recipientBundle: bobBundle,
  });

  console.log("Encrypted #2:");
  console.log(encrypted2);

  const decrypted2 = await decryptMessage({
    from: "alice",
    to: "bob",
    ciphertext: encrypted2.ciphertext,
    messageType: encrypted2.messageType,
    sessionId: encrypted2.sessionId,
  });

  console.log("Decrypted #2:");
  console.log(decrypted2);

  console.log("=== SIGNAL DEMO END ===");
}

main().catch((err) => {
  console.error("DEMO ERROR:", err);
  process.exit(1);
});