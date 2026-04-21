import { useEffect } from "react";
import { useAuth } from "../state/auth";
import { useFollows } from "../state/follows";
import { profileName, useProfile } from "../state/profiles";
import { npub, shortNpub } from "../lib/keys";
import { RouterLink } from "../router";
import { Avatar } from "./Avatar";

type Props = {
  /** Exclude this pubkey (typically the profile currently being viewed). */
  excludePk?: string;
  /** How many to render. */
  limit?: number;
};

export default function FriendsStrip({ excludePk, limit = 12 }: Props) {
  const { pubkey } = useAuth();
  const followsStore = useFollows();

  useEffect(() => {
    if (pubkey) followsStore.fetch(pubkey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  if (!pubkey) return null;
  const pks = followsStore
    .get(pubkey)
    .filter((p) => p !== pubkey && p !== excludePk)
    .slice(0, limit);

  if (pks.length === 0) return null;

  return (
    <section className="friends-strip">
      <div className="section-head">
        <h2>Outros amigos</h2>
        <RouterLink route={{ view: "amigos" }} className="muted small">
          ver todos →
        </RouterLink>
      </div>
      <div className="friends-strip-scroll">
        {pks.map((pk) => (
          <StripItem key={pk} pk={pk} />
        ))}
      </div>
    </section>
  );
}

function StripItem({ pk }: { pk: string }) {
  const profile = useProfile(pk);
  const name = profileName(profile, shortNpub(pk));
  return (
    <RouterLink
      route={{ view: "profile", npub: npub(pk) }}
      className="strip-item"
      title={name}
    >
      <Avatar pk={pk} size={56} />
      <div className="strip-item-name">{name}</div>
    </RouterLink>
  );
}
