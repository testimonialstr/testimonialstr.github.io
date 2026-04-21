import type { Event, EventTemplate } from "nostr-tools/pure";

export const KIND_TESTIMONIAL_LIST = 10064;

export type TestimonialRef = {
  id: string;
  authorPk: string;
  relayHint?: string;
};

export function parseList(ev: Event | null): TestimonialRef[] {
  if (!ev) return [];
  return ev.tags
    .filter((t) => t[0] === "e" && t[1])
    .map((t) => ({
      id: t[1],
      relayHint: t[2] || undefined,
      authorPk: t[3] || "",
    }));
}

export function buildListTemplate(refs: TestimonialRef[]): EventTemplate {
  const tags = refs.map((r) => ["e", r.id, r.relayHint ?? "", r.authorPk]);
  return {
    kind: KIND_TESTIMONIAL_LIST,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "",
  };
}

export function addRef(refs: TestimonialRef[], r: TestimonialRef) {
  if (refs.some((x) => x.id === r.id)) return refs;
  return [...refs, r];
}

export function removeRef(refs: TestimonialRef[], id: string) {
  return refs.filter((r) => r.id !== id);
}
