import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../state/auth";
import { useFollows } from "../state/follows";
import { profileName, useProfile } from "../state/profiles";
import { npub, shortNpub } from "../lib/keys";
import { RouterLink } from "../router";
import { Avatar } from "./Avatar";

export default function FriendsPage() {
  const { pubkey } = useAuth();
  const followsStore = useFollows();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (pubkey) followsStore.fetch(pubkey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  const follows = pubkey ? followsStore.get(pubkey) : [];
  const loading = pubkey ? !!followsStore.loading[pubkey] : false;

  const visible = useMemo(
    () => (pubkey ? follows.filter((p) => p !== pubkey) : []),
    [follows, pubkey],
  );

  if (!pubkey) return null;

  return (
    <div className="page friends-page">
      <div className="page-head">
        <h1>Friends</h1>
        <div className="muted small">
          {loading && visible.length === 0
            ? "Loading kind:3…"
            : `${visible.length} profile(s) you follow`}
        </div>
      </div>

      <input
        className="friends-search"
        placeholder="Search by name, handle or nip05…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {visible.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-quote">“</div>
          <p>
            You don't follow anyone yet (kind:3). When you follow people in
            any Nostr client, they will appear here.
          </p>
        </div>
      ) : (
        <div className="friends-grid">
          {visible.map((pk) => (
            <FriendCard key={pk} pk={pk} query={query.trim().toLowerCase()} />
          ))}
        </div>
      )}
    </div>
  );
}

function FriendCard({ pk, query }: { pk: string; query: string }) {
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
  if (query && !haystack.includes(query.replace(/^@/, ""))) return null;

  return (
    <RouterLink
      route={{ view: "profile", npub: npub(pk) }}
      className="friend-card"
    >
      <Avatar pk={pk} size={56} />
      <div className="friend-name">{name || shortNpub(pk)}</div>
      {profile.nip05 ? (
        <div className="friend-nip05">{profile.nip05}</div>
      ) : (
        <div className="friend-handle mono">{shortNpub(pk)}</div>
      )}
    </RouterLink>
  );
}
