import { useEffect, useState } from "react";
import { useAuth } from "../state/auth";
import { useProfile, profileName } from "../state/profiles";
import { npub, shortNpub } from "../lib/keys";
import { NavRouterLink, RouterLink, navigate } from "../router";
import RelayIndicator from "./RelayIndicator";
import RecipientPicker from "./RecipientPicker";

export default function Header() {
  const { pubkey, login, logout, loading } = useAuth();
  const profile = useProfile(pubkey ?? undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"write" | "jump">("write");

  useEffect(() => {
    if (!pubkey) return;
    function onKey(e: KeyboardEvent) {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPickerMode("jump");
        setPickerOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pubkey]);

  return (
    <header className="header">
      <RouterLink route={{ view: "home" }} className="brand">
        <span className="brand-mark">“</span>
        <span className="brand-name">Testimonialstr</span>
      </RouterLink>

      <nav className="nav">
        {pubkey && (
          <>
            <NavRouterLink
              route={{ view: "profile", npub: npub(pubkey) }}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              My profile
            </NavRouterLink>
            <NavRouterLink
              route={{ view: "inbox" }}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              Inbox
            </NavRouterLink>
            <NavRouterLink
              route={{ view: "friends" }}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              Friends
            </NavRouterLink>
            <NavRouterLink
              route={{ view: "rejected" }}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              Rejected
            </NavRouterLink>
            <NavRouterLink
              route={{ view: "sent" }}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              Sent
            </NavRouterLink>
            <button
              className="nav-link nav-link-cta"
              onClick={() => {
                setPickerMode("jump");
                setPickerOpen(true);
              }}
              title="Cmd/Ctrl + K"
            >
              Find profile
            </button>
          </>
        )}
      </nav>

      <div className="header-right">
        <RelayIndicator />
        {pubkey ? (
          <div className="me">
            {profile.picture ? (
              <img
                src={profile.picture}
                alt=""
                className="me-avatar"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="me-avatar avatar-fallback">
                {(profileName(profile, "?")[0] || "?").toUpperCase()}
              </div>
            )}
            <div className="me-text">
              <div className="me-name">
                {profileName(profile, shortNpub(pubkey))}
              </div>
              <button
                className="link-btn"
                onClick={() => {
                  if (
                    confirm(
                      "Log out? You'll need to reconnect the extension.",
                    )
                  ) {
                    logout();
                    navigate({ view: "home" });
                  }
                }}
              >
                log out
              </button>
            </div>
          </div>
        ) : (
          <button className="primary" onClick={login} disabled={loading}>
            {loading ? "Connecting…" : "Sign in with NIP-07"}
          </button>
        )}
      </div>
      {pickerOpen && (
        <RecipientPicker
          mode={pickerMode}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </header>
  );
}
