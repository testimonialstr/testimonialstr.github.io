import { create } from "zustand";
import { getNip07, waitForNip07, type Nip07 } from "../lib/nip07";

const FLAG_KEY = "testimonialstr-was-logged-in";

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
        localStorage.setItem(FLAG_KEY, "1");
      } catch {}
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? String(e) });
    }
  },

  /** Silent re-login on app boot. Waits for the extension to inject itself. */
  restore: async () => {
    if (!wasLoggedIn()) return;
    set({ loading: true });
    try {
      const nip07 = await pickSigner(true);
      const pk = await nip07.getPublicKey();
      set({ signer: nip07, pubkey: pk, loading: false });
    } catch {
      // Extension not available or user revoked — clear the flag so we show the onboarding.
      try {
        localStorage.removeItem(FLAG_KEY);
      } catch {}
      set({ loading: false });
    }
  },

  logout: () => {
    set({ signer: null, pubkey: null, error: null });
    try {
      localStorage.removeItem(FLAG_KEY);
    } catch {}
  },
}));

export function wasLoggedIn(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}
