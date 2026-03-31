import {
  KEMPublicKey,
  PreKeyBundle,
  PublicKey,
} from "@signalapp/libsignal-client";
import { PublicBundle } from "../types";
import { base64ToBytes } from "../utils/signalSerde";

export function buildPreKeyBundle(bundle: PublicBundle): PreKeyBundle {
  if (
    bundle.registrationId == null ||
    bundle.deviceId == null ||
    bundle.signedPreKeyId == null ||
    bundle.oneTimePreKeyId == null ||
    bundle.kyberPreKeyId == null ||
    !bundle.kyberPreKey ||
    !bundle.kyberPreKeySignature
  ) {
    throw new Error("Recipient bundle is missing required Signal fields");
  }

  const identityKey = PublicKey.deserialize(base64ToBytes(bundle.identityKey));
  const signedPreKey = PublicKey.deserialize(base64ToBytes(bundle.signedPreKey));
  const preKey = PublicKey.deserialize(base64ToBytes(bundle.oneTimePreKey));
  const kyberPreKey = KEMPublicKey.deserialize(base64ToBytes(bundle.kyberPreKey));

  return PreKeyBundle.new(
    bundle.registrationId,
    bundle.deviceId,
    bundle.oneTimePreKeyId,
    preKey,
    bundle.signedPreKeyId,
    signedPreKey,
    base64ToBytes(bundle.signedPreKeySignature),
    identityKey,
    bundle.kyberPreKeyId,
    kyberPreKey,
    base64ToBytes(bundle.kyberPreKeySignature)
  );
}