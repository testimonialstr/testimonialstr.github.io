import { create } from "zustand";
import type { Event } from "nostr-tools/pure";
import { pool, relays } from "./relay";
import {
  KIND_TESTIMONIAL_LIST,
  parseList,
  type TestimonialRef,
} from "../nip-a1/list";

type Entry = { refs: TestimonialRef[]; fetchedAt: number };

type State = {
  cache: Record<string, Entry>;
  loading: Record<string, boolean>;
  fetch: (pk: string, force?: boolean) => Promise<TestimonialRef[]>;
  getRefs: (pk: string) => TestimonialRef[];
  setRefs: (pk: string, refs: TestimonialRef[]) => void;
};

export const useTestimonialList = create<State>()((set, get) => ({
  cache: {},
  loading: {},

  fetch: async (pk, force = false) => {
    const s = get();
    if (!force && s.cache[pk] && !s.loading[pk]) return s.cache[pk].refs;
    set({ loading: { ...get().loading, [pk]: true } });
    const ev = (await pool.get(relays(), {
      kinds: [KIND_TESTIMONIAL_LIST],
      authors: [pk],
    })) as Event | null;
    const refs = parseList(ev);
    set({
      cache: { ...get().cache, [pk]: { refs, fetchedAt: Date.now() } },
      loading: { ...get().loading, [pk]: false },
    });
    return refs;
  },

  getRefs: (pk) => get().cache[pk]?.refs ?? [],

  setRefs: (pk, refs) =>
    set({
      cache: { ...get().cache, [pk]: { refs, fetchedAt: Date.now() } },
    }),
}));
