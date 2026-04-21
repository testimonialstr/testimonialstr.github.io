import { useEffect, useState } from "react";
import type { Event } from "nostr-tools/pure";
import { pool, relays } from "./relay";

export type Profile = {
  name?: string;
  display_name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
};

const STORAGE_KEY = "testimonialstr-profiles-v1";
const TTL_MS = 1000 * 60 * 60 * 24;

type Cached = { p: Profile; t: number };
const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<Profile>>();
const listeners = new Set<() => void>();

function loadFromDisk() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, Cached>;
    for (const [k, v] of Object.entries(obj)) {
      if (Date.now() - v.t < TTL_MS) cache.set(k, v);
    }
  } catch {}
}

function saveToDisk() {
  try {
    const obj: Record<string, Cached> = {};
    for (const [k, v] of cache.entries()) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

loadFromDisk();

async function fetchProfile(pk: string): Promise<Profile> {
  const cached = cache.get(pk);
  if (cached && Date.now() - cached.t < TTL_MS) return cached.p;
  if (inflight.has(pk)) return inflight.get(pk)!;
  const p = (async (): Promise<Profile> => {
    try {
      const ev = (await pool.get(relays(), {
        kinds: [0],
        authors: [pk],
      })) as Event | null;
      if (!ev) return {};
      try {
        return JSON.parse(ev.content) as Profile;
      } catch {
        return {};
      }
    } catch {
      return {};
    }
  })();
  inflight.set(pk, p);
  const res = await p;
  cache.set(pk, { p: res, t: Date.now() });
  inflight.delete(pk);
  saveToDisk();
  listeners.forEach((l) => l());
  return res;
}

export function useProfile(pk: string | undefined): Profile {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!pk) return;
    const cached = cache.get(pk);
    if (!cached || Date.now() - cached.t > TTL_MS) fetchProfile(pk);
    const l = () => tick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [pk]);
  return (pk && cache.get(pk)?.p) || {};
}

export function profileName(p: Profile, fallback: string): string {
  return p.display_name || p.name || fallback;
}

/** Bulk-fetch kind:0 for many pubkeys in one REQ. Results feed the same cache as useProfile. */
export async function prefetchProfiles(pks: string[]): Promise<void> {
  const missing = pks.filter((pk) => {
    const c = cache.get(pk);
    return !c || Date.now() - c.t > TTL_MS;
  });
  if (missing.length === 0) return;

  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 200) {
    chunks.push(missing.slice(i, i + 200));
  }

  await Promise.all(
    chunks.map(
      (authors) =>
        new Promise<void>((resolve) => {
          const sub = pool.subscribeMany(
            relays(),
            { kinds: [0], authors },
            {
              onevent: (ev: Event) => {
                try {
                  const p = JSON.parse(ev.content) as Profile;
                  const prev = cache.get(ev.pubkey);
                  if (!prev || ev.created_at * 1000 >= prev.t - TTL_MS) {
                    cache.set(ev.pubkey, { p, t: Date.now() });
                  }
                } catch {}
              },
              oneose: () => {
                sub.close();
                saveToDisk();
                listeners.forEach((l) => l());
                resolve();
              },
            },
          );
          setTimeout(() => {
            sub.close();
            saveToDisk();
            listeners.forEach((l) => l());
            resolve();
          }, 4000);
        }),
    ),
  );
}
