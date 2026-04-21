import { useEffect, useState } from "react";
import type { Event } from "nostr-tools/pure";
import { useAuth } from "../state/auth";
import { pool, relays, useRelay } from "../state/relay";
import { unwrapSignedEvent, KIND_WRAP } from "../nip-a1/giftwrap";
import { verifyTestimonial } from "../nip-a1/verify";
import { KIND_TESTIMONIAL } from "../nip-a1/testimonial";
import {
  addRef,
  buildListTemplate,
  type TestimonialRef,
} from "../nip-a1/list";
import { useRejected } from "../state/rejected";
import { useTestimonialList } from "../state/testimonialList";
import { writeRelaysFor } from "../lib/nip65";
import { Avatar, AuthorLine } from "./Avatar";
import { npub } from "../lib/keys";
import { navigate } from "../router";
import { RichText } from "../lib/richtext";

type Pending = {
  wrapId: string;
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
          { kinds: [KIND_WRAP], "#p": [pubkey] },
          {
            onevent: async (wrap) => {
              if (cancelled) return;
              if (isRejected(wrap.id)) return;
              try {
                const inner = await unwrapSignedEvent(wrap, signer);
                // Skip anything that isn't a testimonial — gift wraps also
                // carry NIP-17 DMs (inner kind:13 seals) and other payloads.
                if (inner.kind !== KIND_TESTIMONIAL) return;
                if (acceptedIds.has(inner.id)) return;
                if (isInnerRejected(inner.id)) return;
                const v = verifyTestimonial(inner, pubkey);
                setItems((prev) => {
                  if (prev.some((p) => p.wrapId === wrap.id)) return prev;
                  return [
                    ...prev,
                    {
                      wrapId: wrap.id,
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
                // Not a testimonial, or undecryptable. Silently skip — gift wraps
                // are also used for NIP-17 DMs etc.
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
    setBusyId(p.wrapId);
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
      setItems((prev) => prev.filter((x) => x.wrapId !== p.wrapId));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  function reject(p: Pending) {
    markRejected(p.wrapId, p.inner.id);
    setItems((prev) => prev.filter((x) => x.wrapId !== p.wrapId));
  }

  if (!pubkey) return null;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Inbox</h1>
        <div className="muted small">
          {status === "loading" && "Conectando aos relays…"}
          {status === "listening" &&
            (items.length === 0
              ? "Escutando · nada novo"
              : `Escutando · ${items.length} pendente(s)`)}
          {status === "error" && "Erro"}
        </div>
      </div>

      <div className="muted small inbox-help">
        Testemunhos são encriptados ponta-a-ponta no envio. Ao aceitar, o
        evento <code>kind:63</code> assinado pelo autor é publicado e adicionado
        à sua lista pública. Ao recusar, o gift-wrap é descartado localmente —
        ninguém será notificado.
      </div>

      {error && <div className="error-banner">{error}</div>}

      {items.length === 0 && status !== "loading" ? (
        <div className="empty-state">
          <div className="empty-quote">“</div>
          <p>Nenhum testemunho pendente. Compartilhe o link do seu perfil:</p>
          <button
            className="ghost"
            onClick={() =>
              navigate({ view: "profile", npub: npub(pubkey) })
            }
          >
            Ir para meu perfil →
          </button>
        </div>
      ) : (
        <ul className="inbox-list">
          {items.map((p) => (
            <li key={p.wrapId} className="inbox-item">
              <div className="inbox-item-head">
                <AuthorLine pk={p.authorPk} />
                <span
                  className={
                    "badge " + (p.ok ? "badge-ok" : "badge-bad")
                  }
                >
                  {p.ok ? "assinatura válida" : `inválido: ${p.reason}`}
                </span>
              </div>
              <blockquote className="inbox-quote">
                <RichText text={p.content} />
              </blockquote>
              <div className="inbox-actions">
                <button
                  className="primary"
                  disabled={!p.ok || busyId === p.wrapId}
                  onClick={() => accept(p)}
                >
                  {busyId === p.wrapId ? "Publicando…" : "Aceitar e publicar"}
                </button>
                <button
                  className="ghost"
                  disabled={busyId === p.wrapId}
                  onClick={() => reject(p)}
                >
                  Recusar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
