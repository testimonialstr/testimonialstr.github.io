import { useEffect, useState } from "react";
import { verifyEvent, type Event } from "nostr-tools/pure";
import { useAuth } from "../state/auth";
import { pool, relays } from "../state/relay";
import { prefetchProfiles } from "../state/profiles";
import { KIND_TESTIMONIAL } from "../nip-a1/testimonial";
import { AuthorLine } from "./Avatar";
import { RichText } from "../lib/richtext";
import { CardSkeleton } from "./Skeleton";

type Row = {
  ev: Event;
  recipientPk: string;
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

export default function SentPage() {
  const { pubkey, signer } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!pubkey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows([]);

    (async () => {
      try {
        const [sent, deletions] = await Promise.all([
          collect({ kinds: [KIND_TESTIMONIAL], authors: [pubkey] }),
          collect({ kinds: [5], authors: [pubkey] }),
        ]);
        if (cancelled) return;

        const deletedIds = new Set<string>();
        for (const d of deletions) {
          for (const t of d.tags) {
            if (t[0] === "e" && t[1]) deletedIds.add(t[1]);
          }
        }

        const built: Row[] = [];
        for (const ev of sent) {
          if (deletedIds.has(ev.id)) continue;
          if (!verifyEvent(ev)) continue;
          const pTag = ev.tags.find((t) => t[0] === "p");
          if (!pTag) continue;
          built.push({ ev, recipientPk: pTag[1] });
        }
        built.sort((a, b) => b.ev.created_at - a.ev.created_at);

        prefetchProfiles(built.map((r) => r.recipientPk));
        setRows(built);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  async function remove(ev: Event) {
    if (!pubkey || !signer) return;
    if (
      !confirm(
        "Publish a retraction (kind:5) for this testimonial? Clients that honor NIP-09 will hide it on the recipient's profile. This action is irreversible.",
      )
    )
      return;
    setBusyId(ev.id);
    try {
      const template = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["e", ev.id],
          ["k", String(KIND_TESTIMONIAL)],
        ],
        content: "",
      };
      const signed = await signer.signEvent(template);
      await Promise.any(pool.publish(relays(), signed));
      setRows((prev) => prev.filter((r) => r.ev.id !== ev.id));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!pubkey) return null;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Sent</h1>
        <div className="muted small">
          {loading
            ? "Fetching from relays…"
            : rows.length === 0
              ? "Nothing published"
              : `${rows.length} accepted testimonial(s)`}
        </div>
      </div>

      <div className="muted small inbox-help">
        Testimonials you wrote that the recipient accepted — now public as{" "}
        <code>kind:63</code>. Deleting publishes a <code>kind:5</code>{" "}
        retraction (NIP-09) to relays; clients that honor the NIP hide the
        testimonial automatically. Pending ones don't show up here — the
        gift-wrap's ephemeral key is not recoverable.
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
            None of your testimonials have been accepted yet. When someone
            accepts one you sent, it will appear here.
          </p>
        </div>
      ) : (
        <ul className="inbox-list">
          {rows.map((r) => (
            <li key={r.ev.id} className="inbox-item">
              <div className="inbox-item-head">
                <AuthorLine pk={r.recipientPk} />
                <span className="badge">to</span>
              </div>
              <blockquote className="inbox-quote">
                <RichText text={r.ev.content} />
              </blockquote>
              <div className="inbox-actions">
                <time className="muted small">
                  {formatDate(r.ev.created_at)}
                </time>
                <button
                  className="link-btn danger"
                  disabled={busyId === r.ev.id}
                  onClick={() => remove(r.ev)}
                >
                  {busyId === r.ev.id ? "Publishing…" : "Delete (kind:5)"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
