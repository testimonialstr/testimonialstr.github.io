import type { Event } from "nostr-tools/pure";
import { pool, relays as configuredRelays } from "../state/relay";

const KIND_RELAY_LIST = 10002;
const KIND_DM_RELAY_LIST = 10050;

export type RelayMeta = { url: string; read: boolean; write: boolean };

function parseRelayList(ev: Event | null): RelayMeta[] {
  if (!ev) return [];
  return ev.tags
    .filter((t) => t[0] === "r" && t[1])
    .map((t) => {
      const marker = t[2];
      return {
        url: t[1],
        read: !marker || marker === "read",
        write: !marker || marker === "write",
      };
    });
}

function parseDmRelayList(ev: Event | null): string[] {
  if (!ev) return [];
  return ev.tags.filter((t) => t[0] === "relay" && t[1]).map((t) => t[1]);
}

const cache = new Map<string, RelayMeta[]>();
const dmCache = new Map<string, string[]>();

export async function fetchRelayList(pk: string): Promise<RelayMeta[]> {
  if (cache.has(pk)) return cache.get(pk)!;
  const ev = (await pool.get(configuredRelays(), {
    kinds: [KIND_RELAY_LIST],
    authors: [pk],
  })) as Event | null;
  const list = parseRelayList(ev);
  cache.set(pk, list);
  return list;
}

export async function fetchDmRelayList(pk: string): Promise<string[]> {
  if (dmCache.has(pk)) return dmCache.get(pk)!;
  const ev = (await pool.get(configuredRelays(), {
    kinds: [KIND_DM_RELAY_LIST],
    authors: [pk],
  })) as Event | null;
  const list = parseDmRelayList(ev);
  dmCache.set(pk, list);
  return list;
}

export async function wrapDeliveryRelaysFor(pk: string): Promise<string[]> {
  const dm = await fetchDmRelayList(pk);
  if (dm.length > 0) return dm;
  const general = await fetchRelayList(pk);
  const writes = general.filter((r) => r.write).map((r) => r.url);
  return writes.length > 0 ? writes : configuredRelays();
}

export async function writeRelaysFor(pk: string): Promise<string[]> {
  const list = await fetchRelayList(pk);
  const writes = list.filter((r) => r.write).map((r) => r.url);
  return writes.length > 0 ? writes : configuredRelays();
}
