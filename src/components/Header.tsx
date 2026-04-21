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
              Meu perfil
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
              route={{ view: "amigos" }}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              Amigos
            </NavRouterLink>
            <NavRouterLink
              route={{ view: "recusados" }}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              Recusados
            </NavRouterLink>
            <NavRouterLink
              route={{ view: "enviados" }}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " active" : "")
              }
            >
              Enviados
            </NavRouterLink>
            <button
              className="nav-link nav-link-cta"
              onClick={() => {
                setPickerMode("jump");
                setPickerOpen(true);
              }}
              title="Cmd/Ctrl + K"
            >
              Procurar amigo
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
                  if (confirm("Sair? Você precisará reconectar a extensão.")) {
                    logout();
                    navigate({ view: "home" });
                  }
                }}
              >
                sair
              </button>
            </div>
          </div>
        ) : (
          <button className="primary" onClick={login} disabled={loading}>
            {loading ? "Conectando…" : "Login com NIP-07"}
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
