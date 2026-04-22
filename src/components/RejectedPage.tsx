import { useMemo } from "react";
import { useAuth } from "../state/auth";
import { useRejected, useRejectedBucket } from "../state/rejected";
import { AuthorLine } from "./Avatar";
import { RichText } from "../lib/richtext";

export default function RejectedPage() {
  const { pubkey } = useAuth();
  const { innerIds, innerEvents } = useRejectedBucket();
  const unrejectInner = useRejected((s) => s.unrejectInner);

  const ids = useMemo(() => Object.keys(innerIds), [innerIds]);

  if (!pubkey) return null;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Rejected</h1>
        <div className="muted small">{ids.length} on the local blacklist</div>
      </div>

      <div className="muted small inbox-help">
        NIP-A1 v2: rejection is a purely local action — nothing is published.
        This list lives in your browser only, so switching clients may
        re-surface already-rejected envelopes until their <code>expiration</code>{" "}
        fires. Restoring removes the id here; if the author resends the
        envelope, it will appear in the inbox again.
      </div>

      {ids.length === 0 ? (
        <div className="empty-state">
          <div className="empty-quote">“</div>
          <p>You haven't rejected any testimonials yet.</p>
        </div>
      ) : (
        <ul className="inbox-list">
          {ids.map((id) => {
            const ev = innerEvents[id];
            return (
              <li key={id} className="inbox-item">
                <div className="inbox-item-head">
                  {ev ? (
                    <AuthorLine pk={ev.pubkey} />
                  ) : (
                    <div className="muted small mono">
                      {id.slice(0, 16)}…{id.slice(-8)}
                    </div>
                  )}
                  <span className="badge">rejected</span>
                </div>
                {ev ? (
                  <blockquote className="inbox-quote">
                    <RichText text={ev.content} />
                  </blockquote>
                ) : (
                  <div className="muted small">
                    Content unavailable — this id was blacklisted before the
                    full event was cached locally.
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
                        unrejectInner(id);
                    }}
                  >
                    Restore
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
