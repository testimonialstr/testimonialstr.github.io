import { useEffect, useState } from "react";
import { verifyEvent, type Event } from "nostr-tools/pure";
import { useAuth } from "../state/auth";
import { pool, relays } from "../state/relay";
import { prefetchProfiles } from "../state/profiles";
import { KIND_TESTIMONIAL } from "../nip-a1/testimonial";
import { KIND_ENVELOPE } from "../nip-a1/envelope";
import { wrapDeliveryRelaysFor } from "../lib/nip65";
import { AuthorLine } from "./Avatar";
import { RichText } from "../lib/richtext";
import { CardSkeleton } from "./Skeleton";

type Row = {
  status: "accepted" | "pending";
  /** kind:63 id when accepted, kind:64 envelope id when pending — the kind:5 target. */
  id: string;
  recipientPk: string;
  content: string;
  createdAt: number;
  expiresAt: number | null;
};

async function collect(
  filter: any,
  timeoutMs = 3000,
): Promise<Event[]> {
  return new Promise((resolve) => {
    const acc: Event[] = [];
    const seen = new Set<string>();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sub.close();
      resolve(acc);
    };
    const sub = pool.subscribeMany(relays(), filter, {
      onevent: (ev: Event) => {
        if (seen.has(ev.id)) return;
        seen.add(ev.id);
        acc.push(ev);
      },
      oneose: finish,
    });
    setTimeout(finish, timeoutMs);
  });
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatExpires(ts: number): string {
  const diffMs = ts * 1000 - Date.now();
  if (diffMs <= 0) return "expired";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days >= 2) return `expires in ${days} days`;
  const hours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  return `expires in ${hours}h`;
}

export default function SentPage() {
  const { pubkey, signer } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!pubkey || !signer) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows([]);

    (async () => {
      try {
        const [sent, envs, deletions] = await Promise.all([
          collect({ kinds: [KIND_TESTIMONIAL], authors: [pubkey] }),
          collect({ kinds: [KIND_ENVELOPE], authors: [pubkey] }),
          collect({ kinds: [5], authors: [pubkey] }),
        ]);
        if (cancelled) return;

        const deletedIds = new Set<string>();
        for (const d of deletions) {
          for (const t of d.tags) {
            if (t[0] === "e" && t[1]) deletedIds.add(t[1]);
          }
        }

        const accepted: Row[] = [];
        for (const ev of sent) {
          if (deletedIds.has(ev.id)) continue;
          if (!verifyEvent(ev)) continue;
          const pTag = ev.tags.find((t) => t[0] === "p");
          if (!pTag) continue;
          accepted.push({
            status: "accepted",
            id: ev.id,
            recipientPk: pTag[1],
            content: ev.content,
            createdAt: ev.created_at,
            expiresAt: null,
          });
        }
        const acceptedInnerIds = new Set(accepted.map((r) => r.id));

        const pending: Row[] = [];
        if (signer.nip44) {
          for (const env of envs) {
            if (cancelled) return;
            if (deletedIds.has(env.id)) continue;
            const pTag = env.tags.find((t) => t[0] === "p");
            if (!pTag) continue;
            const recipientPk = pTag[1];
            let inner: Event;
            try {
              const json = await signer.nip44.decrypt(recipientPk, env.content);
              inner = JSON.parse(json) as Event;
            } catch {
              continue;
            }
            if (inner.kind !== KIND_TESTIMONIAL) continue;
            if (inner.pubkey !== pubkey) continue;
            if (acceptedInnerIds.has(inner.id)) continue;
            if (deletedIds.has(inner.id)) continue;
            const expTag = env.tags.find((t) => t[0] === "expiration");
            pending.push({
              status: "pending",
              id: env.id,
              recipientPk,
              content: inner.content,
              createdAt: env.created_at,
              expiresAt: expTag ? Number(expTag[1]) : null,
            });
          }
        }

        const all = [...accepted, ...pending].sort(
          (a, b) => b.createdAt - a.createdAt,
        );

        prefetchProfiles(Array.from(new Set(all.map((r) => r.recipientPk))));
        if (!cancelled) setRows(all);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pubkey, signer]);

  async function remove(r: Row) {
    if (!pubkey || !signer) return;
    const confirmMsg =
      r.status === "accepted"
        ? "Publish a retraction (kind:5) for this testimonial? Clients that honor NIP-09 will hide it on the recipient's profile. This action is irreversible."
        : "Delete this pending envelope? Publishes a kind:5 that removes the kind:64 from compliant relays — the recipient won't be able to accept it. This action is irreversible.";
    if (!confirm(confirmMsg)) return;
    setBusyId(r.id);
    try {
      const template = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["e", r.id],
          [
            "k",
            String(
              r.status === "accepted" ? KIND_TESTIMONIAL : KIND_ENVELOPE,
            ),
          ],
        ],
        content: "",
      };
      const signed = await signer.signEvent(template);
      const targets =
        r.status === "pending"
          ? [
              ...new Set([
                ...(await wrapDeliveryRelaysFor(r.recipientPk).catch(
                  () => [] as string[],
                )),
                ...relays(),
              ]),
            ]
          : relays();
      await Promise.any(pool.publish(targets, signed));
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!pubkey) return null;

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const acceptedCount = rows.length - pendingCount;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Sent</h1>
        <div className="muted small">
          {loading
            ? "Fetching from relays…"
            : rows.length === 0
              ? "Nothing to show"
              : `${acceptedCount} accepted · ${pendingCount} pending`}
        </div>
      </div>

      <div className="muted small inbox-help">
        Testimonials you wrote. <strong>Pending</strong> are encrypted{" "}
        <code>kind:64</code> envelopes the recipient hasn't accepted yet —
        delete publishes a <code>kind:5</code> on the envelope (NIP-A1 v2
        lets authors retract pending deliveries).{" "}
        <strong>Accepted</strong> are the public <code>kind:63</code> events
        the recipient published — delete publishes a <code>kind:5</code>{" "}
        retraction; compliant clients hide the testimonial.
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && rows.length === 0 ? (
        <div className="testimonial-grid">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-quote">“</div>
          <p>
            You haven't sent any testimonials yet. Visit someone's profile and
            write one — it will appear here until the recipient accepts it.
          </p>
        </div>
      ) : (
        <ul className="inbox-list">
          {rows.map((r) => (
            <li key={r.id} className="inbox-item">
              <div className="inbox-item-head">
                <AuthorLine pk={r.recipientPk} />
                <span
                  className={
                    "badge " +
                    (r.status === "accepted" ? "badge-ok" : "badge-bad")
                  }
                >
                  {r.status === "accepted" ? "accepted · kind:63" : "pending · kind:64"}
                </span>
              </div>
              <blockquote className="inbox-quote">
                <RichText text={r.content} />
              </blockquote>
              <div className="inbox-actions">
                <time className="muted small">
                  {formatDate(r.createdAt)}
                  {r.status === "pending" && r.expiresAt
                    ? ` · ${formatExpires(r.expiresAt)}`
                    : ""}
                </time>
                <button
                  className="link-btn danger"
                  disabled={busyId === r.id}
                  onClick={() => remove(r)}
                >
                  {busyId === r.id
                    ? "Publishing…"
                    : r.status === "accepted"
                      ? "Delete (kind:5)"
                      : "Cancel envelope (kind:5)"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
