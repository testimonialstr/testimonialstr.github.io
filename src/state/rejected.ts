import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Event } from "nostr-tools/pure";
import { useAuth } from "./auth";

/**
 * NIP-A1 v2 rejection is local-only. We cache the inner kind:63 per
 * rejection (rejected events never reach relays, so we can't refetch them
 * for the Rejected view) and key buckets by pubkey so switching accounts
 * doesn't leak the blacklist across users.
 */

type Bucket = {
  ids: Record<string, true>;
  innerIds: Record<string, true>;
  innerEvents: Record<string, Event>;
};

const EMPTY_BUCKET: Bucket = { ids: {}, innerIds: {}, innerEvents: {} };

type State = {
  byPubkey: Record<string, Bucket>;
  reject: (envelopeId: string, inner?: Event) => void;
  rejectInner: (inner: Event) => void;
  unrejectInner: (innerId: string) => void;
  isRejected: (envelopeId: string) => boolean;
  isInnerRejected: (innerId: string) => boolean;
};

function currentPubkey(): string | null {
  return useAuth.getState().pubkey;
}

function updateBucket(
  state: State,
  pk: string,
  patch: (b: Bucket) => Bucket,
): State {
  const existing = state.byPubkey[pk] ?? EMPTY_BUCKET;
  return {
    ...state,
    byPubkey: { ...state.byPubkey, [pk]: patch(existing) },
  };
}

export const useRejected = create<State>()(
  persist(
    (set, get) => ({
      byPubkey: {},

      reject: (envelopeId, inner) => {
        const pk = currentPubkey();
        if (!pk) return;
        set((s) =>
          updateBucket(s, pk, (b) => ({
            ids: { ...b.ids, [envelopeId]: true },
            innerIds: inner
              ? { ...b.innerIds, [inner.id]: true }
              : b.innerIds,
            innerEvents: inner
              ? { ...b.innerEvents, [inner.id]: inner }
              : b.innerEvents,
          })),
        );
      },

      rejectInner: (inner) => {
        const pk = currentPubkey();
        if (!pk) return;
        set((s) =>
          updateBucket(s, pk, (b) => ({
            ...b,
            innerIds: { ...b.innerIds, [inner.id]: true },
            innerEvents: { ...b.innerEvents, [inner.id]: inner },
          })),
        );
      },

      unrejectInner: (innerId) => {
        const pk = currentPubkey();
        if (!pk) return;
        set((s) =>
          updateBucket(s, pk, (b) => {
            const nextIds = { ...b.innerIds };
            delete nextIds[innerId];
            const nextEvents = { ...b.innerEvents };
            delete nextEvents[innerId];
            return { ...b, innerIds: nextIds, innerEvents: nextEvents };
          }),
        );
      },

      isRejected: (id) => {
        const pk = currentPubkey();
        if (!pk) return false;
        return !!get().byPubkey[pk]?.ids[id];
      },

      isInnerRejected: (id) => {
        const pk = currentPubkey();
        if (!pk) return false;
        return !!get().byPubkey[pk]?.innerIds[id];
      },
    }),
    {
      name: "testimonialstr-rejected",
      version: 3,
      migrate: () => ({ byPubkey: {} }),
    },
  ),
);

export function useRejectedBucket(): Bucket {
  const pk = useAuth((s) => s.pubkey);
  return useRejected((s) =>
    pk ? s.byPubkey[pk] ?? EMPTY_BUCKET : EMPTY_BUCKET,
  );
}
