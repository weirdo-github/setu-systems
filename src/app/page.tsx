const livePortals = [
  {
    name: "setu finance",
    href: "/finance",
    summary: "Finance operations, contract intake, billing, receipts, payables, people, audit, and AskSetu.",
  },
  {
    name: "setu referral",
    href: "/referral",
    summary: "Public referral intake, referrer lookup, review workflow, rewards, and finance approval.",
  },
  {
    name: "setu discovery",
    href: "/discover",
    summary: "Opportunity inventory, source refresh, client matching, review queue, and outreach logs.",
  },
];

const plannedPortals = [
  "setu customer",
  "setu media",
];

export default function SystemsLandingPage() {
  return (
    <main className="systems-landing">
      <section className="systems-hero">
        <div className="systems-wordmark" aria-label="setu systems">
          <span className="systems-logo-text">setu</span>
          <span className="systems-logo-line" />
          <span className="systems-logo-sub">setu systems</span>
        </div>
        <div className="systems-hero-copy">
          <p className="systems-kicker">Unified production workspace</p>
          <h1>Setu Systems</h1>
          <p>
            One deployable product family for finance operations, referrals, and discovery workflows,
            backed by a shared operational data layer and portal-specific access paths.
          </p>
        </div>
      </section>

      <section className="systems-panel" aria-label="Live portals">
        <div className="systems-section-head">
          <h2>Live portals</h2>
          <p>Each portal keeps its own function while sharing the same Setu identity.</p>
        </div>
        <div className="systems-portal-grid">
          {livePortals.map((portal) => (
            <a className="systems-portal-card" href={portal.href} key={portal.name}>
              <span>{portal.name}</span>
              <p>{portal.summary}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="systems-panel systems-panel-muted" aria-label="Planned portals">
        <div className="systems-section-head">
          <h2>Planned portals</h2>
          <p>These product areas are reserved in the system architecture and documentation.</p>
        </div>
        <div className="systems-planned-list">
          {plannedPortals.map((portal) => (
            <span key={portal}>{portal}</span>
          ))}
        </div>
      </section>
    </main>
  );
}
