import { useEffect, useState } from "react";
import type { Event } from "nostr-tools/pure";
import { useAuth } from "../state/auth";
import { pool, relays, useRelay } from "../state/relay";
import { openEnvelope, KIND_ENVELOPE } from "../nip-a1/envelope";
import { verifyTestimonialInEnvelope } from "../nip-a1/verify";
import { KIND_TESTIMONIAL } from "../nip-a1/testimonial";
import { addRef, buildListTemplate } from "../nip-a1/list";
import { useRejected } from "../state/rejected";
import { useTestimonialList } from "../state/testimonialList";
import { writeRelaysFor } from "../lib/nip65";
import { AuthorLine } from "./Avatar";
import { npub } from "../lib/keys";
import { navigate } from "../router";
import { RichText } from "../lib/richtext";

type Pending = {
  envelopeId: string;
  inner: Event;
  authorPk: string;
  content: string;
  createdAt: number;
  ok: boolean;
  reason?: string;
};

export default function InboxPage() {
  const { pubkey, signer } = useAuth();
  const urls = useRelay((s) => s.urls);
  const { reject: markRejected, isRejected, isInnerRejected } = useRejected();
  const fetchList = useTestimonialList((s) => s.fetch);
  const setListRefs = useTestimonialList((s) => s.setRefs);

  const [items, setItems] = useState<Pending[]>([]);
  const [status, setStatus] = useState<"loading" | "listening" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!pubkey || !signer) return;
    let cancelled = false;
    let sub: { close: () => void } | null = null;

    setItems([]);
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const refs = await fetchList(pubkey, true);
        if (cancelled) return;
        const acceptedIds = new Set(refs.map((r) => r.id));

        sub = pool.subscribeMany(
          relays(),
          { kinds: [KIND_ENVELOPE], "#p": [pubkey] },
          {
            onevent: async (envelope) => {
              if (cancelled) return;
              if (isRejected(envelope.id)) return;
              try {
                const inner = await openEnvelope(envelope, signer);
                if (inner.kind !== KIND_TESTIMONIAL) return;
                if (acceptedIds.has(inner.id)) return;
                if (isInnerRejected(inner.id)) return;
                const v = verifyTestimonialInEnvelope(
                  inner,
                  envelope.pubkey,
                  pubkey,
                );
                setItems((prev) => {
                  if (prev.some((p) => p.envelopeId === envelope.id)) return prev;
                  return [
                    ...prev,
                    {
                      envelopeId: envelope.id,
                      inner,
                      authorPk: inner.pubkey,
                      content: inner.content,
                      createdAt: inner.created_at,
                      ok: v.ok,
                      reason: v.ok ? undefined : v.reason,
                    },
                  ].sort((a, b) => b.createdAt - a.createdAt);
                });
              } catch {
                // undecryptable — not for us
              }
            },
            oneose: () => {
              if (!cancelled) setStatus("listening");
            },
          },
        );
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setError(e?.message ?? String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
      sub?.close();
    };
  }, [pubkey, signer, urls.join("|"), fetchList, isRejected, isInnerRejected]);

  async function accept(p: Pending) {
    if (!pubkey || !signer) return;
    setBusyId(p.envelopeId);
    try {
      const [myRelays, authorRelays] = await Promise.all([
        writeRelaysFor(pubkey),
        writeRelaysFor(p.authorPk),
      ]);
      const publishRelays = [
        ...new Set([...myRelays, ...authorRelays, ...relays()]),
      ];
      await Promise.any(pool.publish(publishRelays, p.inner));

      const refs = await fetchList(pubkey);
      const updated = addRef(refs, {
        id: p.inner.id,
        authorPk: p.authorPk,
        relayHint: myRelays[0] || urls[0],
      });
      const tmpl = buildListTemplate(updated);
      const signed = await signer.signEvent(tmpl);
      await Promise.any(pool.publish(relays(), signed));
      setListRefs(pubkey, updated);
      setItems((prev) => prev.filter((x) => x.envelopeId !== p.envelopeId));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  function reject(p: Pending) {
    markRejected(p.envelopeId, p.inner);
    setItems((prev) => prev.filter((x) => x.envelopeId !== p.envelopeId));
  }

  if (!pubkey) return null;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Inbox</h1>
        <div className="muted small">
          {status === "loading" && "Connecting to relays…"}
          {status === "listening" &&
            (items.length === 0
              ? "Listening · nothing new"
              : `Listening · ${items.length} pending`)}
          {status === "error" && "Error"}
        </div>
      </div>

      <div className="muted small inbox-help">
        Testimonials are end-to-end encrypted on send (NIP-A1 v2{" "}
        <code>kind:64</code> envelope). When you accept, the{" "}
        <code>kind:63</code> event signed by the author is published and added
        to your public list. When you reject, the envelope is discarded locally
        — nobody is notified.
      </div>

      {error && <div className="error-banner">{error}</div>}

      {items.length === 0 && status !== "loading" ? (
        <div className="empty-state">
          <div className="empty-quote">“</div>
          <p>No pending testimonials. Share your profile link:</p>
          <button
            className="ghost"
            onClick={() =>
              navigate({ view: "profile", npub: npub(pubkey) })
            }
          >
            Go to my profile →
          </button>
        </div>
      ) : (
        <ul className="inbox-list">
          {items.map((p) => (
            <li key={p.envelopeId} className="inbox-item">
              <div className="inbox-item-head">
                <AuthorLine pk={p.authorPk} />
                <span
                  className={
                    "badge " + (p.ok ? "badge-ok" : "badge-bad")
                  }
                >
                  {p.ok ? "valid signature" : `invalid: ${p.reason}`}
                </span>
              </div>
              <blockquote className="inbox-quote">
                <RichText text={p.content} />
              </blockquote>
              <div className="inbox-actions">
                <button
                  className="primary"
                  disabled={!p.ok || busyId === p.envelopeId}
                  onClick={() => accept(p)}
                >
                  {busyId === p.envelopeId ? "Publishing…" : "Accept and publish"}
                </button>
                <button
                  className="ghost"
                  disabled={busyId === p.envelopeId}
                  onClick={() => reject(p)}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
