import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Event } from "nostr-tools/pure";
import { pool, relays } from "./relay";
import { useAuth } from "./auth";
import { writeRelaysFor } from "../lib/nip65";
import {
  KIND_REJECT_LIST,
  buildRejectListTemplate,
  parseRejectList,
} from "../nip-a1/rejectList";

type State = {
  ids: Record<string, true>;
  innerIds: Record<string, true>;
  syncedFor: string | null;
  reject: (wrapId: string, innerId?: string) => void;
  rejectInner: (innerId: string) => void;
  unrejectInner: (innerId: string) => void;
  isRejected: (wrapId: string) => boolean;
  isInnerRejected: (innerId: string) => boolean;
  sync: () => Promise<void>;
  publish: () => Promise<void>;
};

let publishTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePublish(publish: () => Promise<void>) {
  if (publishTimer) clearTimeout(publishTimer);
  publishTimer = setTimeout(() => {
    publishTimer = null;
    publish().catch(() => {});
  }, 600);
}

export const useRejected = create<State>()(
  persist(
    (set, get) => ({
      ids: {},
      innerIds: {},
      syncedFor: null,

      reject: (wrapId, innerId) => {
        set({
          ids: { ...get().ids, [wrapId]: true },
          innerIds: innerId
            ? { ...get().innerIds, [innerId]: true }
            : get().innerIds,
        });
        if (innerId) schedulePublish(get().publish);
      },

      rejectInner: (innerId) => {
        set({ innerIds: { ...get().innerIds, [innerId]: true } });
        schedulePublish(get().publish);
      },

      unrejectInner: (innerId) => {
        const next = { ...get().innerIds };
        delete next[innerId];
        set({ innerIds: next });
        schedulePublish(get().publish);
      },

      isRejected: (id) => !!get().ids[id],
      isInnerRejected: (id) => !!get().innerIds[id],

      sync: async () => {
        const { pubkey, signer } = useAuth.getState();
        if (!pubkey || !signer?.nip44) return;

        const prior = get().syncedFor;
        if (prior && prior !== pubkey) {
          set({ ids: {}, innerIds: {} });
        }

        const ev = (await pool.get(relays(), {
          kinds: [KIND_REJECT_LIST],
          authors: [pubkey],
        })) as Event | null;

        const remoteIds = await parseRejectList(
          ev,
          pubkey,
          signer.nip44.decrypt,
        );

        const local = get().innerIds;
        const merged: Record<string, true> = { ...local };
        for (const id of remoteIds) merged[id] = true;

        const hasLocalOnly = Object.keys(local).some(
          (id) => !remoteIds.includes(id),
        );

        set({ innerIds: merged, syncedFor: pubkey });

        if (hasLocalOnly) {
          schedulePublish(get().publish);
        }
      },

      publish: async () => {
        const { pubkey, signer } = useAuth.getState();
        if (!pubkey || !signer?.nip44) return;

        const ids = Object.keys(get().innerIds);
        const tmpl = await buildRejectListTemplate(
          ids,
          pubkey,
          signer.nip44.encrypt,
        );
        const signed = await signer.signEvent(tmpl);

        const writes = await writeRelaysFor(pubkey).catch(() => [] as string[]);
        const targets = [...new Set([...writes, ...relays()])];
        await Promise.any(pool.publish(targets, signed));
      },
    }),
    { name: "testimonialstr-rejected" },
  ),
);
