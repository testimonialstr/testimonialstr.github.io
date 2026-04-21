import { useAuth } from "../state/auth";

export default function OnboardingPage() {
  const { login, loading, error } = useAuth();
  const hasNip07 = typeof window !== "undefined" && !!window.nostr;

  return (
    <div className="onboarding">
      <div className="onboarding-hero">
        <div className="quote-mark">“</div>
        <h1>
          Recolha <em>depoimentos</em> que valem a pena exibir.
        </h1>
        <p className="lede">
          Testimonialstr é um cliente Nostr focado em endossos públicos
          — sem timeline, sem ruído. Você decide o que aparece no seu perfil,
          e cada testemunho carrega assinatura criptográfica de quem escreveu.
        </p>

        <div className="onboarding-actions">
          {hasNip07 ? (
            <button className="primary big" onClick={login} disabled={loading}>
              {loading ? "Conectando…" : "Entrar com extensão NIP-07"}
            </button>
          ) : (
            <div className="nip07-missing">
              <strong>Nenhuma extensão NIP-07 detectada.</strong>
              <p>
                Para usar o Testimonialstr você precisa de uma extensão de
                assinatura Nostr instalada no navegador:
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
                  — minimalista, open-source
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
                  — usa o keychain do macOS
                </li>
              </ul>
              <p className="muted small">
                Depois de instalar, recarregue esta página.
              </p>
            </div>
          )}
          {error && <div className="error-banner">{error}</div>}
        </div>
      </div>

      <div className="onboarding-cards">
        <div className="info-card">
          <div className="info-num">1</div>
          <h3>Receba</h3>
          <p>
            Pessoas escrevem testemunhos cifrados via gift-wrap (NIP-59). Só
            chegam ao mundo se você aprovar.
          </p>
        </div>
        <div className="info-card">
          <div className="info-num">2</div>
          <h3>Aprove</h3>
          <p>
            Cada testemunho carrega a assinatura do autor. Você verifica e
            decide o que entra na sua lista pública (kind:10064).
          </p>
        </div>
        <div className="info-card">
          <div className="info-num">3</div>
          <h3>Compartilhe</h3>
          <p>
            Seu perfil tem uma URL pública.{" "}
            <code>?p=npub1…</code> — qualquer pessoa pode ver os testemunhos
            verificados, em qualquer cliente compatível.
          </p>
        </div>
      </div>
    </div>
  );
}
