import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type Event,
} from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import type { Nip07 } from "../lib/nip07";

export const KIND_WRAP = 1059;

/**
 * NIP-A1 diverges from NIP-59: the inner rumor is a SIGNED kind:63 event,
 * and the seal (kind:13) is intentionally OMITTED — its authentication role
 * is redundant when the inner event is already signed by the author.
 */

function randomTimestamp(): number {
  const now = Math.floor(Date.now() / 1000);
  return now - Math.floor(Math.random() * 60 * 60 * 24 * 2);
}

export type WrapOptions = { expiresInDays?: number };

/**
 * Wrap a signed kind:63 with an ephemeral key. Encryption uses NIP-44 with the
 * ephemeral private key — this never leaves this function, so we don't need
 * NIP-07 nip44 support for SENDING. Receiving still does.
 */
export function wrapSignedEvent(
  signedInner: Event,
  recipientPk: string,
  opts: WrapOptions = {},
): Event {
  const ephSk = generateSecretKey();
  const convKey = nip44.v2.utils.getConversationKey(ephSk, recipientPk);
  const content = nip44.v2.encrypt(JSON.stringify(signedInner), convKey);

  const days = opts.expiresInDays ?? 30;
  // No `alt` (NIP-31): would distinguish testimonials from other gift wraps to passive observers.
  const tags: string[][] = [["p", recipientPk]];
  if (days > 0) {
    const exp = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
    tags.push(["expiration", String(exp)]);
  }

  return finalizeEvent(
    { kind: KIND_WRAP, created_at: randomTimestamp(), tags, content },
    ephSk,
  );
}

/** Used internally by the test-vectors check; production sending uses wrapSignedEvent. */
export function ephemeralPubkey(sk: Uint8Array): string {
  return getPublicKey(sk);
}

/**
 * Decrypt and parse a kind:1059 wrap addressed to the user. Requires NIP-44
 * decrypt on the signer (every modern NIP-07 extension supports this).
 */
export async function unwrapSignedEvent(
  wrap: Event,
  signer: Nip07,
): Promise<Event> {
  if (wrap.kind !== KIND_WRAP) throw new Error("not a gift wrap");
  if (!signer.nip44) throw new Error("signer lacks nip44 support");
  const json = await signer.nip44.decrypt(wrap.pubkey, wrap.content);
  return JSON.parse(json) as Event;
}
