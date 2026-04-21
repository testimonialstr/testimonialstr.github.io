import type { Event, EventTemplate } from "nostr-tools/pure";

export type Nip07 = {
  getPublicKey(): Promise<string>;
  signEvent(ev: EventTemplate): Promise<Event>;
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
};

declare global {
  interface Window {
    nostr?: Nip07;
  }
}

export function getNip07(): Nip07 | null {
  return typeof window !== "undefined" && window.nostr ? window.nostr : null;
}

/** Wait up to `timeoutMs` for a NIP-07 extension to inject `window.nostr`. */
export async function waitForNip07(timeoutMs = 2500): Promise<Nip07 | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const n = getNip07();
    if (n) return n;
    await new Promise((r) => setTimeout(r, 100));
  }
  return getNip07();
}
