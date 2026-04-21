import { useEffect, useMemo, useState } from "react";
import type { Event } from "nostr-tools/pure";
import { decodeNpub, npub, shortNpub } from "../lib/keys";
import { useAuth } from "../state/auth";
import { prefetchProfiles, profileName, useProfile } from "../state/profiles";
import { useFollows } from "../state/follows";
import { useRejected } from "../state/rejected";
import { useTestimonialList } from "../state/testimonialList";
import { pool, relays } from "../state/relay";
import { writeRelaysFor } from "../lib/nip65";
import { KIND_TESTIMONIAL } from "../nip-a1/testimonial";
import { verifyTestimonial } from "../nip-a1/verify";
import {
  buildListTemplate,
  removeRef,
  type TestimonialRef,
} from "../nip-a1/list";
import { Avatar } from "./Avatar";
import TestimonialCard from "./TestimonialCard";
import { CardSkeleton } from "./Skeleton";
import ComposeModal from "./ComposeModal";
import FriendsStrip from "./FriendsStrip";
import { RichText } from "../lib/richtext";
import { navigate } from "../router";

type Row = {
  ev: Event;
  authorPk: string;
  content: string;
  createdAt: number;
  ok: boolean;
  reason?: string;
  deleted: boolean;
};

async function collect(
  filter: any,
  opts: { timeoutMs?: number; expectIds?: string[] } = {},
): Promise<Event[]> {
  const { timeoutMs = 2500, expectIds } = opts;
  const expectedSet = expectIds ? new Set(expectIds) : null;
  const expectedTotal = expectIds ? expectIds.length : 0;
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
        if (expectedSet && !expectedSet.has(ev.id)) return;
        acc.push(ev);
        if (expectedTotal && acc.length >= expectedTotal) finish();
      },
      oneose: finish,
    });
    setTimeout(finish, timeoutMs);
  });
}

function FollowButton({ targetPk }: { targetPk: string }) {
  const { pubkey } = useAuth();
  const followsStore = useFollows();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pubkey) followsStore.fetch(pubkey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  if (!pubkey) return null;
  const following = followsStore.isFollowing(pubkey, targetPk);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (following) await followsStore.unfollow(targetPk);
      else await followsStore.follow(targetPk);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className={following ? "ghost following" : "ghost"}
        onClick={toggle}
        disabled={busy}
        title={following ? "Deixar de seguir" : "Seguir esta pessoa"}
      >
        {busy ? "…" : following ? "Seguindo" : "Seguir"}
      </button>
      {error && <div className="error-banner">{error}</div>}
    </>
  );
}

type Props = { npubParam: string; write: boolean };

export default function ProfilePage({ npubParam, write }: Props) {
  const { pubkey: meNpub, signer } = useAuth();

  const targetPk = useMemo(() => {
    if (!npubParam) return null;
    try {
      return decodeNpub(npubParam);
    } catch {
      return null;
    }
  }, [npubParam]);

  const profile = useProfile(targetPk ?? undefined);
  const fetchList = useTestimonialList((s) => s.fetch);
  const setListRefs = useTestimonialList((s) => s.setRefs);
  const getRefs = useTestimonialList((s) => s.getRefs);
  const rejectInner = useRejected((s) => s.rejectInner);
  const isOwner = !!meNpub && meNpub === targetPk;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (write && meNpub && targetPk && targetPk !== meNpub) {
      setComposeOpen(true);
      navigate(
        { view: "profile", npub: npubParam },
        { replace: true },
      );
    }
  }, [write, meNpub, targetPk, npubParam]);

  useEffect(() => {
    if (!targetPk) {
      setError("npub inválida");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    setRows([]);

    prefetchProfiles([targetPk]);

    (async () => {
      try {
        const refs = await fetchList(targetPk, true);
        if (cancelled) return;
        if (refs.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }
        const ids = refs.map((r) => r.id);
        const authorPks = Array.from(
          new Set(refs.map((r) => r.authorPk).filter(Boolean)),
        );
        if (authorPks.length > 0) prefetchProfiles(authorPks);
        const [events, deletions] = await Promise.all([
          collect(
            { kinds: [KIND_TESTIMONIAL], ids },
            { expectIds: ids },
          ),
          collect({ kinds: [5], "#e": ids }),
        ]);
        if (cancelled) return;

        const eventById = new Map(events.map((e) => [e.id, e]));
        const deletedIds = new Set<string>();
        for (const d of deletions) {
          for (const t of d.tags) {
            if (
              t[0] === "e" &&
              ids.includes(t[1]) &&
              eventById.get(t[1])?.pubkey === d.pubkey
            ) {
              deletedIds.add(t[1]);
            }
          }
        }

        const built: Row[] = events
          .map((ev) => {
            const v = verifyTestimonial(ev, targetPk);
            return {
              ev,
              authorPk: ev.pubkey,
              content: ev.content,
              createdAt: ev.created_at,
              ok: v.ok,
              reason: v.ok ? undefined : v.reason,
              deleted: deletedIds.has(ev.id),
            } as Row;
          })
          .filter((r) => r.ok && !r.deleted)
          .sort((a, b) => b.createdAt - a.createdAt);

        setRows(built);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetPk, fetchList]);

  async function removeOne(eventId: string) {
    if (!isOwner || !signer || !targetPk) return;
    const refs = getRefs(targetPk);
    const updated = removeRef(refs, eventId);
    const tmpl = buildListTemplate(updated);
    const signed = await signer.signEvent(tmpl);
    await Promise.any(pool.publish(relays(), signed));
    setListRefs(targetPk, updated);
    rejectInner(eventId);
    setRows((prev) => prev.filter((r) => r.ev.id !== eventId));
  }

  if (!targetPk) {
    return (
      <div className="page">
        <div className="error-banner">npub inválida na URL</div>
        <button
          className="ghost"
          onClick={() => navigate({ view: "home" })}
        >
          Voltar
        </button>
      </div>
    );
  }

  const name = profileName(profile, shortNpub(targetPk));
  const handleNpub = npub(targetPk);

  return (
    <div className="page profile-page">
      <section className="profile-hero">
        <Avatar pk={targetPk} size={96} />
        <div className="profile-id">
          <h1>{name}</h1>
          {profile.nip05 && (
            <div className="profile-nip05">{profile.nip05}</div>
          )}
          <div className="profile-npub mono" title={handleNpub}>
            {shortNpub(targetPk)}
          </div>
          {profile.about && (
            <p className="profile-about">
              <RichText text={profile.about} />
            </p>
          )}
        </div>
        <div className="profile-actions">
          {meNpub && !isOwner && (
            <>
              <button
                className="primary"
                onClick={() => setComposeOpen(true)}
              >
                Escrever testemunho
              </button>
              <FollowButton targetPk={targetPk} />
            </>
          )}
          <button
            className="ghost"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
            title="Copiar URL deste perfil"
          >
            Copiar link
          </button>
        </div>
      </section>

      <section className="testimonials-section">
        <div className="section-head">
          <h2>Testemunhos</h2>
          {!loading && rows.length > 0 && (
            <span className="muted">{rows.length} verificado(s)</span>
          )}
        </div>

        {loading ? (
          <div className="testimonial-grid">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <div className="error-banner">{error}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-quote">“</div>
            <p>
              {isOwner
                ? "Você ainda não tem testemunhos publicados. Compartilhe o link do seu perfil — quando alguém escrever, aparecerá no Inbox para você aprovar."
                : `${name} ainda não tem testemunhos publicados.`}
            </p>
            {meNpub && !isOwner && (
              <button
                className="primary"
                onClick={() => setComposeOpen(true)}
              >
                Seja a primeira pessoa
              </button>
            )}
          </div>
        ) : (
          <div className="testimonial-grid">
            {rows.map((r) => (
              <TestimonialCard
                key={r.ev.id}
                content={r.content}
                authorPk={r.authorPk}
                createdAt={r.createdAt}
                onRemove={isOwner ? () => removeOne(r.ev.id) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {meNpub && <FriendsStrip excludePk={targetPk} />}

      {composeOpen && (
        <ComposeModal
          recipientPk={targetPk}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  );
}
