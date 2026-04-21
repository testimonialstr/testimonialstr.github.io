import { create } from "zustand";
import type { Event } from "nostr-tools/pure";
import { pool, relays } from "./relay";
import { prefetchProfiles } from "./profiles";
import { useAuth } from "./auth";
import { writeRelaysFor } from "../lib/nip65";

const KIND_CONTACTS = 3;

type Entry = {
  pks: string[];
  fetchedAt: number;
  rawEvent: Event | null;
};

type State = {
  cache: Record<string, Entry>;
  loading: Record<string, boolean>;
  fetch: (pk: string, force?: boolean) => Promise<string[]>;
  get: (pk: string) => string[];
  isFollowing: (ownerPk: string, targetPk: string) => boolean;
  follow: (targetPk: string) => Promise<void>;
  unfollow: (targetPk: string) => Promise<void>;
};

function parseFollows(ev: Event | null): string[] {
  if (!ev) return [];
  return Array.from(
    new Set(
      ev.tags
        .filter((t) => t[0] === "p" && /^[0-9a-f]{64}$/i.test(t[1] || ""))
        .map((t) => t[1].toLowerCase()),
    ),
  );
}

export const useFollows = create<State>()((set, get) => ({
  cache: {},
  loading: {},

  fetch: async (pk, force = false) => {
    const s = get();
    if (!force && s.cache[pk]) return s.cache[pk].pks;
    if (s.loading[pk]) return s.cache[pk]?.pks ?? [];
    set({ loading: { ...get().loading, [pk]: true } });
    const ev = (await pool.get(relays(), {
      kinds: [KIND_CONTACTS],
      authors: [pk],
    })) as Event | null;
    const pks = parseFollows(ev);
    set({
      cache: {
        ...get().cache,
        [pk]: { pks, fetchedAt: Date.now(), rawEvent: ev },
      },
      loading: { ...get().loading, [pk]: false },
    });
    if (pks.length > 0) prefetchProfiles(pks);
    return pks;
  },

  get: (pk) => get().cache[pk]?.pks ?? [],

  isFollowing: (ownerPk, targetPk) =>
    (get().cache[ownerPk]?.pks ?? []).includes(targetPk),

  follow: async (targetPk) => {
    await mutateFollows(get, set, targetPk, "add");
  },

  unfollow: async (targetPk) => {
    await mutateFollows(get, set, targetPk, "remove");
  },
}));

async function mutateFollows(
  get: () => State,
  set: (partial: Partial<State>) => void,
  targetPk: string,
  op: "add" | "remove",
) {
  const { pubkey, signer } = useAuth.getState();
  if (!pubkey || !signer) throw new Error("not logged in");

  // Make sure we have the current state before editing — preserves non-p tags and content.
  let entry = get().cache[pubkey];
  if (!entry) {
    await get().fetch(pubkey, true);
    entry = get().cache[pubkey];
  }
  const prevTags = entry?.rawEvent?.tags ?? [];
  const prevContent = entry?.rawEvent?.content ?? "";

  const nonP = prevTags.filter((t) => t[0] !== "p");
  const pTagsOther = prevTags.filter((t) => t[0] === "p" && t[1] !== targetPk);
  const newTags =
    op === "add" ? [...nonP, ...pTagsOther, ["p", targetPk]] : [...nonP, ...pTagsOther];

  const signed = await signer.signEvent({
    kind: KIND_CONTACTS,
    created_at: Math.floor(Date.now() / 1000),
    tags: newTags,
    content: prevContent,
  });

  const writes = await writeRelaysFor(pubkey);
  const targets = [...new Set([...writes, ...relays()])];
  await Promise.any(pool.publish(targets, signed));

  const newPks = parseFollows(signed);
  set({
    cache: {
      ...get().cache,
      [pubkey]: { pks: newPks, fetchedAt: Date.now(), rawEvent: signed },
    },
  });
}
