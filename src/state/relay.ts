import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SimplePool } from "nostr-tools/pool";

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.wine",
];

type State = {
  urls: string[];
  setUrls: (u: string[]) => void;
  addUrl: (u: string) => void;
  removeUrl: (u: string) => void;
};

export const useRelay = create<State>()(
  persist(
    (set, get) => ({
      urls: DEFAULT_RELAYS,
      setUrls: (urls) => set({ urls }),
      addUrl: (u) => {
        const url = u.trim();
        if (!url) return;
        if (get().urls.includes(url)) return;
        set({ urls: [...get().urls, url] });
      },
      removeUrl: (u) => set({ urls: get().urls.filter((x) => x !== u) }),
    }),
    { name: "testimonialstr-relays" },
  ),
);

export const pool = new SimplePool();

export function relays(): string[] {
  return useRelay.getState().urls;
}
