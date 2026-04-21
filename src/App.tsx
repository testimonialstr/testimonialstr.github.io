import { useEffect, type ReactNode } from "react";
import Header from "./components/Header";
import ProfilePage from "./components/ProfilePage";
import InboxPage from "./components/InboxPage";
import FriendsPage from "./components/FriendsPage";
import RejectedPage from "./components/RejectedPage";
import SentPage from "./components/SentPage";
import OnboardingPage from "./components/OnboardingPage";
import { useAuth, wasLoggedIn } from "./state/auth";
import { useRejected } from "./state/rejected";
import { npub } from "./lib/keys";
import { navigate, useRoute } from "./router";

export default function App() {
  const { pubkey, loading, restore } = useAuth();
  const syncRejected = useRejected((s) => s.sync);
  const syncedFor = useRejected((s) => s.syncedFor);
  const route = useRoute();

  useEffect(() => {
    restore();
  }, [restore]);

  useEffect(() => {
    if (pubkey && syncedFor !== pubkey) {
      syncRejected().catch(() => {});
    }
  }, [pubkey, syncedFor, syncRejected]);

  const gated =
    route.view === "inbox" ||
    route.view === "amigos" ||
    route.view === "recusados" ||
    route.view === "enviados";

  useEffect(() => {
    if (route.view === "home" && pubkey) {
      navigate(
        { view: "profile", npub: npub(pubkey) },
        { replace: true },
      );
    } else if (!pubkey && gated) {
      navigate({ view: "home" }, { replace: true });
    }
  }, [route.view, pubkey, gated]);

  const restoring = loading && !pubkey && wasLoggedIn();

  let body: ReactNode;
  switch (route.view) {
    case "home":
      body = pubkey ? null : restoring ? (
        <div className="page" style={{ textAlign: "center", padding: 64 }}>
          <div className="muted">Reconectando à sua extensão…</div>
        </div>
      ) : (
        <OnboardingPage />
      );
      break;
    case "profile":
      body = <ProfilePage npubParam={route.npub} write={!!route.write} />;
      break;
    case "inbox":
      body = pubkey ? <InboxPage /> : null;
      break;
    case "amigos":
      body = pubkey ? <FriendsPage /> : null;
      break;
    case "recusados":
      body = pubkey ? <RejectedPage /> : null;
      break;
    case "enviados":
      body = pubkey ? <SentPage /> : null;
      break;
  }

  return (
    <div className="app">
      <Header />
      <main className="main">{body}</main>
      <footer className="footer">
        <span>
          Testimonialstr · NIP-A1 · built with{" "}
          <a
            href="https://github.com/nbd-wtf/nostr-tools"
            target="_blank"
            rel="noreferrer"
          >
            nostr-tools
          </a>
        </span>
      </footer>
    </div>
  );
}
