import { verifyEvent, type Event } from "nostr-tools/pure";
import { KIND_TESTIMONIAL } from "./testimonial";

export type VerifyResult =
  | { ok: true; authorPk: string; recipientPk: string; content: string }
  | { ok: false; reason: string };

/** Inner pubkey must match envelope pubkey — blocks replay under someone else's envelope. */
export function verifyTestimonialInEnvelope(
  inner: Event,
  envelopePk: string,
  expectedRecipientPk: string,
): VerifyResult {
  if (inner.pubkey !== envelopePk)
    return { ok: false, reason: "inner pubkey does not match envelope sender" };
  return verifyTestimonial(inner, expectedRecipientPk);
}

export function verifyTestimonial(
  inner: Event,
  expectedRecipientPk: string,
): VerifyResult {
  if (inner.kind !== KIND_TESTIMONIAL)
    return { ok: false, reason: `invalid kind: ${inner.kind}` };

  if (!verifyEvent(inner))
    return { ok: false, reason: "invalid author signature" };

  const pTag = inner.tags.find((t) => t[0] === "p");
  if (!pTag) return { ok: false, reason: "missing p tag" };
  if (pTag[1] !== expectedRecipientPk)
    return { ok: false, reason: "p tag does not match recipient" };

  return {
    ok: true,
    authorPk: inner.pubkey,
    recipientPk: pTag[1],
    content: inner.content,
  };
}
