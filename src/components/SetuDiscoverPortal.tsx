"use client";

import {
  Archive,
  ArrowUpRight,
  Award,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Database,
  Edit3,
  FileText,
  Globe,
  LinkIcon,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { scoreMatch } from "@/lib/matching";
import { statusTone } from "@/lib/status";
import type {
  ClientRecord,
  EmailLog,
  EventRecord,
  IngestionItem,
  IngestionRun,
  MatchRecord,
  ReviewItem,
  Source,
  SourcePage,
  User,
} from "@/lib/types";

type AppState = {
  user: User;
  events: EventRecord[];
  clients: ClientRecord[];
  sources: Source[];
  sourcePages: SourcePage[];
  emailLogs: EmailLog[];
  ingestionRuns: IngestionRun[];
  ingestionItems: IngestionItem[];
  reviewItems: ReviewItem[];
  eventCategories: string[];
  criteriaTags: string[];
};

const navItems = [
  { id: "dashboard", label: "Overview", icon: Database },
  { id: "inventory", label: "Inventory", icon: Award },
  { id: "clients", label: "Clients", icon: Users },
  { id: "matches", label: "Match & send", icon: Sparkles },
  { id: "emails", label: "Email log", icon: Mail },
  { id: "sources", label: "Source registry", icon: ShieldCheck },
  { id: "ingestion", label: "Daily refresh", icon: RefreshCw },
  { id: "review", label: "Review queue", icon: Clock3 },
] as const;

type TabId = (typeof navItems)[number]["id"];

const DISCOVER_BASE_PATH = "/discover";
const DISCOVER_API_BASE = "/api/discover";

const PORTAL_BRAND = "setu discovery";
const PORTAL_SHORT_BRAND = "setu";
const PORTAL_LABEL = "setu discovery";

const tabPathById: Record<TabId, string> = {
  dashboard: DISCOVER_BASE_PATH,
  inventory: `${DISCOVER_BASE_PATH}/inventory`,
  clients: `${DISCOVER_BASE_PATH}/clients`,
  matches: `${DISCOVER_BASE_PATH}/match-send`,
  emails: `${DISCOVER_BASE_PATH}/email-log`,
  sources: `${DISCOVER_BASE_PATH}/source-registry`,
  ingestion: `${DISCOVER_BASE_PATH}/daily-refresh`,
  review: `${DISCOVER_BASE_PATH}/review-queue`,
};

const tabIdByPath: Record<string, TabId> = {
  "/": "dashboard",
  "/dashboard": "dashboard",
  "/inventory": "inventory",
  "/clients": "clients",
  "/match-send": "matches",
  "/matches": "matches",
  "/email-log": "emails",
  "/emails": "emails",
  "/source-registry": "sources",
  "/sources": "sources",
  "/daily-refresh": "ingestion",
  "/ingestion": "ingestion",
  "/review-queue": "review",
  "/review": "review",
};

function tabFromPathname(pathname: string): TabId {
  const withoutBase = pathname.startsWith(DISCOVER_BASE_PATH)
    ? pathname.slice(DISCOVER_BASE_PATH.length) || "/"
    : pathname;
  const normalized = withoutBase.replace(/\/+$/, "") || "/";
  return tabIdByPath[normalized] ?? "dashboard";
}

const sourceRegistryCategoryOptions = [
  "Awards & Nominations",
  "Judging",
  "Media & Interview",
  "Authorship",
  "Speaking",
  "Memberships & Fellowships",
  "Exhibitions & Showcases",
  "Editorial / Board / Leadership",
];

const sourceApplicabilityTags = [
  ...sourceRegistryCategoryOptions,
  "Published Material",
  "Original Contributions",
  "Leading/Critical Role",
  "High Salary",
  "Commercial Success",
];

type EventForm = {
  title: string;
  category: string;
  fee_amount: string;
  fee_currency: string;
  fee_purpose: string;
  credibility_tier: string;
  manual_status: string;
  deadline: string;
  criteria_tags: string;
  keywords: string;
  field: string;
  location: string;
  apply_url: string;
  source_url: string;
  source_id: string;
  summary: string;
  actionability: string;
  notes: string;
  archived: boolean;
};

type ClientForm = {
  name: string;
  email: string;
  field: string;
  location: string;
  target_criteria: string;
  covered_criteria: string;
  keywords: string;
  preferred_categories: string;
  notes: string;
};

type SourceForm = {
  name: string;
  organization: string;
  source_category: string;
  criteria_tags: string;
  typical_fee: string;
  registry_rank: string;
  canonical_domain: string;
  seed_url: string;
  credibility_tier: string;
  status: string;
  refresh_enabled: boolean;
  notes: string;
};

type PushEligibility = {
  pushable: boolean;
  reason: string;
} | null;

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const requestUrl = url.startsWith("/api/")
    ? `${DISCOVER_API_BASE}${url.slice("/api".length)}`
    : url;
  const response = await fetch(requestUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

function listText(values: string[]) {
  return values.filter(Boolean).join(", ");
}

function listItems(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggleListItem(value: string, item: string) {
  const items = listItems(value);
  const lower = item.toLowerCase();
  const exists = items.some((current) => current.toLowerCase() === lower);
  return exists
    ? items.filter((current) => current.toLowerCase() !== lower).join(", ")
    : [...items, item].join(", ");
}

function money(event: EventRecord) {
  if (!event.fee_amount || Number(event.fee_amount) === 0) return "No fee";
  return `${event.fee_currency} ${Number(event.fee_amount).toLocaleString()}`;
}

function dateInputValue(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function deadlineText(value: string | null) {
  if (!value) return "Rolling";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Rolling";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function dateText(value?: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function dateTimeText(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function emptyEventForm(categories: string[]): EventForm {
  return {
    title: "",
    category: categories[0] ?? "Awards",
    fee_amount: "",
    fee_currency: "USD",
    fee_purpose: "",
    credibility_tier: "2",
    manual_status: "active",
    deadline: "",
    criteria_tags: "",
    keywords: "",
    field: "",
    location: "",
    apply_url: "",
    source_url: "",
    source_id: "",
    summary: "",
    actionability: "3",
    notes: "",
    archived: false,
  };
}

function eventToForm(event: EventRecord): EventForm {
  return {
    title: event.title,
    category: event.category,
    fee_amount: event.fee_amount ?? "",
    fee_currency: event.fee_currency,
    fee_purpose: event.fee_purpose,
    credibility_tier: String(event.credibility_tier),
    manual_status: event.manual_status,
    deadline: dateInputValue(event.deadline),
    criteria_tags: listText(event.criteria_tags),
    keywords: listText(event.keywords),
    field: event.field,
    location: event.location,
    apply_url: event.apply_url,
    source_url: event.source_url,
    source_id: event.source_id ?? "",
    summary: event.summary,
    actionability: String(event.actionability),
    notes: event.notes,
    archived: event.archived,
  };
}

function emptyClientForm(): ClientForm {
  return {
    name: "",
    email: "",
    field: "",
    location: "",
    target_criteria: "",
    covered_criteria: "",
    keywords: "",
    preferred_categories: "",
    notes: "",
  };
}

function emptySourceForm(): SourceForm {
  return {
    name: "",
    organization: "",
    source_category: "",
    criteria_tags: "",
    typical_fee: "",
    registry_rank: "",
    canonical_domain: "",
    seed_url: "",
    credibility_tier: "2",
    status: "active",
    refresh_enabled: true,
    notes: "",
  };
}

function sourceToForm(source: Source): SourceForm {
  return {
    name: source.name,
    organization: source.organization,
    source_category: source.source_category,
    criteria_tags: listText(source.criteria_tags),
    typical_fee: source.typical_fee,
    registry_rank: source.registry_rank ? String(source.registry_rank) : "",
    canonical_domain: source.canonical_domain,
    seed_url: source.seed_url,
    credibility_tier: String(source.credibility_tier),
    status: source.status,
    refresh_enabled: source.refresh_enabled,
    notes: source.notes,
  };
}

function clientToForm(client: ClientRecord): ClientForm {
  return {
    name: client.name,
    email: client.email,
    field: client.field,
    location: client.location,
    target_criteria: listText(client.target_criteria),
    covered_criteria: listText(client.covered_criteria),
    keywords: listText(client.keywords),
    preferred_categories: listText(client.preferred_categories),
    notes: client.notes,
  };
}

function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${statusTone(status)}`}>{status}</span>;
}

function engagementTone(status: ClientRecord["engagement_status"]) {
  if (status === "active") return "success";
  if (status === "dormant") return "warn";
  if (status === "inactive") return "danger";
  return "";
}

function clientEngagementAgeHours(client: ClientRecord) {
  if (!client.engagement_as_of) return Infinity;
  const parsed = new Date(client.engagement_as_of).getTime();
  if (!Number.isFinite(parsed)) return Infinity;
  return (Date.now() - parsed) / 3.6e6;
}

function isClientPushable(client: ClientRecord) {
  return client.engagement_status === "active" && clientEngagementAgeHours(client) <= 24;
}

function EngagementBadge({
  client,
  showAsOf,
}: {
  client: ClientRecord;
  showAsOf?: boolean;
}) {
  const stale = client.engagement_status === "active" && !isClientPushable(client);
  return (
    <div className="engagement-block">
      <span className={`pill ${engagementTone(client.engagement_status)}`}>
        {client.engagement_status}
      </span>
      {showAsOf ? (
        <span className="engagement-meta">
          {client.engagement_as_of ? `as of ${dateText(client.engagement_as_of)}` : "not synced"}
          {stale ? " · stale" : ""}
        </span>
      ) : null}
    </div>
  );
}

function EngagementStatusLegend() {
  const rows: Array<{
    status: ClientRecord["engagement_status"];
    finance: string;
    discover: string;
  }> = [
    {
      status: "active",
      finance: "Customer is currently eligible under Finance-owned engagement rules.",
      discover: "Pushable only when the Finance timestamp is fresh within 24 hours.",
    },
    {
      status: "dormant",
      finance: "Customer exists in Finance but is not currently active for new outreach.",
      discover: "Not pushable. Admins can view the profile, but new opportunity sends are blocked.",
    },
    {
      status: "inactive",
      finance: "Customer is not eligible for current engagement activity.",
      discover: "Not pushable. Match lists, client recommendations, sends, and exports fail closed.",
    },
    {
      status: "unknown",
      finance: "No confirmed Finance status has reached Discover yet.",
      discover: "Not pushable until a Finance sync or webhook confirms an active fresh status.",
    },
  ];

  return (
    <div className="card status-legend-card">
      <div className="status-legend-head">
        <div>
          <div className="card-label">Customer status meaning</div>
          <h3>Finance flag and Discover behavior</h3>
        </div>
        <span className="chip">No amount data</span>
      </div>
      <div className="status-legend-grid">
        {rows.map((row) => (
          <div className="status-legend-row" key={row.status}>
            <span className={`pill ${engagementTone(row.status)}`}>{row.status}</span>
            <div>
              <div className="status-label">Finance portal</div>
              <div className="sub">{row.finance}</div>
            </div>
            <div>
              <div className="status-label">Discover portal</div>
              <div className="sub">{row.discover}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SetuDiscoverPortal() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    typeof window === "undefined" ? "dashboard" : tabFromPathname(window.location.pathname),
  );
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("all");
  const [clientSearch, setClientSearch] = useState("");
  const [eventModal, setEventModal] = useState<{ event?: EventRecord } | null>(null);
  const [clientModal, setClientModal] = useState<{ client?: ClientRecord } | null>(null);
  const [sourceModal, setSourceModal] = useState<{ source?: Source } | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [matchesEligibility, setMatchesEligibility] = useState<PushEligibility>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [ingestionRunning, setIngestionRunning] = useState(false);
  const [emailModal, setEmailModal] = useState<{
    match: MatchRecord;
    client: ClientRecord;
  } | null>(null);

  const refresh = async () => {
    try {
      const nextState = await requestJson<AppState>("/api/state");
      setState(nextState);
      setSelectedClientId((current) => current || nextState.clients[0]?.id || "");
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  };

  const clientEngagementKey = useMemo(
    () => (state?.clients ?? [])
      .map((client) => `${client.id}:${client.engagement_status}:${client.engagement_as_of ?? ""}`)
      .join("|"),
    [state?.clients],
  );

  useEffect(() => {
    void refresh();
  }, []);

  const navigateToTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    if (typeof window === "undefined") return;
    const nextPath = tabPathById[tab];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ tab }, "", nextPath);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setActiveTab(tabFromPathname(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = activeTab === "dashboard"
      ? "setu discovery"
      : `setu discovery - ${topbarTitle(activeTab)}`;
  }, [activeTab]);

  useEffect(() => {
    if (!selectedClientId) {
      setMatches([]);
      setMatchesEligibility(null);
      return;
    }

    let cancelled = false;
    setMatchesLoading(true);
    requestJson<{ matches: MatchRecord[]; pushEligibility: PushEligibility }>(`/api/matches?clientId=${selectedClientId}`)
      .then((payload) => {
        if (!cancelled) {
          setMatches(payload.matches);
          setMatchesEligibility(payload.pushEligibility);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
          setMatchesEligibility(null);
        }
      })
      .finally(() => {
        if (!cancelled) setMatchesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClientId, state?.events.length, clientEngagementKey]);

  const filteredEvents = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    return (state?.events ?? []).filter((event) => {
      const matchesCategory = inventoryCategory === "all" || event.category === inventoryCategory;
      const matchesQuery = [event.title, event.category, event.field, event.location, event.summary]
        .join(" ")
        .toLowerCase()
        .includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [state, inventorySearch, inventoryCategory]);

  const filteredClients = useMemo(() => {
    const query = clientSearch.toLowerCase();
    return (state?.clients ?? []).filter((client) =>
      [client.name, client.email, client.field, client.location, client.notes]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [state, clientSearch]);

  const selectedClient = useMemo(
    () => state?.clients.find((client) => client.id === selectedClientId) ?? null,
    [state, selectedClientId],
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoginError("");

    try {
      await requestJson<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      await refresh();
      showToast("Signed in");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Could not sign in");
    }
  };

  const logout = async () => {
    await requestJson("/api/auth/logout", { method: "POST" });
    setState(null);
    showToast("Signed out");
  };

  if (loading) {
    return <div className="empty">Loading {PORTAL_SHORT_BRAND}...</div>;
  }

  if (!state) {
    return <LoginShell onLogin={login} error={loginError} />;
  }

  return (
    <div className="discover-shell">
      <div className="app">
        <aside className="sidebar">
        <div className="logo-wrap">
          <button className="wordmark logo-home" onClick={() => navigateToTab("dashboard")} type="button">
            <span className="letters">{PORTAL_SHORT_BRAND}</span>
            <span className="deck" />
            <span className="brand-sub">{PORTAL_LABEL}</span>
          </button>
        </div>
        <div className="nav-label">Operate</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => navigateToTab(item.id)}
              type="button"
            >
              <Icon size={16} />
              {item.label}
              {item.id === "inventory" ? <span className="badge">{state.events.length}</span> : null}
              {item.id === "clients" ? <span className="badge">{state.clients.length}</span> : null}
              {item.id === "review" ? <span className="badge">{state.reviewItems.filter((review) => review.status === "open").length}</span> : null}
            </button>
          );
        })}
        <div className="sidebar-foot">
          <div className="chip">
            <CheckCircle2 size={14} />
            Portal ready
          </div>
          <div style={{ marginTop: 8 }}>{state.user.name}</div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>{topbarTitle(activeTab)}</h1>
            <div className="sub">{topbarSubtitle(activeTab)}</div>
          </div>
          <div className="topbar-right">
            <span className="chip">
              <Database size={14} />
              Postgres
            </span>
            <button className="btn btn-ghost" type="button" onClick={logout}>
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>

        <div className="content">
          {activeTab === "dashboard" ? (
            <DashboardView
              events={state.events}
              clients={state.clients}
              sources={state.sources}
              categories={state.eventCategories}
              ingestionRuns={state.ingestionRuns}
              reviewItems={state.reviewItems}
              onGoInventory={() => navigateToTab("inventory")}
              onGoClients={() => navigateToTab("clients")}
              onGoReview={() => navigateToTab("review")}
            />
          ) : null}

          {activeTab === "inventory" ? (
            <InventoryView
              events={filteredEvents}
              sources={state.sources}
              categories={state.eventCategories}
              query={inventorySearch}
              selectedCategory={inventoryCategory}
              onQuery={setInventorySearch}
              onCategory={setInventoryCategory}
              onNew={() => setEventModal({})}
              onEdit={(event) => setEventModal({ event })}
              onArchive={async (event) => {
                await requestJson(`/api/events/${event.id}`, { method: "DELETE" });
                await refresh();
                showToast("Opportunity archived");
              }}
            />
          ) : null}

          {activeTab === "clients" ? (
            <ClientsView
              clients={filteredClients}
              query={clientSearch}
              onQuery={setClientSearch}
              onNew={() => setClientModal({})}
              onEdit={(client) => setClientModal({ client })}
              onDelete={async (client) => {
                await requestJson(`/api/clients/${client.id}`, { method: "DELETE" });
                await refresh();
                showToast("Client removed");
              }}
            />
          ) : null}

          {activeTab === "matches" ? (
            <MatchesView
              clients={state.clients}
              events={state.events}
              selectedClientId={selectedClientId}
              selectedClient={selectedClient}
              matches={matches}
              eligibility={matchesEligibility}
              loading={matchesLoading}
              onSelectClient={setSelectedClientId}
              onCompose={(match, client) => setEmailModal({ match, client })}
            />
          ) : null}

          {activeTab === "emails" ? <EmailLogView logs={state.emailLogs} /> : null}
          {activeTab === "sources" ? (
            <SourcesView
              sources={state.sources}
              sourcePages={state.sourcePages}
              onNew={() => setSourceModal({})}
              onEdit={(source) => setSourceModal({ source })}
            />
          ) : null}
          {activeTab === "ingestion" ? (
            <IngestionView
              runs={state.ingestionRuns}
              items={state.ingestionItems}
              running={ingestionRunning}
              onRun={async () => {
                setIngestionRunning(true);
                try {
                  const result = await requestJson<{ run: IngestionRun }>("/api/ingestion/run", {
                    method: "POST",
                    body: JSON.stringify({ mode: "manual" }),
                  });
                  await refresh();
                  showToast(result.run.status === "completed" ? "Phase 2 ingestion completed" : "Phase 2 ingestion failed");
                } catch (error) {
                  showToast(error instanceof Error ? error.message : "Phase 2 ingestion failed");
                } finally {
                  setIngestionRunning(false);
                }
              }}
            />
          ) : null}
          {activeTab === "review" ? (
            <ReviewQueueView
              items={state.reviewItems}
              onStatus={async (item, status) => {
                try {
                  await requestJson(`/api/review-items/${item.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ status }),
                  });
                  await refresh();
                  showToast(`Review item marked ${status}`);
                } catch (error) {
                  showToast(error instanceof Error ? error.message : "Could not update review item");
                }
              }}
            />
          ) : null}
        </div>
      </main>

      {eventModal ? (
        <EventModal
          categories={state.eventCategories}
          criteriaTags={state.criteriaTags}
          sources={state.sources}
          event={eventModal.event}
          onClose={() => setEventModal(null)}
          onSave={async (form) => {
            const url = eventModal.event ? `/api/events/${eventModal.event.id}` : "/api/events";
            await requestJson(url, {
              method: eventModal.event ? "PUT" : "POST",
              body: JSON.stringify(form),
            });
            setEventModal(null);
            await refresh();
            showToast("Inventory saved");
          }}
        />
      ) : null}

      {clientModal ? (
        <ClientModal
          client={clientModal.client}
          onClose={() => setClientModal(null)}
          onSave={async (form) => {
            const url = clientModal.client ? `/api/clients/${clientModal.client.id}` : "/api/clients";
            await requestJson(url, {
              method: clientModal.client ? "PUT" : "POST",
              body: JSON.stringify(form),
            });
            setClientModal(null);
            await refresh();
            showToast("Client saved");
          }}
        />
      ) : null}

      {emailModal ? (
        <EmailModal
          client={emailModal.client}
          match={emailModal.match}
          onClose={() => setEmailModal(null)}
          onSent={async (payload) => {
            const result = await requestJson<{ status: string }>("/api/email/send", {
              method: "POST",
              body: JSON.stringify(payload),
            });
            setEmailModal(null);
            await refresh();
            showToast(result.status === "sent" ? "Email sent" : "Email logged locally");
          }}
        />
      ) : null}

      {sourceModal ? (
        <SourceModal
          source={sourceModal.source}
          onClose={() => setSourceModal(null)}
          onSave={async (form) => {
            const url = sourceModal.source ? `/api/sources/${sourceModal.source.id}` : "/api/sources";
            await requestJson(url, {
              method: sourceModal.source ? "PUT" : "POST",
              body: JSON.stringify(form),
            });
            setSourceModal(null);
            await refresh();
            showToast("Source registry saved");
          }}
        />
      ) : null}

        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}

function LoginShell({
  onLogin,
  error,
}: {
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
}) {
  return (
    <div className="discover-shell">
      <div className="auth-shell">
        <div className="auth-grid">
        <section className="auth-hero">
          <div className="wordmark discover-login-logo" aria-label="setu discovery">
            <span className="letters">setu</span>
            <span className="deck" />
            <span className="brand-sub">{PORTAL_LABEL}</span>
          </div>
          <div className="auth-kicker">setu discovery</div>
          <h1>{PORTAL_BRAND}</h1>
          <p className="auth-copy">
            Inventory, client profile coverage, transparent matching, and team email logging on a local database.
          </p>
          <div className="auth-points">
            <div className="auth-point">
              <Database size={18} />
              Real Postgres records for the discovery system of record.
            </div>
            <div className="auth-point">
              <Sparkles size={18} />
              Deterministic matching with score evidence kept visible.
            </div>
            <div className="auth-point">
              <Mail size={18} />
              Email workflow with local review fallback when SMTP is unset.
            </div>
          </div>
        </section>
        <form className="auth-card" onSubmit={onLogin}>
          <div className="card-label">Team login</div>
          <h2>Sign in</h2>
          <p className="auth-note">Use the local review account for {PORTAL_BRAND}.</p>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" defaultValue="admin@discover.local" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" defaultValue="discover123" />
          </div>
          {error ? <div className="pill danger">{error}</div> : null}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} type="submit">
            <ShieldCheck size={15} />
            Sign in
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}

function DashboardView({
  events,
  clients,
  sources,
  categories,
  ingestionRuns,
  reviewItems,
  onGoInventory,
  onGoClients,
  onGoReview,
}: {
  events: EventRecord[];
  clients: ClientRecord[];
  sources: Source[];
  categories: string[];
  ingestionRuns: IngestionRun[];
  reviewItems: ReviewItem[];
  onGoInventory: () => void;
  onGoClients: () => void;
  onGoReview: () => void;
}) {
  const activeEvents = events.filter((event) =>
    ["Active", "Closing", "Rolling"].includes(event.derived_status),
  );
  const uniqueActiveEvents = Array.from(
    new Map(
      activeEvents.map((event) => [
        `${event.title.toLowerCase()}|${event.source_url || event.apply_url || event.id}`,
        event,
      ]),
    ).values(),
  );
  const openReviews = reviewItems.filter((item) => item.status === "open").length;
  const enabledSources = sources.filter((source) => source.status === "active" && source.refresh_enabled).length;
  const latestIngestion = ingestionRuns[0];
  const pushableClients = clients.filter(isClientPushable);
  const categoryRows = categories.map((category) => {
    const opportunities = uniqueActiveEvents.filter((event) => event.category === category);
    const demandClients = pushableClients.filter((client) =>
      client.preferred_categories.some((item) => item.toLowerCase() === category.toLowerCase()),
    );
    const demand = demandClients.length;
    const coverage = demand ? Math.min(100, Math.round((opportunities.length / demand) * 100)) : opportunities.length ? 100 : 0;

    return {
      category,
      opportunities,
      demand,
      coverage,
    };
  });
  const coveredCategories = categoryRows.filter((row) => row.opportunities.length > 0).length;
  const topCategories = [...categoryRows].sort((left, right) => {
    const delta = right.opportunities.length - left.opportunities.length;
    if (delta) return delta;
    return right.demand - left.demand;
  });
  const visibleCategoryRows = topCategories.filter((row) => row.opportunities.length > 0 || row.demand > 0);

  return (
    <>
      <div className="metrics">
        <Metric
          label="Active opportunities"
          value={uniqueActiveEvents.length}
          icon={<Award size={15} />}
          detail="Deduped active, closing, and rolling records"
          accent
        />
        <Metric
          label="Categories covered"
          value={coveredCategories}
          icon={<BriefcaseBusiness size={15} />}
          detail={`${categories.length} tracked opportunity categories`}
        />
        <Metric
          label="Active clients"
          value={pushableClients.length}
          icon={<Users size={15} />}
          detail={`${clients.length - pushableClients.length} gated by Finance status`}
        />
        <Metric
          label="Review interrupts"
          value={openReviews}
          icon={<Clock3 size={15} />}
          detail="Human decisions waiting"
        />
      </div>
      <InfoNote>
        Overview reflects active, closing, and rolling opportunities only. Category demand counts only Finance-active clients with fresh status.
      </InfoNote>

      <div className="dashboard-grid">
        <section className="section">
          <div className="section-head">
            <h2>Active opportunities by category</h2>
            <span className="chip">{uniqueActiveEvents.length} active</span>
          </div>
          <div className="card category-matrix">
            {visibleCategoryRows.map((row) => (
              <div className="category-row" key={row.category}>
                <div>
                  <div className="cust">{row.category}</div>
                  <div className="sub">
                    {row.opportunities.length} active · {row.demand} client{row.demand === 1 ? "" : "s"} seeking
                  </div>
                </div>
                <div className="category-bar" aria-label={`${row.category} coverage`}>
                  <span style={{ width: `${Math.max(row.coverage, row.opportunities.length ? 18 : 0)}%` }} />
                </div>
                <div className="category-counts">
                  <span className="score">{row.opportunities.length}</span>
                  <span className="pill">{row.demand} clients</span>
                </div>
              </div>
            ))}
            {!visibleCategoryRows.length ? <div className="empty">No active opportunity or client demand categories yet.</div> : null}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Client demand by category</h2>
            <button className="btn btn-ghost" type="button" onClick={onGoClients}>
              <Users size={15} />
              Clients
            </button>
          </div>
          <div className="card demand-list">
            {visibleCategoryRows.slice(0, 6).map((row) => (
              <div className="demand-row" key={row.category}>
                <div>
                  <div className="cust">{row.category}</div>
                  <div className="sub">
                    {row.demand ? `${row.demand} active client${row.demand === 1 ? "" : "s"}` : "No active client demand"}
                  </div>
                </div>
                <span className={`pill ${row.opportunities.length >= row.demand && row.demand ? "success" : row.demand ? "warn" : ""}`}>
                  {row.opportunities.length >= row.demand && row.demand ? "covered" : row.demand ? "needs supply" : "supply only"}
                </span>
              </div>
            ))}
            {!visibleCategoryRows.length ? <div className="empty">No active client demand yet.</div> : null}
          </div>
        </section>
      </div>

      <div className="dashboard-grid secondary">
        <section className="section">
          <div className="section-head">
            <h2>Active opportunity list</h2>
            <button className="btn btn-ghost" type="button" onClick={onGoInventory}>
              <ArrowUpRight size={15} />
              Inventory
            </button>
          </div>
          <div className="card sheet-wrap">
            <div className="sheet dashboard-sheet">
              <div className="trow head dashboard-opportunity-grid">
                <span>Opportunity</span>
                <span>Category</span>
                <span>Demand</span>
                <span>Status</span>
                <span>Deadline</span>
                <span>Tier</span>
              </div>
              {uniqueActiveEvents
                .slice()
                .sort((left, right) => left.category.localeCompare(right.category) || left.title.localeCompare(right.title))
                .map((event) => {
                  const demand = categoryRows.find((row) => row.category === event.category)?.demand ?? 0;
                  return (
                    <div className="trow dashboard-opportunity-grid" key={event.id}>
                      <div>
                        <button className="name-button" type="button" onClick={onGoInventory}>
                          {event.title}
                        </button>
                        <div className="sub">{event.summary}</div>
                      </div>
                      <span>{event.category}</span>
                      <span className="mono">{demand}</span>
                      <StatusPill status={event.derived_status} />
                      <span className="mono">{deadlineText(event.deadline)}</span>
                      <span className="pill">T{event.credibility_tier}</span>
                    </div>
                  );
                })}
              {!uniqueActiveEvents.length ? <div className="empty">No active opportunities yet.</div> : null}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Last refresh run</h2>
            <button className="btn btn-ghost" type="button" onClick={onGoReview}>
              <Clock3 size={15} />
              Review queue
            </button>
          </div>
          <div className="card health-card">
            <HealthRow label="Refreshable sources" value={`${enabledSources}/${sources.length}`} note="Canonical allowlist sources" />
            <HealthRow
              label="Ingestion run"
              value={latestIngestion ? latestIngestion.status : "none"}
              note={latestIngestion ? latestIngestionText(latestIngestion) : "No Phase 2 run yet"}
            />
            <HealthRow label="Needs review" value={String(openReviews)} note="Nothing publishes without team disposition" />
          </div>
        </section>
      </div>
    </>
  );
}

function latestIngestionText(run: IngestionRun) {
  return `${run.pages_checked} pages · ${run.events_upserted} upserts`;
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="info-note">
      <span className="info-dot" />
      {children}
    </div>
  );
}

function HealthRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="health-row">
      <div>
        <div className="card-label">{label}</div>
        <div className="sub">{note}</div>
      </div>
      <span className="pill ink">{value}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  detail,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div className={`metric ${accent ? "accent" : ""}`}>
      <div className="label">
        {icon}
        {label}
      </div>
      <div className="value">{value}</div>
      <div className="delta">{detail ?? "Studio record"}</div>
    </div>
  );
}

function InventoryView({
  events,
  sources,
  categories,
  query,
  selectedCategory,
  onQuery,
  onCategory,
  onNew,
  onEdit,
  onArchive,
}: {
  events: EventRecord[];
  sources: Source[];
  categories: string[];
  query: string;
  selectedCategory: string;
  onQuery: (value: string) => void;
  onCategory: (value: string) => void;
  onNew: () => void;
  onEdit: (event: EventRecord) => void;
  onArchive: (event: EventRecord) => void;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>Inventory</h2>
        <button className="btn btn-primary" type="button" onClick={onNew}>
          <Plus size={15} />
          Opportunity
        </button>
      </div>
      <div className="toolbar">
        <Search size={16} color="var(--text-3)" />
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search inventory"
        />
        <select
          aria-label="Filter inventory by EB-1A category"
          className="search-input category-filter"
          value={selectedCategory}
          onChange={(event) => onCategory(event.target.value)}
        >
          <option value="all">All EB-1A categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <span className="chip">{events.length} records</span>
        <span className="chip">{sources.length} sources</span>
      </div>
      <InfoNote>
        Filter by EB-1A category, use Details to inspect the opportunity, then open official apply and source links from the host site.
      </InfoNote>
      <div className="card sheet-wrap">
        <div className="sheet">
          <div className="trow head inventory-grid">
            <span>Opportunity</span>
            <span>Category</span>
            <span>Fee</span>
            <span>Credibility</span>
            <span>Status</span>
            <span>Added</span>
            <span>Deadline / source</span>
            <span>Actions</span>
          </div>
          {events.map((event) => (
            <div className="trow inventory-grid" key={event.id}>
              <div>
                <button className="name-button" type="button" onClick={() => onEdit(event)}>
                  {event.title}
                </button>
                <div className="sub">{event.summary}</div>
                <div className="tag-cloud" style={{ marginTop: 6 }}>
                  {event.criteria_tags.slice(0, 3).map((tag) => (
                    <span className="pill" key={tag}>{tag}</span>
                  ))}
                </div>
                <SummaryActionRow
                  applyUrl={event.apply_url}
                  onDetails={() => onEdit(event)}
                />
              </div>
              <span>{event.category}</span>
              <span className="mono">{money(event)}</span>
              <span className="pill">Tier {event.credibility_tier}</span>
              <StatusPill status={event.derived_status} />
              <span className="mono">{dateText(event.created_at)}</span>
              <div>
                <div className="mono">{deadlineText(event.deadline)}</div>
                <div className="sub">{event.source_name ?? event.source_url}</div>
                <div className="sub mobile-added-date">Added to inventory {dateText(event.created_at)}</div>
              </div>
              <div className="tag-cloud">
                <button className="btn btn-ghost" type="button" onClick={() => onEdit(event)} title="Edit">
                  <Edit3 size={15} />
                </button>
                <button className="btn btn-ghost btn-danger" type="button" onClick={() => onArchive(event)} title="Archive">
                  <Archive size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClientsView({
  clients,
  query,
  onQuery,
  onNew,
  onEdit,
  onDelete,
}: {
  clients: ClientRecord[];
  query: string;
  onQuery: (value: string) => void;
  onNew: () => void;
  onEdit: (client: ClientRecord) => void;
  onDelete: (client: ClientRecord) => void;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>Client profiles</h2>
        <button className="btn btn-primary" type="button" onClick={onNew}>
          <Plus size={15} />
          Client
        </button>
      </div>
      <div className="toolbar">
        <Search size={16} color="var(--text-3)" />
        <input
          className="search-input"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search clients"
        />
        <span className="chip">{clients.length} profiles</span>
      </div>
      <InfoNote>
        Target versus covered criteria drives the matching priority for each client.
      </InfoNote>
      <EngagementStatusLegend />
      <div className="card sheet-wrap">
        <div className="sheet">
          <div className="trow head client-grid">
            <span>Client</span>
            <span>Field</span>
            <span>Location</span>
            <span>Gap criteria</span>
            <span>Keywords</span>
            <span>Engagement</span>
            <span>Actions</span>
          </div>
          {clients.map((client) => {
            const covered = new Set(client.covered_criteria.map((item) => item.toLowerCase()));
            const gaps = client.target_criteria.filter((item) => !covered.has(item.toLowerCase()));
            return (
              <div className="trow client-grid" key={client.id}>
                <div>
                  <button className="name-button" type="button" onClick={() => onEdit(client)}>
                    {client.name}
                  </button>
                  <div className="sub">{client.email}</div>
                </div>
                <span>{client.field}</span>
                <span>{client.location}</span>
                <span className="sub">{gaps.join(", ") || "Covered"}</span>
                <span className="sub">{client.keywords.slice(0, 4).join(", ")}</span>
                <EngagementBadge client={client} showAsOf />
                <div className="tag-cloud">
                  <button className="btn btn-ghost" type="button" onClick={() => onEdit(client)} title="Edit">
                    <Edit3 size={15} />
                  </button>
                  <button className="btn btn-ghost btn-danger" type="button" onClick={() => onDelete(client)} title="Delete">
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MatchesView({
  clients,
  events,
  selectedClientId,
  selectedClient,
  matches,
  eligibility,
  loading,
  onSelectClient,
  onCompose,
}: {
  clients: ClientRecord[];
  events: EventRecord[];
  selectedClientId: string;
  selectedClient: ClientRecord | null;
  matches: MatchRecord[];
  eligibility: PushEligibility;
  loading: boolean;
  onSelectClient: (clientId: string) => void;
  onCompose: (match: MatchRecord, client: ClientRecord) => void;
}) {
  const [clientQuery, setClientQuery] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const clientQueryText = clientQuery.trim().toLowerCase();
  const manualQueryText = manualQuery.trim().toLowerCase();
  const canPush = Boolean(selectedClient && eligibility?.pushable);
  const clientOptions = useMemo(() => {
    const filtered = clients.filter((client) =>
      [client.name, client.email, client.field, client.location, client.keywords.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(clientQueryText),
    );
    if (selectedClient && !filtered.some((client) => client.id === selectedClient.id)) {
      return [selectedClient, ...filtered];
    }
    return filtered;
  }, [clients, clientQueryText, selectedClient]);
  const manualMatches = useMemo(() => {
    if (!selectedClient || manualQueryText.length < 2) return [];
    return events
      .filter((event) => !["Expired", "Inactive"].includes(event.derived_status))
      .filter((event) => {
        const haystack = [
          event.title,
          event.summary,
          event.category,
          event.source_name ?? "",
          event.field,
          event.location,
          event.criteria_tags.join(" "),
          event.keywords.join(" "),
        ].join(" ").toLowerCase();
        return haystack.includes(manualQueryText);
      })
      .map((event) => {
        const breakdown = scoreMatch(selectedClient, event);
        return {
          event,
          score: breakdown.total,
          breakdown,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 12);
  }, [events, manualQueryText, selectedClient]);

  return (
    <section className="section">
      <div className="section-head">
        <h2>Match & send</h2>
        <span className="chip">
          <Sparkles size={14} />
          AI match + manual push
        </span>
      </div>
      <div className="toolbar">
        <div className="search-field client-search-field">
          <Search size={15} />
          <input
            className="search-input"
            type="search"
            value={clientQuery}
            onChange={(event) => setClientQuery(event.target.value)}
            placeholder="Search clients by name, email, field, or keyword"
          />
        </div>
        <select className="search-input" value={selectedClientId} onChange={(event) => onSelectClient(event.target.value)}>
          {clientOptions.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
        <span className="chip">{clientOptions.length} clients</span>
      </div>
      {selectedClient ? (
        <div className="detail-banner" style={{ marginBottom: 14 }}>
          <div>
            <div className="card-label">Client criteria gap</div>
            <h2 style={{ margin: "4px 0 2px", fontSize: 20 }}>{selectedClient.name}</h2>
            <div className="sub">{selectedClient.target_criteria.join(", ")}</div>
          </div>
          <div className="banner-actions">
            <EngagementBadge client={selectedClient} showAsOf />
            <span className="chip">{selectedClient.covered_criteria.length} covered</span>
          </div>
        </div>
      ) : null}
      <InfoNote>
        {eligibility && !eligibility.pushable
          ? eligibility.reason
          : "Ranked by criterion gap, credibility, keyword fit, semantic fit, actionability, and location. Email sends are logged against active clients."}
      </InfoNote>
      <div className="card sheet-wrap">
        <div className="sheet">
          <div className="trow head match-grid">
            <span>Opportunity</span>
            <span>Score</span>
            <span>Gap fit</span>
            <span>Keywords / flags</span>
            <span>Send</span>
          </div>
          {loading ? <div className="empty">Computing matches...</div> : null}
          {!loading && matches.length === 0 ? (
            <div className="empty">{eligibility && !eligibility.pushable ? eligibility.reason : "No active matches yet."}</div>
          ) : null}
          {matches.map((match) => (
            <div className="trow match-grid match-row" key={match.event.id}>
              <div>
                <div className="cust">{match.event.title}</div>
                <div className="sub">{match.event.summary}</div>
              </div>
              <span className="score">{match.score}</span>
              <span className="sub">{match.breakdown.missingCriteria.join(", ") || "General profile fit"}</span>
              <div>
                <div className="sub">{match.breakdown.matchedKeywords.slice(0, 5).join(", ") || "No exact keyword hit"}</div>
                <div className="tag-cloud" style={{ marginTop: 6 }}>
                  {match.breakdown.flags.map((flag) => (
                    <span className="pill warn" key={flag}>{flag}</span>
                  ))}
                </div>
              </div>
              <button
                className="btn btn-primary send-action"
                type="button"
                disabled={!selectedClient}
                onClick={() => selectedClient && onCompose(match, selectedClient)}
              >
                <Send size={16} strokeWidth={1.9} />
                Email
              </button>
              <div className="match-breakdown-strip">
                <BreakdownItem label="Gap" value={match.breakdown.criterionGap} />
                <BreakdownItem label="Credibility" value={match.breakdown.credibility} />
                <BreakdownItem label="Keyword" value={match.breakdown.keyword} />
                <BreakdownItem label="Semantic" value={match.breakdown.semantic} />
                <BreakdownItem label="Action" value={match.breakdown.actionability} />
                <BreakdownItem label="Place" value={match.breakdown.location} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card manual-search-card">
        <div className="manual-search-head">
          <div>
            <div className="card-label">Manual opportunity push</div>
            <h3>Search active inventory</h3>
            <div className="sub">Find a specific opportunity, review the same fit score, then email it to the selected client.</div>
          </div>
          <span className="chip">{manualMatches.length} results</span>
        </div>
        <div className="toolbar manual-search-toolbar">
          <div className="search-field">
            <Search size={15} />
            <input
              className="search-input"
              type="search"
              value={manualQuery}
              onChange={(event) => setManualQuery(event.target.value)}
              placeholder="Search title, category, source, criteria, or keyword"
            />
          </div>
        </div>
        {manualQueryText.length < 2 ? (
          <div className="empty">Search at least 2 characters to manually find opportunities for this client.</div>
        ) : null}
        {manualQueryText.length >= 2 && manualMatches.length === 0 ? (
          <div className="empty">No active opportunities match that search.</div>
        ) : null}
        {manualMatches.length ? (
          <div className="manual-results">
            {manualMatches.map((match) => (
              <div className="manual-result" key={match.event.id}>
                <div>
                  <div className="cust">{match.event.title}</div>
                  <div className="sub">{match.event.summary}</div>
                  <div className="tag-cloud" style={{ marginTop: 8 }}>
                    <span className="pill">{match.event.category}</span>
                    <span className="pill">T{match.event.credibility_tier}</span>
                    <span className="pill">{match.event.derived_status}</span>
                  </div>
                </div>
                <div className="manual-score">
                  <span className="score">{match.score}</span>
                  <span className="sub">{match.breakdown.missingCriteria.join(", ") || "General profile fit"}</span>
                </div>
                <div className="manual-actions">
                  <button
                    className="btn btn-primary send-action"
                    type="button"
                    disabled={!canPush}
                    title={canPush ? "Email this opportunity" : eligibility?.reason ?? "Select an active client"}
                    onClick={() => selectedClient && onCompose(match, selectedClient)}
                  >
                    <Send size={16} strokeWidth={1.9} />
                    Email
                  </button>
                  {!canPush ? <div className="sub">{eligibility?.reason ?? "Select a client first"}</div> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BreakdownItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="breakdown-item">
      <div className="breakdown-label">{label}</div>
      <div className="breakdown-value">{value}</div>
    </div>
  );
}

function EmailLogView({ logs }: { logs: EmailLog[] }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>Email log</h2>
        <span className="chip">{logs.length} logged</span>
      </div>
      <div className="card sheet-wrap">
        <div className="sheet">
          <div className="trow head email-grid">
            <span>Time</span>
            <span>Client</span>
            <span>Opportunity</span>
            <span>Subject</span>
            <span>Status</span>
          </div>
          {logs.map((log) => (
            <div className="trow email-grid" key={log.id}>
              <span className="mono">{dateTimeText(log.created_at)}</span>
              <span>{log.client_name ?? log.to_email}</span>
              <span className="sub">{log.event_title ?? "General"}</span>
              <span>{log.subject}</span>
              <span className={`pill ${log.provider_status === "sent" ? "success" : "ink"}`}>{log.provider_status}</span>
            </div>
          ))}
          {!logs.length ? <div className="empty">No email attempts logged yet.</div> : null}
        </div>
      </div>
    </section>
  );
}

function optionalDateTime(value: string | null) {
  return value ? dateTimeText(value) : "Never";
}

function confidenceText(value: string | number | null) {
  if (value === null || value === "") return "n/a";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "n/a";
  return `${Math.round(numeric * 100)}%`;
}

function SourcesView({
  sources,
  sourcePages,
  onNew,
  onEdit,
}: {
  sources: Source[];
  sourcePages: SourcePage[];
  onNew: () => void;
  onEdit: (source: Source) => void;
}) {
  const enabledCount = sources.filter((source) => source.refresh_enabled && source.status === "active").length;

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>Source registry</h2>
          <button className="btn btn-primary" type="button" onClick={onNew}>
            <Plus size={15} />
            Source
          </button>
        </div>
        <div className="toolbar">
          <span className="chip">
            <ShieldCheck size={14} />
            {sources.length} sources
          </span>
          <span className="chip">
            <RefreshCw size={14} />
            {enabledCount} refreshable
          </span>
          <span className="chip">
            <Globe size={14} />
            {sourcePages.length} pages
          </span>
        </div>
        <InfoNote>
          The source registry is the canonical allowlist. Discovery should use official host pages and avoid aggregators.
        </InfoNote>
        <div className="card sheet-wrap">
          <div className="sheet">
            <div className="trow head source-grid">
              <span>Source</span>
              <span>Category</span>
              <span>Criteria / fee</span>
              <span>Seed page</span>
              <span>Tier</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {sources.map((source) => (
              <div className="trow source-grid" key={source.id}>
                <div>
                  <button className="name-button" type="button" onClick={() => onEdit(source)}>
                    {source.name}
                  </button>
                  <div className="sub">
                    {[source.organization, source.canonical_domain].filter(Boolean).join(" · ")}
                  </div>
                  <div className="sub">{source.notes || "No notes"}</div>
                </div>
                <div>
                  <span className="pill ink">{source.source_category || "Uncategorized"}</span>
                  {source.registry_rank ? <div className="sub">Registry #{source.registry_rank}</div> : null}
                </div>
                <div>
                  <div className="tag-cloud">
                    {source.criteria_tags.slice(0, 3).map((tag) => (
                      <span className="pill" key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="sub">{source.typical_fee || "Fee unknown"}</div>
                </div>
                <div>
                  {source.seed_url ? (
                    <a className="inline-link" href={source.seed_url} target="_blank" rel="noreferrer">
                      <LinkIcon size={13} />
                      Open seed
                    </a>
                  ) : (
                    <span className="sub">No seed</span>
                  )}
                </div>
                <span className="pill">Tier {source.credibility_tier}</span>
                <div className="tag-cloud">
                  <span className={`pill ${source.status === "active" ? "success" : "danger"}`}>
                    {source.status}
                  </span>
                  <span className={`pill ${source.refresh_enabled ? "ink" : ""}`}>
                    {source.refresh_enabled ? "refresh on" : "paused"}
                  </span>
                </div>
                <button className="btn btn-ghost" type="button" onClick={() => onEdit(source)} title="Edit source">
                  <Edit3 size={15} />
                  Edit
                </button>
              </div>
            ))}
            {!sources.length ? <div className="empty">No sources configured yet.</div> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Denylist</h2>
          <span className="chip">Blocked from active inventory</span>
        </div>
        <div className="card denylist-card">
          {[
            "Aggregator pages without official apply links",
            "Pay-to-play listings with weak credibility signals",
            "Retired demo fixture domains",
          ].map((item) => (
            <div className="deny-row" key={item}>
              <TriangleAlert size={15} />
              <span>{item}</span>
              <span className="pill danger">blocked</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Page monitor</h2>
          <span className="chip">Change detection</span>
        </div>
        <div className="card sheet-wrap">
          <div className="sheet">
            <div className="trow head source-page-grid">
              <span>Page</span>
              <span>Source</span>
              <span>Fetched</span>
              <span>Changed</span>
              <span>Status</span>
              <span>Link</span>
            </div>
            {sourcePages.map((page) => (
              <div className="trow source-page-grid" key={page.id}>
                <div>
                  <div className="cust">{page.label || "Seed page"}</div>
                  <div className="sub">{page.url}</div>
                </div>
                <span>{page.source_name ?? page.source_id}</span>
                <span className="mono">{optionalDateTime(page.last_fetched_at)}</span>
                <span className="mono">{optionalDateTime(page.last_changed_at)}</span>
                <span className={`pill ${page.status === "active" ? "success" : "danger"}`}>{page.status}</span>
                <a className="btn btn-link" href={page.url} target="_blank" rel="noreferrer">
                  <ArrowUpRight size={15} />
                  Open
                </a>
              </div>
            ))}
            {!sourcePages.length ? <div className="empty">No source pages configured yet.</div> : null}
          </div>
        </div>
      </section>
    </>
  );
}

function IngestionView({
  runs,
  items,
  running,
  onRun,
}: {
  runs: IngestionRun[];
  items: IngestionItem[];
  running: boolean;
  onRun: () => Promise<void>;
}) {
  const latest = runs[0];

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>Phase 2 ingestion</h2>
          <button className="btn btn-primary" type="button" disabled={running} onClick={() => void onRun()}>
            <RefreshCw size={15} />
            {running ? "Running" : "Run now"}
          </button>
        </div>
        <div className="detail-banner phase2-banner">
          <div>
            <div className="card-label">Latest run</div>
            <h2>{latest ? latest.status : "Not run yet"}</h2>
            <div className="sub">
              {latest
                ? `${latest.pages_checked} checked, ${latest.pages_changed} changed, ${latest.events_upserted} opportunities upserted`
                : "Run Phase 2 to fetch source pages, detect changes, extract opportunities, and refresh matches."}
            </div>
          </div>
          <div className="phase2-stats">
            <span className="chip">{latest ? `${latest.low_confidence_count} review` : "0 review"}</span>
            <span className="chip">{latest ? `${latest.expired_purged} expired` : "0 expired"}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Run history</h2>
          <span className="chip">{runs.length} runs</span>
        </div>
        <div className="card sheet-wrap">
          <div className="sheet">
            <div className="trow head run-grid">
              <span>Started</span>
              <span>Status</span>
              <span>Mode</span>
              <span>Pages</span>
              <span>Changed</span>
              <span>Events</span>
              <span>Review</span>
              <span>Error</span>
            </div>
            {runs.map((run) => (
              <div className="trow run-grid" key={run.id}>
                <span className="mono">{dateTimeText(run.started_at)}</span>
                <span className={`pill ${run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "ink"}`}>
                  {run.status}
                </span>
                <span>{run.mode}</span>
                <span className="mono">{run.pages_checked}</span>
                <span className="mono">{run.pages_changed}</span>
                <span className="mono">{run.events_upserted}</span>
                <span className="mono">{run.low_confidence_count}</span>
                <span className="sub">{run.error || run.notes}</span>
              </div>
            ))}
            {!runs.length ? <div className="empty">No ingestion runs yet.</div> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Extraction report</h2>
          <span className="chip">{items.length} items</span>
        </div>
        <div className="card sheet-wrap">
          <div className="sheet">
            <div className="trow head ingestion-item-grid">
              <span>Page</span>
              <span>Change</span>
              <span>Extraction</span>
              <span>Confidence</span>
              <span>Summary</span>
              <span>Created</span>
            </div>
            {items.map((item) => (
              <div className="trow ingestion-item-grid" key={item.id}>
                <div>
                  <a className="inline-link" href={item.page_url} target="_blank" rel="noreferrer">
                    <LinkIcon size={13} />
                    Source page
                  </a>
                  <div className="sub">{item.page_url}</div>
                </div>
                <span className="pill">{item.change_status}</span>
                <span className={`pill ${item.extraction_status === "upserted" ? "success" : item.extraction_status === "skipped" ? "ink" : ""}`}>
                  {item.extraction_status}
                </span>
                <span className="mono">{confidenceText(item.confidence)}</span>
                <span className="sub">{item.error || item.summary || "No summary"}</span>
                <span className="mono">{dateTimeText(item.created_at)}</span>
              </div>
            ))}
            {!items.length ? <div className="empty">No extraction items yet.</div> : null}
          </div>
        </div>
      </section>
    </>
  );
}

function ReviewQueueView({
  items,
  onStatus,
}: {
  items: ReviewItem[];
  onStatus: (item: ReviewItem, status: string) => Promise<void>;
}) {
  const openCount = items.filter((item) => item.status === "open").length;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Review queue</h2>
        <span className="chip">{openCount} open</span>
      </div>
      <InfoNote>
        Human-in-the-loop queue for low-confidence extractions and source concerns. Nothing publishes to active inventory without approval.
      </InfoNote>
      <div className="card sheet-wrap">
        <div className="sheet">
          <div className="trow head review-grid">
            <span>Opportunity</span>
            <span>Reason</span>
            <span>Confidence</span>
            <span>Source</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {items.map((item) => (
            <div className="trow review-grid" key={item.id}>
              <div>
                <div className="cust">{item.title}</div>
                <a className="inline-link" href={item.page_url} target="_blank" rel="noreferrer">
                  <LinkIcon size={13} />
                  Source page
                </a>
              </div>
              <span className="sub">{item.reason}</span>
              <span className="mono">{confidenceText(item.confidence)}</span>
              <span>{item.source_name ?? item.source_id ?? "Unassigned"}</span>
              <span className={`pill ${item.status === "open" ? "warn" : item.status === "rejected" ? "danger" : "success"}`}>{item.status}</span>
              <div className="tag-cloud">
                {item.status === "open" ? (
                  <>
                    <button className="btn btn-ghost" type="button" onClick={() => void onStatus(item, "approved")}>
                      <CheckCircle2 size={15} />
                      Approve
                    </button>
                    <button className="btn btn-ghost btn-danger" type="button" onClick={() => void onStatus(item, "rejected")}>
                      <X size={15} />
                      Reject
                    </button>
                  </>
                ) : (
                  <button className="btn btn-ghost" type="button" onClick={() => void onStatus(item, "open")}>
                    <Clock3 size={15} />
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
          {!items.length ? <div className="empty">No review items yet.</div> : null}
        </div>
      </div>
    </section>
  );
}

function EventModal({
  categories,
  criteriaTags,
  sources,
  event,
  onClose,
  onSave,
}: {
  categories: string[];
  criteriaTags: string[];
  sources: Source[];
  event?: EventRecord;
  onClose: () => void;
  onSave: (form: EventForm) => Promise<void>;
}) {
  const [form, setForm] = useState<EventForm>(event ? eventToForm(event) : emptyEventForm(categories));
  const [saving, setSaving] = useState(false);
  const sourceHref = form.source_url.trim();
  const applyHref = form.apply_url.trim();

  const update = (key: keyof EventForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="modal-back">
      <form
        className="modal wide"
        onSubmit={async (submitEvent) => {
          submitEvent.preventDefault();
          setSaving(true);
          await onSave(form);
          setSaving(false);
        }}
      >
        <div className="modal-head">
          <div>
            <div className="card-label">Inventory record</div>
            <h3>{event ? "Edit opportunity" : "New opportunity"}</h3>
          </div>
          <button className="x" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="modal-body">
          {sourceHref || applyHref ? (
            <div className="detail-banner link-banner">
              <div>
                <div className="card-label">Deep links</div>
                <div className="cust">Open source and application pages directly</div>
                <div className="sub">These links are stored with the opportunity record.</div>
              </div>
              <DeepLinkRow applyUrl={applyHref} sourceUrl={sourceHref} prominent />
            </div>
          ) : null}
          <div className="field">
            <label>Title</label>
            <input value={form.title} onChange={(change) => update("title", change.target.value)} required />
          </div>
          <div className="field-row">
            <FieldSelect label="Category" value={form.category} values={categories} onChange={(value) => update("category", value)} />
            <FieldSelect label="Credibility" value={form.credibility_tier} values={["1", "2", "3"]} onChange={(value) => update("credibility_tier", value)} />
          </div>
          <div className="field-row">
            <FieldInput label="Fee amount" value={form.fee_amount} onChange={(value) => update("fee_amount", value)} />
            <FieldInput label="Fee purpose" value={form.fee_purpose} onChange={(value) => update("fee_purpose", value)} />
          </div>
          <div className="field-row">
            <FieldInput label="Deadline" type="date" value={form.deadline} onChange={(value) => update("deadline", value)} />
            <FieldSelect label="Actionability" value={form.actionability} values={["1", "2", "3", "4", "5"]} onChange={(value) => update("actionability", value)} />
          </div>
          <div className="field-row">
            <FieldInput label="Field" value={form.field} onChange={(value) => update("field", value)} />
            <FieldInput label="Location" value={form.location} onChange={(value) => update("location", value)} />
          </div>
          <div className="field-row">
            <FieldInput label="Criteria tags" value={form.criteria_tags} onChange={(value) => update("criteria_tags", value)} placeholder={criteriaTags.slice(0, 3).join(", ")} />
            <FieldInput label="Keywords" value={form.keywords} onChange={(value) => update("keywords", value)} />
          </div>
          <div className="field-row">
            <FieldInput label="Apply link" value={form.apply_url} onChange={(value) => update("apply_url", value)} />
            <FieldInput label="Source link" value={form.source_url} onChange={(value) => update("source_url", value)} />
          </div>
          <div className="field">
            <label>Source</label>
            <select value={form.source_id} onChange={(change) => update("source_id", change.target.value)}>
              <option value="">Unassigned</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>{source.name}</option>
              ))}
            </select>
          </div>
          <FieldTextarea label="Summary" value={form.summary} onChange={(value) => update("summary", value)} />
          <FieldTextarea label="Notes" value={form.notes} onChange={(value) => update("notes", value)} />
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary" disabled={saving} type="submit">
            <CheckCircle2 size={15} />
            Save
          </button>
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function ClientModal({
  client,
  onClose,
  onSave,
}: {
  client?: ClientRecord;
  onClose: () => void;
  onSave: (form: ClientForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ClientForm>(client ? clientToForm(client) : emptyClientForm());
  const [saving, setSaving] = useState(false);
  const update = (key: keyof ClientForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="modal-back">
      <form
        className="modal"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          await onSave(form);
          setSaving(false);
        }}
      >
        <div className="modal-head">
          <div>
            <div className="card-label">Client profile</div>
            <h3>{client ? "Edit client" : "New client"}</h3>
          </div>
          <button className="x" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <FieldInput label="Name" value={form.name} onChange={(value) => update("name", value)} required />
            <FieldInput label="Email" type="email" value={form.email} onChange={(value) => update("email", value)} required />
          </div>
          <div className="field-row">
            <FieldInput label="Field" value={form.field} onChange={(value) => update("field", value)} />
            <FieldInput label="Location" value={form.location} onChange={(value) => update("location", value)} />
          </div>
          <FieldInput label="Target criteria" value={form.target_criteria} onChange={(value) => update("target_criteria", value)} />
          <FieldInput label="Covered criteria" value={form.covered_criteria} onChange={(value) => update("covered_criteria", value)} />
          <FieldInput label="Keywords" value={form.keywords} onChange={(value) => update("keywords", value)} />
          <FieldInput label="Preferred categories" value={form.preferred_categories} onChange={(value) => update("preferred_categories", value)} />
          <FieldTextarea label="Notes" value={form.notes} onChange={(value) => update("notes", value)} />
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary" disabled={saving} type="submit">
            <CheckCircle2 size={15} />
            Save
          </button>
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function SourceModal({
  source,
  onClose,
  onSave,
}: {
  source?: Source;
  onClose: () => void;
  onSave: (form: SourceForm) => Promise<void>;
}) {
  const [form, setForm] = useState<SourceForm>(source ? sourceToForm(source) : emptySourceForm());
  const [saving, setSaving] = useState(false);
  const update = (key: keyof SourceForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="modal-back">
      <form
        className="modal"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          await onSave(form);
          setSaving(false);
        }}
      >
        <div className="modal-head">
          <div>
            <div className="card-label">Canonical source</div>
            <h3>{source ? "Edit source" : "New source"}</h3>
          </div>
          <button className="x" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <FieldInput label="Name" value={form.name} onChange={(value) => update("name", value)} required />
          <div className="field-row">
            <FieldInput label="Organization" value={form.organization} onChange={(value) => update("organization", value)} />
            <FieldInput label="Registry rank" value={form.registry_rank} onChange={(value) => update("registry_rank", value)} placeholder="1" />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="source-registry-category">Registry category</label>
              <select
                id="source-registry-category"
                value={form.source_category}
                onChange={(event) => update("source_category", event.target.value)}
              >
                <option value="">Select source category</option>
                {sourceRegistryCategoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <FieldInput label="Typical fee" value={form.typical_fee} onChange={(value) => update("typical_fee", value)} />
          </div>
          <FieldInput label="Applicable EB-1A tags" value={form.criteria_tags} onChange={(value) => update("criteria_tags", value)} placeholder="Awards & Nominations, Judging" />
          <PresetTagPicker
            label="Predefined source applicability"
            selectedText={form.criteria_tags}
            values={sourceApplicabilityTags}
            onToggle={(value) => update("criteria_tags", toggleListItem(form.criteria_tags, value))}
          />
          <div className="field-row">
            <FieldInput label="Canonical domain" value={form.canonical_domain} onChange={(value) => update("canonical_domain", value)} required />
            <FieldSelect label="Credibility tier" value={form.credibility_tier} values={["1", "2", "3"]} onChange={(value) => update("credibility_tier", value)} />
          </div>
          <FieldInput label="Seed URL" value={form.seed_url} onChange={(value) => update("seed_url", value)} placeholder="https://example.com/opportunities" />
          <div className="field-row">
            <FieldSelect label="Status" value={form.status} values={["active", "inactive"]} onChange={(value) => update("status", value)} />
            <div className="field">
              <label>Refresh</label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={form.refresh_enabled}
                  onChange={(event) => update("refresh_enabled", event.target.checked)}
                />
                <span>Enable scheduled ingestion</span>
              </label>
            </div>
          </div>
          <FieldTextarea label="Notes" value={form.notes} onChange={(value) => update("notes", value)} />
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary" disabled={saving} type="submit">
            <CheckCircle2 size={15} />
            Save
          </button>
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function PresetTagPicker({
  label,
  selectedText,
  values,
  onToggle,
}: {
  label: string;
  selectedText: string;
  values: string[];
  onToggle: (value: string) => void;
}) {
  const selected = new Set(listItems(selectedText).map((item) => item.toLowerCase()));
  return (
    <div className="field preset-tag-field">
      <label>{label}</label>
      <div className="preset-tag-grid">
        {values.map((value) => {
          const active = selected.has(value.toLowerCase());
          return (
            <button
              className={`preset-tag ${active ? "active" : ""}`}
              key={value}
              type="button"
              onClick={() => onToggle(value)}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmailModal({
  client,
  match,
  onClose,
  onSent,
}: {
  client: ClientRecord;
  match: MatchRecord;
  onClose: () => void;
  onSent: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const defaultSubject = `${match.event.category} opportunity: ${match.event.title}`;
  const defaultBody = [
    `Hi ${client.name},`,
    "",
    `We found a ${match.event.category.toLowerCase()} opportunity that looks relevant to your EB1A profile: ${match.event.title}.`,
    "",
    `Why it fits: ${match.breakdown.missingCriteria.join(", ") || "it supports your current profile priorities"}.`,
    `Deadline: ${deadlineText(match.event.deadline)}.`,
    match.event.apply_url ? `Apply link: ${match.event.apply_url}` : "",
    "",
    "Best,",
    "SETU Discover team",
  ].filter(Boolean).join("\n");

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  return (
    <div className="modal-back">
      <form
        className="modal"
        onSubmit={async (event) => {
          event.preventDefault();
          setSending(true);
          await onSent({
            clientId: client.id,
            eventId: match.event.id,
            toEmail: client.email,
            subject,
            body,
            score: match.score,
            breakdown: match.breakdown,
          });
          setSending(false);
        }}
      >
        <div className="modal-head">
          <div>
            <div className="card-label">Email out</div>
            <h3>{client.name}</h3>
            <div className="sub">{client.email}</div>
            <EngagementBadge client={client} showAsOf />
          </div>
          <button className="x" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="detail-banner" style={{ marginBottom: 14 }}>
            <div>
              <div className="card-label">Match</div>
              <div className="cust">{match.event.title}</div>
              <div className="sub">Score {match.score} · {match.event.category} · {money(match.event)}</div>
            </div>
            {match.event.apply_url ? (
              <a className="btn" href={match.event.apply_url} target="_blank" rel="noreferrer">
                <LinkIcon size={15} />
                Open
              </a>
            ) : null}
          </div>
          <FieldInput label="Subject" value={subject} onChange={setSubject} />
          <FieldTextarea label="Body" value={body} onChange={setBody} />
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary" disabled={sending} type="submit">
            <Send size={15} />
            Send
          </button>
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function DeepLinkRow({
  applyUrl,
  sourceUrl,
  prominent,
}: {
  applyUrl?: string;
  sourceUrl?: string;
  prominent?: boolean;
}) {
  const sourceHref = sourceUrl?.trim();
  const applyHref = applyUrl?.trim();

  if (!sourceHref && !applyHref) return null;

  return (
    <div className={`deep-link-row ${prominent ? "prominent" : ""}`}>
      {sourceHref ? (
        <a className="btn btn-link" href={sourceHref} target="_blank" rel="noreferrer">
          <LinkIcon size={15} />
          Source
        </a>
      ) : null}
      {applyHref ? (
        <a className="btn btn-link" href={applyHref} target="_blank" rel="noreferrer">
          <ArrowUpRight size={15} />
          Apply
        </a>
      ) : null}
    </div>
  );
}

function SummaryActionRow({
  applyUrl,
  onDetails,
}: {
  applyUrl?: string;
  onDetails: () => void;
}) {
  const applyHref = applyUrl?.trim();

  return (
    <div className="deep-link-row">
      <button className="btn btn-link" type="button" onClick={onDetails}>
        <FileText size={15} />
        Details
      </button>
      {applyHref ? (
        <a className="btn btn-link" href={applyHref} target="_blank" rel="noreferrer">
          <ArrowUpRight size={15} />
          Apply
        </a>
      ) : null}
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function topbarTitle(tab: TabId) {
  return {
    dashboard: PORTAL_BRAND,
    inventory: "Inventory table",
    clients: "Client profile database",
    matches: "Match & send",
    emails: "Email history",
    sources: "Source registry",
    ingestion: "Daily refresh",
    review: "Review queue",
  }[tab];
}

function topbarSubtitle(tab: TabId) {
  return {
    dashboard: "Active opportunity inventory, category coverage, client demand, and refresh health.",
    inventory: "All eight categories, fee visibility, tiers, status, and links.",
    clients: "Target criteria, covered criteria, keywords, field, and location.",
    matches: "Criterion gap, credibility, keyword fit, semantic fit, actionability, and location.",
    emails: "Outbound attempts logged against the client record.",
    sources: "Canonical domains, seed pages, refresh status, and source-page change tracking.",
    ingestion: "Guarded fetch, change detection, structured extraction, review flags, and match refresh.",
    review: "Low-confidence extractions and pay-to-play flags ready for team disposition.",
  }[tab];
}
