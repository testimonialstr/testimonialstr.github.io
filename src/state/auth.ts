import { create } from "zustand";
import { getNip07, waitForNip07, type Nip07 } from "../lib/nip07";

const PUBKEY_KEY = "testimonialstr-pubkey";

type State = {
  signer: Nip07 | null;
  pubkey: string | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  restore: () => Promise<void>;
  logout: () => void;
};

async function pickSigner(wait: boolean): Promise<Nip07> {
  const nip07 = wait ? await waitForNip07() : getNip07();
  if (!nip07) throw new Error("No NIP-07 extension found");
  if (!nip07.nip44)
    throw new Error(
      "Your NIP-07 extension doesn't expose nip44 — required to decrypt the inbox.",
    );
  return nip07;
}

function getStoredPubkey(): string | null {
  try {
    return localStorage.getItem(PUBKEY_KEY);
  } catch {
    return null;
  }
}

export const useAuth = create<State>()((set) => ({
  signer: null,
  pubkey: null,
  loading: false,
  error: null,

  login: async () => {
    set({ loading: true, error: null });
    try {
      const nip07 = await pickSigner(false);
      const pk = await nip07.getPublicKey();
      set({ signer: nip07, pubkey: pk, loading: false });
      try {
        localStorage.setItem(PUBKEY_KEY, pk);
      } catch {}
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? String(e) });
    }
  },

  /** Trust the persisted pubkey; skip getPublicKey() so the extension doesn't re-prompt. */
  restore: async () => {
    const stored = getStoredPubkey();
    if (!stored) return;
    set({ loading: true });
    try {
      const nip07 = await pickSigner(true);
      set({ signer: nip07, pubkey: stored, loading: false });
    } catch {
      try {
        localStorage.removeItem(PUBKEY_KEY);
      } catch {}
      set({ loading: false });
    }
  },

  logout: () => {
    set({ signer: null, pubkey: null, error: null });
    try {
      localStorage.removeItem(PUBKEY_KEY);
    } catch {}
  },
}));

export function wasLoggedIn(): boolean {
  return !!getStoredPubkey();
}
