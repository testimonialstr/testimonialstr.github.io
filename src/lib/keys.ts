import { nip19 } from "nostr-tools";

export function npub(pk: string): string {
  return nip19.npubEncode(pk);
}

export function shortNpub(pk: string): string {
  const n = npub(pk);
  return `${n.slice(0, 12)}…${n.slice(-6)}`;
}

export function decodeNpub(input: string): string {
  const trimmed = input.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  const decoded = nip19.decode(trimmed);
  if (decoded.type === "npub") return decoded.data as string;
  if (decoded.type === "nprofile") return (decoded.data as { pubkey: string }).pubkey;
  throw new Error("invalid npub");
}
