import type { ReactNode } from "react";

export const statusPrimaryAction =
  "bg-brand-maroon hover:bg-brand-maroon-dark inline-flex min-h-14 w-full items-center justify-center rounded-xl px-6 py-4 text-base font-bold text-white transition-colors motion-reduce:transition-none";
export const statusSecondaryAction =
  "border-brand-border/50 text-brand-ink hover:bg-brand-paper inline-flex min-h-14 w-full items-center justify-center rounded-xl border bg-white px-6 py-4 text-base font-bold transition-colors motion-reduce:transition-none";

/** Shared public status-page frame. It needs neither an account provider nor a router. */
export function StatusPageLayout({
  title,
  code,
  description,
  icon,
  children,
  homeHref = "/",
  supportHref = "mailto:icto-admin@pup.edu.ph",
}: {
  title: string;
  code: string;
  description: ReactNode;
  icon: ReactNode;
  children: ReactNode;
  homeHref?: string;
  supportHref?: string;
}) {
  return (
    <div className="text-brand-ink flex min-h-dvh flex-col bg-white">
      <a
        href="#status-main"
        className="focus:text-brand-maroon sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>
      <header className="relative z-10 flex min-h-[88px] shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-white px-5 py-4 shadow-lg sm:px-8 md:min-h-[100px]">
        <a
          href={homeHref}
          className="flex min-h-11 items-center gap-3 rounded-md"
          aria-label="CBPUPSIS home"
        >
          <img
            src="/apple-touch-icon.png"
            alt=""
            width="60"
            height="60"
            className="size-12 shrink-0 sm:size-[60px]"
          />
          <span className="text-brand-maroon">
            <span className="block text-2xl leading-none font-bold tracking-tight sm:text-4xl">
              CBPUPSIS
            </span>
            <span className="mt-1 block text-xs font-semibold sm:text-base">
              PUP Academic Portal
            </span>
          </span>
        </a>
      </header>
      <main
        id="status-main"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-5 py-12 focus-visible:outline-none sm:py-20"
      >
        <section aria-labelledby="status-title" className="w-full max-w-2xl text-center">
          <div className="text-brand-maroon mx-auto mb-7 flex size-20 items-center justify-center sm:size-24">
            {icon}
          </div>
          <p className="text-brand-muted mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
            {code}
          </p>
          <h1
            id="status-title"
            className="text-brand-maroon text-3xl leading-tight font-bold tracking-tight sm:text-5xl"
          >
            {title}
          </h1>
          <div className="text-brand-muted mx-auto mt-6 max-w-lg text-base leading-relaxed sm:text-xl">
            {description}
          </div>
          <div className="mx-auto mt-9 max-w-lg space-y-3 sm:mt-12">{children}</div>
          <p className="text-brand-muted mt-10 text-sm leading-relaxed sm:mt-16 sm:text-base">
            Need further assistance?{" "}
            <a
              href={supportHref}
              className="text-brand-maroon inline-flex min-h-11 items-center rounded-sm font-bold underline-offset-4 hover:underline"
            >
              Contact PUP IT Support
            </a>
          </p>
        </section>
      </main>
      <footer className="text-brand-footer-text flex shrink-0 flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-5 text-xs font-semibold sm:px-8 sm:text-sm">
        <p>
          ©{" "}
          {new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Manila" }).format(
            new Date(),
          )}{" "}
          Polytechnic University of the Philippines
        </p>
        <nav aria-label="University information" className="flex flex-wrap gap-x-6 sm:gap-x-10">
          <a
            className="inline-flex min-h-11 items-center rounded-sm uppercase hover:underline"
            href="https://www.pup.edu.ph/privacy/"
          >
            Privacy Policy
          </a>
          <a
            className="inline-flex min-h-11 items-center rounded-sm uppercase hover:underline"
            href="https://www.pup.edu.ph/terms/"
          >
            Terms of Service
          </a>
          <a
            className="inline-flex min-h-11 items-center rounded-sm uppercase hover:underline"
            href="https://www.pup.edu.ph/students/registrar"
          >
            University Registrar
          </a>
        </nav>
      </footer>
    </div>
  );
}
