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
        <h1>Recusados</h1>
        <div className="muted small">
          {syncedFor === pubkey
            ? `${ids.length} na lista kind:10065`
            : "Sincronizando com relays…"}
        </div>
      </div>

      <div className="muted small inbox-help">
        Esta é a sua lista privada <code>kind:10065</code> — cifrada com NIP-44
        para você mesmo. Testemunhos aqui não aparecem no inbox. Restaurar
        remove o id da lista; se o autor reenviar o gift-wrap, aparecerá no
        inbox de novo.
      </div>

      {ids.length === 0 ? (
        <div className="empty-state">
          <div className="empty-quote">“</div>
          <p>Você ainda não recusou nenhum testemunho.</p>
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
                <span className="badge">recusado</span>
              </div>
              {r.ev ? (
                <blockquote className="inbox-quote">
                  <RichText text={r.ev.content} />
                </blockquote>
              ) : (
                <div className="muted small">
                  {loading
                    ? "Buscando conteúdo nos relays…"
                    : "Conteúdo indisponível (o evento nunca foi publicado ou expirou nos relays)."}
                </div>
              )}
              <div className="inbox-actions">
                <button
                  className="ghost"
                  onClick={() => {
                    if (
                      confirm(
                        "Restaurar este id? Se o autor reenviar, voltará ao inbox.",
                      )
                    )
                      unrejectInner(r.id);
                  }}
                >
                  Restaurar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
