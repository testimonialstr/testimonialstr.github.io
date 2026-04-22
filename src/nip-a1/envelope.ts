import type { Event, EventTemplate } from "nostr-tools/pure";
import type { Nip07 } from "../lib/nip07";

export const KIND_ENVELOPE = 64;

/** Spec guidance: 7–90 days. */
const EXPIRATION_DAYS = 30;

export async function buildEnvelope(
  signedInner: Event,
  recipientPk: string,
  signer: Nip07,
): Promise<Event> {
  if (!signer.nip44)
    throw new Error("signer lacks nip44 support — required to send");

  const ciphertext = await signer.nip44.encrypt(
    recipientPk,
    JSON.stringify(signedInner),
  );

  const now = Math.floor(Date.now() / 1000);
  const template: EventTemplate = {
    kind: KIND_ENVELOPE,
    created_at: now,
    tags: [
      ["p", recipientPk],
      ["expiration", String(now + EXPIRATION_DAYS * 24 * 60 * 60)],
    ],
    content: ciphertext,
  };
  return signer.signEvent(template);
}

export async function openEnvelope(
  envelope: Event,
  signer: Nip07,
): Promise<Event> {
  if (envelope.kind !== KIND_ENVELOPE) throw new Error("not a kind:64 envelope");
  if (!signer.nip44) throw new Error("signer lacks nip44 support");
  const json = await signer.nip44.decrypt(envelope.pubkey, envelope.content);
  return JSON.parse(json) as Event;
}
