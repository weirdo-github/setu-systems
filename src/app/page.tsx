import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Megaphone,
  Share2,
  TrendingUp,
  UserRound,
} from "lucide-react";

const portals = [
  {
    id: "finance",
    eyebrow: "setu",
    name: "Finance",
    href: "/finance",
    status: "Live",
    accent: "#5F7A6B",
    tint: "#E7EDE8",
    Icon: TrendingUp,
    summary: "Billing, contracts, receivables, payables, people, audit, and AskSetu operations.",
  },
  {
    id: "discover",
    eyebrow: "setu",
    name: "Discover",
    href: "/discover",
    status: "Live",
    accent: "#C68A3E",
    tint: "#F3E7D8",
    Icon: Compass,
    summary: "Opportunity inventory, source refresh, matching, review queues, and outreach logs.",
  },
  {
    id: "customer",
    eyebrow: "setu",
    name: "Customer",
    href: "",
    status: "Planned",
    accent: "#6E89A6",
    tint: "#E6ECF2",
    Icon: UserRound,
    summary: "Client profiles, evidence intake, service progress, and controlled client views.",
  },
  {
    id: "media",
    eyebrow: "setu",
    name: "Media",
    href: "",
    status: "Planned",
    accent: "#A35E72",
    tint: "#EFE3E7",
    Icon: Megaphone,
    summary: "Press assets, public proof, publications, and external validation workflows.",
  },
  {
    id: "referral",
    eyebrow: "setu",
    name: "Referral",
    href: "/referral",
    status: "Live",
    accent: "#8A9A5B",
    tint: "#ECF0E2",
    Icon: Share2,
    summary: "Public referral intake, referrer lookup, reward qualification, and approval flow.",
  },
];

export default function SystemsLandingPage() {
  return (
    <main className="systems-landing">
      <section className="systems-goal" aria-label="Setu Systems goal">
        <span>Goal</span>
        <p>
          Setu Systems exists to run every Setu operating portal from one production-ready hub:
          unified identity, shared data discipline, and focused workflows for each team.
        </p>
      </section>

      <section className="systems-hero">
        <div className="systems-wordmark" aria-label="setu systems">
          <span className="systems-logo-text">setu</span>
          <span className="systems-logo-line" />
          <span className="systems-logo-sub">setu systems</span>
        </div>
        <div className="systems-hero-copy">
          <p className="systems-kicker">Unified production workspace</p>
          <h1>One Setu system. Purpose-built portals.</h1>
          <p>
            A single deployable product family for finance, referral, and discovery operations,
            designed to grow into customer and media portals without fragmenting the stack.
          </p>
        </div>
      </section>

      <section className="systems-panel" aria-label="Setu portals">
        <div className="systems-section-head">
          <div className="systems-section-title">
            <span>04</span>
            <h2>The five portals</h2>
          </div>
          <p>
            One family: shared wordmark, shared operating model, and clear portal distinction by
            function, icon, and accent.
          </p>
        </div>
        <div className="systems-portal-grid">
          {portals.map((portal) => {
            const Icon = portal.Icon;
            const cardContent = (
              <>
                <span className="systems-card-icon" style={{ backgroundColor: portal.tint, color: portal.accent }}>
                  <Icon size={22} />
                </span>
                <span className="systems-card-eyebrow">{portal.eyebrow}</span>
                <h3>{portal.name}</h3>
                <p>{portal.summary}</p>
                <span className={`systems-card-cta ${portal.status === "Live" ? "is-live" : ""}`}>
                  {portal.status === "Live" ? "Open portal" : "Planned"}
                  {portal.status === "Live" ? <ArrowRight size={15} /> : null}
                </span>
              </>
            );

            return portal.href ? (
              <Link
                className="systems-portal-card"
                href={portal.href}
                key={portal.id}
                style={{ borderTopColor: portal.accent }}
              >
                {cardContent}
              </Link>
            ) : (
              <article
                aria-label={`${portal.name} planned portal`}
                className="systems-portal-card is-planned"
                key={portal.id}
                style={{ borderTopColor: portal.accent }}
              >
                {cardContent}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
