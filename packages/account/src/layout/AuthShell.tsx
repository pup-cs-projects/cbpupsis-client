import type { ReactNode } from "react";

import logo from "../assets/pup-logo.png";
import "./auth.css";

/** The sign-in layout every account screen shares: brand, campaign, the card, the footer. */
export function AuthShell({
  busy = false,
  cardClassName = "",
  skipLabel = "Skip to sign in",
  children,
}: {
  busy?: boolean;
  cardClassName?: string;
  skipLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-page">
      <a className="skip-link" href="#sign-in">
        {skipLabel}
      </a>
      <main className="login-scene">
        <div className="scene-inner">
          <div className="portal-brand">
            <img
              src={logo}
              alt="Polytechnic University of the Philippines seal"
              width="64"
              height="64"
            />
            <div>
              <p className="brand-name">CBPUPSIS</p>
              <p className="brand-subtitle">PUP Academic Portal</p>
            </div>
          </div>
          <div className="campaign" aria-label="Reforging excellence. Sinta, now in the cloud.">
            <span className="campaign-eyebrow">REFORGING EXCELLENCE</span>
            <p>
              SINTA
              <br />
              NOW IN
              <br />
              <span>THE CLOUD</span>
            </p>
          </div>
          <section
            id="sign-in"
            className={`login-card ${cardClassName}`.trim()}
            aria-labelledby="auth-title"
            aria-busy={busy}
          >
            {children}
          </section>
        </div>
      </main>
      <footer className="portal-footer">
        <p>© 2026 Polytechnic University of the Philippines</p>
        <nav aria-label="University information">
          <a href="https://www.pup.edu.ph/privacy/">Privacy Policy</a>
          <a href="https://www.pup.edu.ph/terms/">Terms of Service</a>
          <a href="https://www.pup.edu.ph/students/registrar">University Registrar</a>
        </nav>
      </footer>
    </div>
  );
}
