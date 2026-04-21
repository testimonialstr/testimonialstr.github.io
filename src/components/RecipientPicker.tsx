import { useEffect, useMemo, useState } from "react";
import { decodeNpub, npub, shortNpub } from "../lib/keys";
import { useAuth } from "../state/auth";
import { useFollows } from "../state/follows";
import { profileName, useProfile } from "../state/profiles";
import { navigate } from "../router";
import { Avatar } from "./Avatar";
import Modal from "./Modal";

type Props = {
  onClose: () => void;
  /** "write" (default) takes you to the profile with compose open; "jump" just navigates. */
  mode?: "write" | "jump";
};

const LOOKS_LIKE_KEY = /^(npub1|nprofile1|[0-9a-f]{64})/i;

export default function RecipientPicker({ onClose, mode = "write" }: Props) {
  const { pubkey } = useAuth();
  const followsStore = useFollows();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (pubkey) followsStore.fetch(pubkey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  const follows = pubkey ? followsStore.get(pubkey) : [];
  const loadingFollows = pubkey ? !!followsStore.loading[pubkey] : false;

  const query = value.trim().replace(/^@/, "").toLowerCase();
  const looksLikeKey = LOOKS_LIKE_KEY.test(value.trim());

  const suggestions = useMemo(() => {
    if (looksLikeKey) return [];
    if (!pubkey) return [];
    return follows.filter((pk) => pk !== pubkey).slice(0, 500);
    // filtering happens in the render using useProfile (hooks) — see list render below
  }, [follows, pubkey, looksLikeKey]);

  function goByKey() {
    setError(null);
    try {
      const pk = decodeNpub(value.trim());
      if (mode === "write" && pubkey && pk === pubkey) {
        setError("Você não pode escrever um depoimento para si mesmo.");
        return;
      }
      onClose();
      navigate({
        view: "profile",
        npub: npub(pk),
        write: mode === "write",
      });
    } catch {
      setError("npub inválida — cole uma npub1… ou hex de 64 chars");
    }
  }

  function goToPk(pk: string) {
    if (mode === "write" && pubkey && pk === pubkey) {
      setError("Você não pode escrever um depoimento para si mesmo.");
      return;
    }
    onClose();
    navigate({
      view: "profile",
      npub: npub(pk),
      write: mode === "write",
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="recipient-picker-body">
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="modal-head">
          <div>
            <div className="modal-title">
              {mode === "write" ? "Escrever depoimento" : "Ir para um perfil"}
            </div>
            <div className="muted small">
              Comece a digitar um nome para buscar entre quem você segue, ou
              cole uma npub.
            </div>
          </div>
        </div>
        <input
          autoFocus
          placeholder="@nome ou npub1…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setActiveIdx(0);
          }}
          onKeyDown={(e) => {
            if (looksLikeKey && e.key === "Enter") {
              e.preventDefault();
              goByKey();
            }
          }}
        />
        {error && (
          <div className="error-banner" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}

        {!looksLikeKey && (
          <FollowSuggestions
            pks={suggestions}
            query={query}
            activeIdx={activeIdx}
            setActiveIdx={setActiveIdx}
            onPick={goToPk}
            loading={loadingFollows}
            hasFollows={follows.length > 0}
          />
        )}

        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Cancelar
          </button>
          {looksLikeKey && (
            <button
              className="primary"
              disabled={!value.trim()}
              onClick={goByKey}
            >
              Ir para o perfil
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

type SuggProps = {
  pks: string[];
  query: string;
  activeIdx: number;
  setActiveIdx: (n: number) => void;
  onPick: (pk: string) => void;
  loading: boolean;
  hasFollows: boolean;
};

function FollowSuggestions({
  pks,
  query,
  onPick,
  loading,
  hasFollows,
}: SuggProps) {
  if (loading && !hasFollows) {
    return (
      <div className="picker-list-empty">Carregando quem você segue…</div>
    );
  }
  if (pks.length === 0) {
    return (
      <div className="picker-list-empty">
        Você ainda não segue ninguém (kind:3). Cole uma npub para continuar.
      </div>
    );
  }
  return (
    <ul className="picker-list">
      {pks.map((pk) => (
        <FollowRow key={pk} pk={pk} query={query} onPick={onPick} />
      ))}
    </ul>
  );
}

function FollowRow({
  pk,
  query,
  onPick,
}: {
  pk: string;
  query: string;
  onPick: (pk: string) => void;
}) {
  const profile = useProfile(pk);
  const name = profileName(profile, "");
  const haystack = [
    name,
    profile.name ?? "",
    profile.display_name ?? "",
    profile.nip05 ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (query && !haystack.includes(query)) return null;

  return (
    <li>
      <button
        className="picker-row"
        type="button"
        onClick={() => onPick(pk)}
      >
        <Avatar pk={pk} size={36} />
        <div className="picker-row-text">
          <div className="picker-row-name">
            {name || shortNpub(pk)}
          </div>
          <div className="picker-row-meta mono">
            {profile.nip05 ? (
              <span className="picker-nip05">{profile.nip05}</span>
            ) : (
              shortNpub(pk)
            )}
          </div>
        </div>
      </button>
    </li>
  );
}
