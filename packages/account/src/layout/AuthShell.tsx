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
    // Locked to the viewport on desktop (1024px wide, 880px tall or more); shorter windows scroll so the form is never clipped. Spacing tightens with height in auth.css.
    <div className="auth-page min-[1024px]:[@media(min-height:880px)]:h-screen min-[1024px]:[@media(min-height:880px)]:overflow-hidden">
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
      <footer className="portal-footer min-h-[54px]! py-2! text-gray-700!">
        <p className="text-xs!">© 2026 Polytechnic University of the Philippines</p>
        <nav aria-label="University information">
          <a className="min-h-8! text-xs!" href="https://www.pup.edu.ph/privacy/">
            Privacy Policy
          </a>
          <a className="min-h-8! text-xs!" href="https://www.pup.edu.ph/terms/">
            Terms of Service
          </a>
          <a className="min-h-8! text-xs!" href="https://www.pup.edu.ph/students/registrar">
            University Registrar
          </a>
        </nav>
      </footer>
    </div>
  );
}
