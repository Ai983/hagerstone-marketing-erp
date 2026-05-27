"use client"

/* eslint-disable @next/next/no-img-element */

import { portfolioMedia } from "@/lib/utils/portfolio-media"

const FOOTER_LINKS = {
  services: [
    { label: "Office Interiors", href: "#projects" },
    { label: "MEP Engineering", href: "#projects" },
    { label: "Facade & Glazing", href: "#projects" },
    { label: "PEB", href: "#projects" },
    { label: "Hospitality", href: "#projects" },
  ],
  company: [
    { label: "About Us", href: "https://hagerstone.com" },
    { label: "Our Process", href: "#process" },
    { label: "Why Hagerstone", href: "#why" },
    { label: "Testimonials", href: "#testimonials" },
    { label: "Contact", href: "#contact" },
  ],
}

export function PortfolioFooter() {
  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      event.preventDefault()
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <footer
      className="relative overflow-hidden border-t border-[var(--port-border)] px-6 pt-20 pb-10 md:px-12 lg:px-[8vw]"
      style={{
        background:
          "linear-gradient(180deg, var(--port-bg-soft) 0%, #F0EBDE 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, var(--port-accent-warm), transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative">
        <div className="grid grid-cols-1 gap-12 pb-16 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <a href="/portfolio" className="inline-flex items-center gap-3 no-underline">
              <img
                src={portfolioMedia("/portfolio/hagerstone-logo.png")}
                alt="Hagerstone International"
                style={{
                  height: 110,
                  width: "auto",
                  maxWidth: 400,
                  objectFit: "contain",
                  display: "block",
                }}
                onError={(event) => {
                  event.currentTarget.style.display = "none"
                  const fallback = document.getElementById("footer-logo-fallback")
                  if (fallback) fallback.style.display = "block"
                }}
              />
              <div id="footer-logo-fallback" style={{ display: "none" }} className="port-syne">
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "0.22em",
                    color: "var(--port-ink)",
                    lineHeight: 1,
                  }}
                >
                  HAGERSTONE
                </div>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.3em",
                    color: "var(--port-muted)",
                    marginTop: 4,
                  }}
                >
                  INTERNATIONAL
                </div>
              </div>
            </a>

            <p className="mt-6 max-w-md text-[14px] leading-[1.75] text-[var(--port-secondary)]">
              A design-build firm crafting workspaces, retail, hospitality &amp; industrial environments across India since 2015. ISO 9001:2015 certified, 500+ projects delivered.
            </p>

            <div className="mt-7">
              <div className="mb-3 text-[10px] font-medium tracking-[0.22em] text-[var(--port-muted)]">
                FOLLOW US
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  {
                    label: "Instagram",
                    handle: "@hagerstone_international",
                    href: "https://www.instagram.com/hagerstone_international/",
                    brandColor: "#E1306C",
                    brandHoverBg:
                      "linear-gradient(135deg, #FFD340 0%, #E1306C 50%, #C13584 100%)",
                    path: "M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4zM17.5 6.5h.01M3 12c0-3.2.1-3.7.2-5 .2-1.3.5-2.2 1.2-3 .7-.7 1.5-1 2.8-1.2 1.2-.1 1.7-.2 5-.2s3.7.1 5 .2c1.3.2 2.2.5 2.9 1.2.7.7 1 1.5 1.2 2.9.1 1.2.2 1.7.2 5 0 3.2-.1 3.7-.2 5-.2 1.3-.5 2.2-1.2 2.9-.7.7-1.5 1-2.9 1.2-1.2.1-1.7.2-5 .2s-3.7 0-5-.2c-1.3-.2-2.2-.5-2.9-1.2-.7-.7-1-1.5-1.2-2.9C3.1 15.7 3 15.2 3 12z",
                  },
                  {
                    label: "Facebook",
                    handle: "HagerstoneInternational",
                    href: "https://www.facebook.com/HagerstoneInternational/",
                    brandColor: "#1877F2",
                    brandHoverBg: "#1877F2",
                    path: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
                  },
                  {
                    label: "LinkedIn",
                    handle: "Hagerstone International",
                    href: "https://www.linkedin.com/company/14708271/",
                    brandColor: "#0A66C2",
                    brandHoverBg: "#0A66C2",
                    path: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
                  },
                  {
                    label: "WhatsApp",
                    handle: "+91 78606 50640",
                    href: "https://wa.me/917860650640",
                    brandColor: "#25D366",
                    brandHoverBg: "#25D366",
                    path: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
                  },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${social.label} — ${social.handle}`}
                    title={`${social.label} · ${social.handle}`}
                    className="social-icon group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[var(--port-border)] bg-[var(--port-surface)] text-[var(--port-secondary)] transition-all duration-300 hover:-translate-y-1.5 hover:border-transparent hover:text-white hover:shadow-lg"
                    style={{
                      ["--brand-bg" as string]: social.brandHoverBg,
                    }}
                  >
                    <span
                      className="social-icon-bg pointer-events-none absolute inset-0 scale-0 rounded-full transition-transform duration-300 ease-out group-hover:scale-100"
                      style={{ background: social.brandHoverBg }}
                    />
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="relative z-[1]"
                    >
                      <path
                        d={social.path}
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="mb-5 text-[11px] tracking-[0.18em] text-[var(--port-muted)]">SERVICES</div>
            <ul className="space-y-3">
              {FOOTER_LINKS.services.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(event) => handleLinkClick(event, link.href)}
                    className="port-link-underline inline-block text-[14px] text-[var(--port-secondary)] no-underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <div className="mb-5 text-[11px] tracking-[0.18em] text-[var(--port-muted)]">COMPANY</div>
            <ul className="space-y-3">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(event) => handleLinkClick(event, link.href)}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                    className="port-link-underline inline-block text-[14px] text-[var(--port-secondary)] no-underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <div className="mb-5 text-[11px] tracking-[0.18em] text-[var(--port-muted)]">REACH US</div>
            <ul className="space-y-3">
              <li>
                <a
                  href="tel:+919980813555"
                  className="port-link-underline inline-block text-[14px] text-[var(--port-secondary)] no-underline"
                >
                  +91 99808 13555
                </a>
              </li>
              <li>
                <a
                  href="mailto:sales@hagerstone.com"
                  className="port-link-underline inline-block text-[14px] text-[var(--port-secondary)] no-underline"
                >
                  sales@hagerstone.com
                </a>
              </li>
              <li>
                <a
                  href="https://hagerstone.com"
                  target="_blank"
                  rel="noreferrer"
                  className="port-link-underline inline-block text-[14px] text-[var(--port-secondary)] no-underline"
                >
                  hagerstone.com
                </a>
              </li>
              <li className="text-[14px] leading-[1.6] text-[var(--port-muted)]">
                Noida · Delhi NCR
                <br />
                Pan India Operations
              </li>
            </ul>
          </div>
        </div>

        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--port-border-hover), transparent)",
          }}
        />

        <div className="mt-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-[12px] text-[var(--port-muted)]">
            © 2025 Hagerstone International Pvt. Ltd. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--port-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[var(--port-accent)]" />
              ISO 9001:2015
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[var(--port-accent)]" />
              MSME Certified
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[var(--port-accent)]" />
              Made with precision in India
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
