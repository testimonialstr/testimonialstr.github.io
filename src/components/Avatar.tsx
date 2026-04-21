import { useProfile, profileName } from "../state/profiles";
import { npub, shortNpub } from "../lib/keys";
import { RouterLink } from "../router";

export function Avatar({
  pk,
  size = 40,
}: {
  pk: string;
  size?: number;
}) {
  const profile = useProfile(pk);
  const name = profileName(profile, shortNpub(pk));
  if (profile.picture) {
    return (
      <img
        src={profile.picture}
        alt={name}
        className="avatar"
        style={{ width: size, height: size }}
        onError={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          el.style.display = "none";
          el.parentElement?.classList.add("avatar-failed");
        }}
      />
    );
  }
  return (
    <div
      className="avatar avatar-fallback"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name[0] || "?").toUpperCase()}
    </div>
  );
}

export function AuthorLine({ pk, linked = true }: { pk: string; linked?: boolean }) {
  const profile = useProfile(pk);
  const name = profileName(profile, shortNpub(pk));
  const body = (
    <>
      <Avatar pk={pk} size={32} />
      <div className="author-text">
        <div className="author-name">{name}</div>
        <div className="author-handle mono">{shortNpub(pk)}</div>
      </div>
    </>
  );
  if (!linked) return <div className="author-line">{body}</div>;
  return (
    <RouterLink
      route={{ view: "profile", npub: npub(pk) }}
      className="author-line author-line-link"
    >
      {body}
    </RouterLink>
  );
}
