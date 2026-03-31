import { EncryptInput, EncryptOutput } from "../types";
import { encryptWithSignal } from "../signal/sessionCrypto";

export async function encryptMessage(input: EncryptInput): Promise<EncryptOutput> {
  if (!input.from || !input.to || !input.plaintext) {
    throw new Error("from, to, plaintext are required");
  }

  if (!input.recipientBundle) {
    throw new Error("recipientBundle is required");
  }

  return encryptWithSignal(
    input.from,
    input.to,
    input.recipientBundle,
    input.plaintext
  );
}