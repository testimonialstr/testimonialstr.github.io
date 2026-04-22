import { useAuth } from "../state/auth";

export default function OnboardingPage() {
  const { login, loading, error } = useAuth();
  const hasNip07 = typeof window !== "undefined" && !!window.nostr;

  return (
    <div className="onboarding">
      <div className="onboarding-hero">
        <div className="quote-mark">“</div>
        <h1>
          Collect <em>testimonials</em> worth displaying.
        </h1>
        <p className="lede">
          Testimonialstr is a Nostr client focused on public endorsements
          — no timeline, no noise. You decide what appears on your profile,
          and every testimonial carries a cryptographic signature from whoever
          wrote it.
        </p>

        <div className="onboarding-actions">
          {hasNip07 ? (
            <button className="primary big" onClick={login} disabled={loading}>
              {loading ? "Connecting…" : "Sign in with NIP-07 extension"}
            </button>
          ) : (
            <div className="nip07-missing">
              <strong>No NIP-07 extension detected.</strong>
              <p>
                To use Testimonialstr you need a Nostr signing extension
                installed in your browser:
              </p>
              <ul className="ext-list">
                <li>
                  <a
                    href="https://github.com/fiatjaf/nos2x"
                    target="_blank"
                    rel="noreferrer"
                  >
                    nos2x
                  </a>{" "}
                  — minimalist, open-source
                </li>
                <li>
                  <a
                    href="https://getalby.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Alby
                  </a>{" "}
                  — Nostr + Lightning
                </li>
                <li>
                  <a
                    href="https://github.com/susumuota/nostr-keyx"
                    target="_blank"
                    rel="noreferrer"
                  >
                    nostr-keyx
                  </a>{" "}
                  — uses the macOS keychain
                </li>
              </ul>
              <p className="muted small">
                After installing, reload this page.
              </p>
            </div>
          )}
          {error && <div className="error-banner">{error}</div>}
        </div>
      </div>

      <div className="onboarding-cards">
        <div className="info-card">
          <div className="info-num">1</div>
          <h3>Receive</h3>
          <p>
            People write encrypted testimonials delivered via a signed{" "}
            <code>kind:64</code> envelope (NIP-A1 v2). They only go public if
            you approve them.
          </p>
        </div>
        <div className="info-card">
          <div className="info-num">2</div>
          <h3>Approve</h3>
          <p>
            Every testimonial carries the author's signature. You verify and
            decide what goes on your public list (kind:10064).
          </p>
        </div>
        <div className="info-card">
          <div className="info-num">3</div>
          <h3>Share</h3>
          <p>
            Your profile has a public URL.{" "}
            <code>?p=npub1…</code> — anyone can see the verified testimonials
            in any compatible client.
          </p>
        </div>
      </div>
    </div>
  );
}
