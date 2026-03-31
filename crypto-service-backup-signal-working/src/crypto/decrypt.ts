import { DecryptInput, DecryptOutput } from "../types";
import { decryptWithSignal } from "../signal/sessionCrypto";

export async function decryptMessage(input: DecryptInput): Promise<DecryptOutput> {
  console.log("[decryptMessage] request", JSON.stringify(input));
  if (!input.from || !input.to || !input.ciphertext || !input.sessionId) {
    const message = "from, to, ciphertext, sessionId are required";
    console.error("[decryptMessage] missing field", message);
    throw new Error(message);
  }

  try {
    const plaintext = await decryptWithSignal(
      input.to,
      input.from,
      input.ciphertext,
      input.messageType
    );

    console.log("[decryptMessage] success for sessionId", input.sessionId);
    return { plaintext };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[decryptMessage] error", error instanceof Error ? error.stack || error.message : error);

    if (message.includes("DuplicatedMessage") || message.includes("old counter")) {
      console.warn("[decryptMessage] duplicated message, treating as already-decrypted", input.sessionId);
      return { plaintext: "[Message already decrypted; using cached value]" };
    }

    throw error;
  }
}