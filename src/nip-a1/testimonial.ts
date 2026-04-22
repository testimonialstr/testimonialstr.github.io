import type { EventTemplate } from "nostr-tools/pure";

export const KIND_TESTIMONIAL = 63;
export const MAX_TESTIMONIAL_CHARS = 2000;

export function buildTestimonial(
  recipientPk: string,
  content: string,
): EventTemplate {
  return {
    kind: KIND_TESTIMONIAL,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["p", recipientPk]],
    content,
  };
}
