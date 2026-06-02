"use client"

import { useMemo, useState } from "react"

import { SECTORS } from "@/lib/portfolio-data"

import { ClientLogos } from "./ClientLogos"
import { PortfolioCTA } from "./PortfolioCTA"
import { PortfolioFooter } from "./PortfolioFooter"
import { PortfolioHero } from "./PortfolioHero"
import { PortfolioLoader } from "./PortfolioLoader"
import { PortfolioNav } from "./PortfolioNav"
import { PdfBanner } from "./PdfBanner"
import { ProcessSection } from "./ProcessSection"
import { ProjectGrid } from "./ProjectGrid"
import { SectorTabs } from "./SectorTabs"
import { TestimonialsSection } from "./TestimonialsSection"
import { TrustBar } from "./TrustBar"
import { WhyUs } from "./WhyUs"

type PortfolioPageProps = {
  leadName?: string
  defaultSector: string
}

const portfolioStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap');

  :root {
    --port-bg: #FBF9F4;
    --port-bg-soft: #F5F1E8;
    --port-surface: #FFFFFF;
    --port-card: #FFFFFF;
    --port-card-hover: #FCFAF5;
    --port-border: #E8E2D2;
    --port-border-soft: #F0EBDE;
    --port-border-hover: #C9B687;
    --port-ink: #1A1612;
    --port-ink-soft: #2B2620;
    --port-text: #1A1612;
    --port-secondary: #5A5147;
    --port-muted: #8F8676;
    --port-muted-soft: #B5AC9C;
    --port-accent: #A57F3F;
    --port-accent-bright: #C9A876;
    --port-accent-deep: #7E5D29;
    --port-accent-warm: #E8D5A8;
    --port-accent-soft: rgba(165,127,63,0.08);
    --port-accent-line: rgba(165,127,63,0.25);
    --port-accent-glow: rgba(201,168,118,0.18);
    --port-gold: #C9A876;
    --port-gold-light: #E8D5A8;
    --port-shadow-sm: 0 1px 2px rgba(26,22,18,0.04), 0 1px 3px rgba(26,22,18,0.03);
    --port-shadow-md: 0 4px 12px rgba(26,22,18,0.05), 0 2px 6px rgba(26,22,18,0.04);
    --port-shadow-lg: 0 16px 40px rgba(26,22,18,0.08), 0 4px 12px rgba(26,22,18,0.05);
    --port-shadow-xl: 0 24px 56px rgba(26,22,18,0.10), 0 8px 20px rgba(26,22,18,0.06);
  }

  .port-page * { box-sizing: border-box; margin: 0; padding: 0; }
  .port-page {
    font-family: 'DM Sans', sans-serif;
    background: var(--port-bg);
    color: var(--port-text);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  .port-syne, .font-syne { font-family: 'Syne', sans-serif; letter-spacing: -0.01em; }
  .port-serif { font-family: 'Cormorant Garamond', serif; }

  html { scroll-behavior: smooth; }

  .port-page::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      radial-gradient(circle at 0% 0%, rgba(201,168,118,0.04), transparent 45%),
      radial-gradient(circle at 100% 100%, rgba(165,127,63,0.03), transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: #FBF9F4; }
  ::-webkit-scrollbar-thumb { background: #D9CFB4; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #C9A876; }

  ::selection { background: rgba(201,168,118,0.35); color: #1A1612; }

  .port-page section { box-shadow: none; }

  .port-section { padding-top: 120px; padding-bottom: 120px; }
  @media (max-width: 1024px) {
    .port-section { padding-top: 88px; padding-bottom: 88px; }
  }
  @media (max-width: 768px) {
    .port-section { padding: 72px 24px !important; }
  }

  .port-page .project-card .arrow-btn { opacity: 0; transform: translateY(-50%) scale(0.92); }
  .port-page .project-card:hover .arrow-btn { opacity: 1; transform: translateY(-50%) scale(1); }
  /* Touch devices have no hover — keep carousel arrows visible so users can navigate */
  @media (hover: none) {
    .port-page .project-card .arrow-btn { opacity: 1; transform: translateY(-50%) scale(1); }
  }

  .port-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--port-accent-deep);
    font-weight: 500;
  }
  .port-eyebrow::before {
    content: '';
    width: 28px;
    height: 1px;
    background: var(--port-accent);
    display: inline-block;
  }

  .port-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 32px;
    background: var(--port-ink);
    color: var(--port-bg);
    border: 1px solid var(--port-ink);
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-decoration: none;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: transform 250ms cubic-bezier(0.4,0,0.2,1), box-shadow 250ms cubic-bezier(0.4,0,0.2,1), background 250ms ease;
    box-shadow: 0 4px 14px rgba(26,22,18,0.18);
  }
  .port-btn-primary:hover {
    transform: translateY(-2px);
    background: var(--port-accent-deep);
    box-shadow: 0 10px 28px rgba(126,93,41,0.30);
  }
  .port-btn-primary .arrow {
    transition: transform 250ms cubic-bezier(0.4,0,0.2,1);
  }
  .port-btn-primary:hover .arrow { transform: translateX(4px); }

  .port-btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 32px;
    background: transparent;
    color: var(--port-ink);
    border: 1px solid var(--port-border-hover);
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-decoration: none;
    cursor: pointer;
    transition: all 250ms cubic-bezier(0.4,0,0.2,1);
  }
  .port-btn-secondary:hover {
    background: var(--port-accent-soft);
    border-color: var(--port-accent);
    color: var(--port-accent-deep);
    transform: translateY(-2px);
  }

  @keyframes port-bounce {
    0%, 100% { transform: translateY(0); opacity: 0.6; }
    50% { transform: translateY(8px); opacity: 1; }
  }
  @keyframes port-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes port-float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }
  @keyframes port-pulse-soft {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.04); }
  }
  .port-float { animation: port-float 6s ease-in-out infinite; }
  .port-scroll-indicator { animation: port-bounce 2s ease-in-out infinite; }

  .port-link-underline {
    background-image: linear-gradient(var(--port-accent), var(--port-accent));
    background-size: 0 1px;
    background-position: 0 100%;
    background-repeat: no-repeat;
    transition: background-size 350ms cubic-bezier(0.4,0,0.2,1), color 250ms ease;
  }
  .port-link-underline:hover {
    background-size: 100% 1px;
    color: var(--port-accent-deep);
  }

  .why-card-underline {
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 600ms cubic-bezier(0.4,0,0.2,1);
  }
  .group:hover .why-card-underline {
    transform: scaleX(1);
  }
  .group:hover .why-card-top-line {
    transform: scaleX(1) !important;
  }
  .group:hover .why-card-accent {
    width: 96px !important;
  }

  @keyframes gold-shimmer-ltr {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(180%); }
  }
  @keyframes gold-shimmer-rtl {
    0% { transform: translateX(180%); }
    100% { transform: translateX(-100%); }
  }
  .port-gold-shimmer-ltr {
    animation: gold-shimmer-ltr 14s linear infinite;
    will-change: transform;
  }
  .port-gold-shimmer-rtl {
    animation: gold-shimmer-rtl 18s linear infinite;
    animation-delay: -4s;
    will-change: transform;
  }
  @media (prefers-reduced-motion: reduce) {
    .port-gold-shimmer-ltr,
    .port-gold-shimmer-rtl {
      animation: none;
    }
  }

  @keyframes port-play-vibrate {
    0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
    10% { transform: translate(-1px, 0) rotate(-4deg) scale(1.08); }
    20% { transform: translate(1px, 0) rotate(4deg) scale(1.08); }
    30% { transform: translate(-1px, 1px) rotate(-3deg) scale(1.08); }
    40% { transform: translate(1px, -1px) rotate(3deg) scale(1.08); }
    50% { transform: translate(-1px, 0) rotate(-2deg) scale(1.06); }
    60% { transform: translate(1px, 0) rotate(2deg) scale(1.06); }
    70% { transform: translate(0, 0) rotate(0deg) scale(1.04); }
    80% { transform: translate(0, 0) rotate(0deg) scale(1.02); }
  }
  .port-play-vibrate {
    animation: port-play-vibrate 1.8s ease-in-out infinite;
    transform-origin: center;
  }
  .port-play-vibrate:hover {
    animation-play-state: paused;
  }

  @keyframes port-play-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(255,255,255,0.7);
      opacity: 1;
    }
    70% {
      box-shadow: 0 0 0 16px rgba(255,255,255,0);
      opacity: 0;
    }
    100% {
      box-shadow: 0 0 0 16px rgba(255,255,255,0);
      opacity: 0;
    }
  }
  .port-play-pulse {
    animation: port-play-pulse 1.8s cubic-bezier(0.4,0,0.2,1) infinite;
  }
  .port-play-pulse-delay {
    animation-delay: 0.9s;
  }

  /* ───────── Mobile responsive overrides ───────── */
  @media (max-width: 768px) {
    .port-section {
      padding-left: 20px !important;
      padding-right: 20px !important;
      padding-top: 72px !important;
      padding-bottom: 72px !important;
    }

    .port-section-header {
      margin-bottom: 40px !important;
    }

    .port-hero-content {
      padding-left: 20px !important;
      padding-right: 20px !important;
    }

    .port-nav-inner {
      padding-left: 20px !important;
      padding-right: 20px !important;
    }

    .port-tabs-inner {
      padding-left: 16px !important;
      padding-right: 16px !important;
    }

    .port-cta-section {
      padding-left: 24px !important;
      padding-right: 24px !important;
    }

    .port-footer-inner {
      padding-left: 20px !important;
      padding-right: 20px !important;
    }

    .port-pdf-banner {
      margin-left: 20px !important;
      margin-right: 20px !important;
    }

    .port-trust-bar {
      padding-left: 20px !important;
      padding-right: 20px !important;
    }

    .port-projects-grid {
      padding-left: 20px !important;
      padding-right: 20px !important;
    }

    /* Hide hero decorative right-pane elements on phones */
    .port-hero-decor {
      display: none !important;
    }

    /* Hide hero prev/next arrow buttons on phones (swipe is more natural) */
    .hero-arrow {
      display: none !important;
    }

    /* CTA contact section: hide desktop layout on mobile */
    .cta-contact-desktop {
      display: none !important;
    }
    .cta-contact-mobile {
      display: flex !important;
    }

    /* Mobile nav: hide the website link, show hamburger */
    .port-nav-website-link {
      display: none !important;
    }
    .port-hamburger {
      display: flex !important;
    }

    /* TrustBar — 2x2 stat grid + wrapping cert pills */
    .trust-stats-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 32px 16px !important;
      width: 100% !important;
    }
    .trust-cert-row {
      flex-wrap: wrap !important;
      justify-content: center !important;
      padding: 0 8px !important;
      gap: 8px !important;
    }
    .trust-cert-pill {
      white-space: nowrap !important;
      flex-shrink: 0 !important;
    }
    .trust-iso-divider {
      display: none !important;
    }

    /* Long Syne headings: allow break to avoid horizontal scroll */
    .port-syne {
      word-break: break-word;
      overflow-wrap: break-word;
    }

    /* ClientLogos carousel: tighter padding on phones */
    .logo-track > div {
      padding: 0 16px !important;
    }

    /* PdfBanner: stack inner content + buttons full width */
    .port-pdf-inner {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 24px !important;
    }
    .port-pdf-buttons {
      width: 100% !important;
      flex-direction: column !important;
    }
    .port-pdf-buttons a {
      width: 100% !important;
      text-align: center !important;
      justify-content: center !important;
    }

    /* CTA contact info row: force single column (works for both flex + grid) */
    .port-contact-row {
      grid-template-columns: 1fr !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 12px !important;
    }
    .port-contact-item {
      width: 100% !important;
      max-width: 320px !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }
  }

  /* Below 1024px hide hero right-side decorative elements (large watermark etc.) */
  @media (max-width: 1024px) {
    .port-hero-right {
      display: none !important;
    }
  }

  /* Desktop: hamburger button must NEVER show */
  @media (min-width: 769px) {
    .port-hamburger {
      display: none !important;
    }
    .cta-contact-mobile {
      display: none !important;
    }
    .cta-contact-desktop {
      display: flex !important;
    }
    .cta-contact-box {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
    }
  }

  /* CTA buttons stack on small mobile only (<= 640px) */
  @media (max-width: 640px) {
    .port-cta-buttons {
      flex-direction: column !important;
      align-items: center !important;
      width: 100% !important;
    }
    .port-cta-buttons a {
      width: 100% !important;
      max-width: 320px !important;
      justify-content: center !important;
    }
  }

  /* ───────── Global overflow prevention ───────── */
  @media (max-width: 768px) {
    .port-page {
      overflow-x: hidden !important;
    }
    .port-page * {
      max-width: 100vw;
    }
    /* Exception: the auto-scrolling logo carousel relies on width: max-content
       to seamlessly loop — capping it to 100vw would break the animation. */
    .port-page .logo-track {
      max-width: none !important;
    }
    .port-page section {
      overflow-x: hidden;
    }
  }
`

export function PortfolioPage({ leadName, defaultSector }: PortfolioPageProps) {
  const initialSector = useMemo(
    () => SECTORS.find((sector) => sector.id === defaultSector) ?? SECTORS[0],
    [defaultSector]
  )
  const [activeSector, setActiveSector] = useState(initialSector)

  const handleSectorChange = (sectorId: string) => {
    const nextSector = SECTORS.find((sector) => sector.id === sectorId)
    if (!nextSector) return

    setActiveSector(nextSector)
    window.setTimeout(() => {
      document.getElementById("projects")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }

  return (
    <main className="port-page">
      <style dangerouslySetInnerHTML={{ __html: portfolioStyles }} />
      <PortfolioLoader />
      <PortfolioNav />
      <PortfolioHero sector={activeSector} leadName={leadName} />
      <TrustBar />
      <ClientLogos />
      <SectorTabs activeSector={activeSector} onSelect={handleSectorChange} />
      <ProjectGrid sector={activeSector} />
      <PdfBanner sector={activeSector} />
      <ProcessSection />
      <WhyUs />
      <TestimonialsSection />
      <PortfolioCTA />
      <PortfolioFooter />
    </main>
  )
}
