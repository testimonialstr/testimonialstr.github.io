import { useState } from "react";
import { useAuth } from "../state/auth";
import { pool, relays } from "../state/relay";
import {
  buildTestimonial,
  MAX_TESTIMONIAL_CHARS,
} from "../nip-a1/testimonial";
import { buildEnvelope } from "../nip-a1/envelope";
import { wrapDeliveryRelaysFor } from "../lib/nip65";
import { useProfile, profileName } from "../state/profiles";
import { shortNpub } from "../lib/keys";
import { Avatar } from "./Avatar";
import Modal from "./Modal";

type Props = {
  recipientPk: string;
  onClose: () => void;
  onSent?: () => void;
};

export default function ComposeModal({ recipientPk, onClose, onSent }: Props) {
  const { signer, pubkey } = useAuth();
  const profile = useProfile(recipientPk);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const isSelf = !!pubkey && pubkey === recipientPk;

  async function send() {
    if (!signer || !pubkey) return;
    if (isSelf) {
      setError("You can't write a testimonial to yourself.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const template = buildTestimonial(recipientPk, text.trim());
      const inner = await signer.signEvent(template);
      const envelope = await buildEnvelope(inner, recipientPk, signer);
      const targetRelays = await wrapDeliveryRelaysFor(recipientPk);
      const allRelays = [...new Set([...targetRelays, ...relays()])];
      await Promise.any(pool.publish(allRelays, envelope));
      setSent(true);
      onSent?.();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const overLimit = text.length > MAX_TESTIMONIAL_CHARS;
  const name = profileName(profile, shortNpub(recipientPk));

  return (
    <Modal onClose={onClose} disableBackdropClose={busy}>
      <>
        <button className="modal-close" onClick={onClose} disabled={busy}>
          ×
        </button>
        <div className="modal-head">
          <Avatar pk={recipientPk} size={48} />
          <div>
            <div className="modal-title">Write to {name}</div>
            <div className="muted small mono">{shortNpub(recipientPk)}</div>
          </div>
        </div>

        {isSelf ? (
          <div className="sent-state">
            <p>You can't write a testimonial to yourself.</p>
            <button className="primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : sent ? (
          <div className="sent-state">
            <div className="big-check">✓</div>
            <h3>Sent</h3>
            <p>
              {name} needs to open their inbox and approve it for the
              testimonial to show up on their profile. The envelope is
              encrypted, so nobody can see the content until then.
            </p>
            <button className="primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              value={text}
              placeholder="Write something true and specific…"
              onChange={(e) => setText(e.target.value)}
              rows={6}
            />
            <div className="compose-meta">
              <span className={overLimit ? "warn" : "muted"}>
                {text.length} / {MAX_TESTIMONIAL_CHARS}
              </span>
              <span className="muted small">
                Encrypted in transit · expires in 30 days if not approved
              </span>
            </div>
            {error && <div className="error-banner">{error}</div>}
            <div className="modal-actions">
              <button className="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={busy || !text.trim() || overLimit}
                onClick={send}
              >
                {busy ? "Sending…" : "Sign and send"}
              </button>
            </div>
          </>
        )}
      </>
    </Modal>
  );
}
