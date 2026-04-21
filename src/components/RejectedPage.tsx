import { useEffect, useMemo, useState } from "react";
import type { Event } from "nostr-tools/pure";
import { useAuth } from "../state/auth";
import { pool, relays } from "../state/relay";
import { useRejected } from "../state/rejected";
import { KIND_TESTIMONIAL } from "../nip-a1/testimonial";
import { AuthorLine } from "./Avatar";
import { RichText } from "../lib/richtext";

type Row = {
  id: string;
  ev: Event | null;
};

export default function RejectedPage() {
  const { pubkey } = useAuth();
  const innerIds = useRejected((s) => s.innerIds);
  const unrejectInner = useRejected((s) => s.unrejectInner);
  const syncedFor = useRejected((s) => s.syncedFor);

  const ids = useMemo(() => Object.keys(innerIds), [innerIds]);
  const [events, setEvents] = useState<Record<string, Event>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pubkey || ids.length === 0) return;
    let cancelled = false;
    const missing = ids.filter((id) => !events[id]);
    if (missing.length === 0) return;
    setLoading(true);

    const sub = pool.subscribeMany(
      relays(),
      { kinds: [KIND_TESTIMONIAL], ids: missing },
      {
        onevent: (ev: Event) => {
          if (cancelled) return;
          setEvents((prev) => ({ ...prev, [ev.id]: ev }));
        },
        oneose: () => {
          if (!cancelled) {
            sub.close();
            setLoading(false);
          }
        },
      },
    );
    const timer = setTimeout(() => {
      if (!cancelled) {
        sub.close();
        setLoading(false);
      }
    }, 6000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey, ids.join("|")]);

  const rows: Row[] = ids.map((id) => ({ id, ev: events[id] ?? null }));

  if (!pubkey) return null;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Rejected</h1>
        <div className="muted small">
          {syncedFor === pubkey
            ? `${ids.length} on the kind:10065 list`
            : "Syncing with relays…"}
        </div>
      </div>

      <div className="muted small inbox-help">
        This is your private <code>kind:10065</code> list — encrypted with
        NIP-44 to yourself. Testimonials here don't show up in the inbox.
        Restoring removes the id from the list; if the author resends the
        gift-wrap, it will appear in the inbox again.
      </div>

      {ids.length === 0 ? (
        <div className="empty-state">
          <div className="empty-quote">“</div>
          <p>You haven't rejected any testimonials yet.</p>
        </div>
      ) : (
        <ul className="inbox-list">
          {rows.map((r) => (
            <li key={r.id} className="inbox-item">
              <div className="inbox-item-head">
                {r.ev ? (
                  <AuthorLine pk={r.ev.pubkey} />
                ) : (
                  <div className="muted small mono">
                    {r.id.slice(0, 16)}…{r.id.slice(-8)}
                  </div>
                )}
                <span className="badge">rejected</span>
              </div>
              {r.ev ? (
                <blockquote className="inbox-quote">
                  <RichText text={r.ev.content} />
                </blockquote>
              ) : (
                <div className="muted small">
                  {loading
                    ? "Fetching content from relays…"
                    : "Content unavailable (the event was never published or has expired on relays)."}
                </div>
              )}
              <div className="inbox-actions">
                <button
                  className="ghost"
                  onClick={() => {
                    if (
                      confirm(
                        "Restore this id? If the author resends, it will come back to the inbox.",
                      )
                    )
                      unrejectInner(r.id);
                  }}
                >
                  Restore
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
