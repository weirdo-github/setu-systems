"use client";

import {
  CheckCircle2,
  Clock3,
  FileText,
  LinkIcon,
  LogOut,
  PencilLine,
  Send,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  MediaAssignment,
  MediaAssignmentDetail,
  MediaUser,
} from "@/lib/types";

type MediaState = {
  user: MediaUser;
  assignments: MediaAssignment[];
};

const MEDIA_API_BASE = "/api/media";
const completedStatuses = new Set(["published", "closed", "incomplete_closed"]);
const openStatuses = ["all", "assigned", "active", "submitted", "published", "closed"] as const;

async function mediaRequestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-setu-media-surface": "writer",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

function mediaStatusTone(status: string) {
  if (status === "published" || status === "closed") return "success";
  if (status === "submitted") return "warn";
  if (status === "incomplete_closed") return "danger";
  if (status === "active") return "ink";
  return "";
}

function dateLabel(value?: string | null) {
  if (!value) return "No date";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function criterionLabel(value?: string | null) {
  if (!value) return "other";
  return value.replaceAll("_", " ");
}

export function SetuMediaPortal() {
  const [state, setState] = useState<MediaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof openStatuses)[number]>("all");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<MediaAssignmentDetail | null>(null);
  const [workType, setWorkType] = useState("note");
  const [workTitle, setWorkTitle] = useState("");
  const [workBody, setWorkBody] = useState("");
  const [workUrl, setWorkUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState<"assignments" | "history">("assignments");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const refreshAssignments = async (nextSelectedId = selectedId) => {
    const payload = await mediaRequestJson<{ assignments: MediaAssignment[] }>(`${MEDIA_API_BASE}/assignments`);
    setState((current) => current ? { ...current, assignments: payload.assignments } : current);
    const nextId = nextSelectedId || payload.assignments[0]?.id || "";
    setSelectedId(nextId);
    return nextId;
  };

  const loadDetail = async (assignmentId: string) => {
    if (!assignmentId) {
      setDetail(null);
      return;
    }
    const payload = await mediaRequestJson<{ assignment: MediaAssignmentDetail }>(
      `${MEDIA_API_BASE}/assignments/${assignmentId}`,
    );
    setDetail(payload.assignment);
  };

  const refresh = async () => {
    try {
      const session = await mediaRequestJson<{ user: MediaUser | null }>(`${MEDIA_API_BASE}/auth/session`);
      if (!session.user) {
        setState(null);
        setDetail(null);
        return;
      }
      const assignments = await mediaRequestJson<{ assignments: MediaAssignment[] }>(`${MEDIA_API_BASE}/assignments`);
      setState({ user: session.user, assignments: assignments.assignments });
      setSelectedId((current) => current || assignments.assignments[0]?.id || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    void loadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    document.title = "setu media";
  }, []);

  const filteredAssignments = useMemo(() => {
    const assignments = state?.assignments ?? [];
    const statusMatches = statusFilter === "all"
      ? assignments
      : assignments.filter((assignment) => assignment.status === statusFilter);
    if (view === "history") {
      return statusMatches.filter((assignment) => completedStatuses.has(assignment.status));
    }
    return statusMatches.filter((assignment) => !completedStatuses.has(assignment.status));
  }, [state?.assignments, statusFilter, view]);

  const activeCount = (state?.assignments ?? []).filter((assignment) => assignment.status === "active").length;
  const submittedCount = (state?.assignments ?? []).filter((assignment) => assignment.status === "submitted").length;
  const completedCount = (state?.assignments ?? []).filter((assignment) => completedStatuses.has(assignment.status)).length;

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoginError("");

    try {
      await mediaRequestJson<{ user: MediaUser }>(`${MEDIA_API_BASE}/auth/login`, {
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
    await mediaRequestJson(`${MEDIA_API_BASE}/auth/logout`, { method: "POST" });
    setState(null);
    setDetail(null);
    showToast("Signed out");
  };

  const runAction = async (path: string, body: Record<string, unknown> = {}, message: string) => {
    if (!detail) return;
    const payload = await mediaRequestJson<{ assignment: MediaAssignmentDetail }>(
      `${MEDIA_API_BASE}/assignments/${detail.id}/${path}`,
      { method: "POST", body: JSON.stringify(body) },
    );
    setDetail(payload.assignment);
    await refreshAssignments(payload.assignment.id);
    showToast(message);
  };

  const saveWork = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    const payload = await mediaRequestJson<{ assignment: MediaAssignmentDetail }>(
      `${MEDIA_API_BASE}/assignments/${detail.id}/work`,
      {
        method: "POST",
        body: JSON.stringify({
          entry_type: workType,
          title: workTitle,
          body: workBody,
          draft_url: workUrl,
        }),
      },
    );
    setDetail(payload.assignment);
    setWorkTitle("");
    setWorkBody("");
    setWorkUrl("");
    await refreshAssignments(payload.assignment.id);
    showToast("Work saved");
  };

  if (loading) {
    return <div className="empty">Loading setu media...</div>;
  }

  if (!state) {
    return (
      <div className="discover-shell media-shell">
        <div className="auth-shell">
          <div className="auth-grid">
            <section className="auth-hero">
              <div className="wordmark discover-login-logo" aria-label="setu media">
                <span className="letters">setu</span>
                <span className="deck" />
                <span className="brand-sub">setu media</span>
              </div>
              <div className="auth-kicker">setu media</div>
              <h1>Media Portal</h1>
              <p className="auth-copy">
                Writer workspace for EB-1A-aligned article assignments, drafts, submissions, and delivery history.
              </p>
              <div className="auth-points">
                <div className="auth-point">
                  <FileText size={18} />
                  See only your assigned clients, article briefs, criteria, and timelines.
                </div>
                <div className="auth-point">
                  <PencilLine size={18} />
                  Save notes, drafts, and submission links without exposing finance data.
                </div>
                <div className="auth-point">
                  <ShieldCheck size={18} />
                  Publication links are controlled by Discover admins.
                </div>
              </div>
            </section>
            <form className="auth-card" onSubmit={login}>
              <div className="card-label">Writer login</div>
              <h2>Sign in</h2>
              <p className="auth-note">Use the local review account for setu media.</p>
              <div className="field">
                <label htmlFor="media-email">Email</label>
                <input id="media-email" name="email" type="email" defaultValue="writer1@media.local" />
              </div>
              <div className="field">
                <label htmlFor="media-password">Password</label>
                <input id="media-password" name="password" type="password" defaultValue="media123" />
              </div>
              {loginError ? <div className="pill danger">{loginError}</div> : null}
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} type="submit">
                <ShieldCheck size={15} />
                Sign in
              </button>
            </form>
          </div>
        </div>
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    );
  }

  return (
    <div className="discover-shell media-shell">
      <div className="app">
        <aside className="sidebar">
          <div className="logo-wrap">
            <button className="wordmark logo-home" onClick={() => setView("assignments")} type="button">
              <span className="letters">setu</span>
              <span className="deck" />
              <span className="brand-sub">setu media</span>
            </button>
          </div>
          <div className="nav-label">Write</div>
          <button className={`nav-item ${view === "assignments" ? "active" : ""}`} onClick={() => setView("assignments")} type="button">
            <FileText size={16} />
            My assignments
            <span className="badge">{state.assignments.length - completedCount}</span>
          </button>
          <button className={`nav-item ${view === "history" ? "active" : ""}`} onClick={() => setView("history")} type="button">
            <Clock3 size={16} />
            History
            <span className="badge">{completedCount}</span>
          </button>
          <div className="sidebar-foot">
            <div className="chip">
              <CheckCircle2 size={14} />
              Writer ready
            </div>
            <div style={{ marginTop: 8 }}>{state.user.display_name}</div>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <h1>setu media</h1>
              <div className="sub">Assignment briefs, draft history, and submission workflow.</div>
            </div>
            <div className="topbar-right">
              <span className="chip">
                <FileText size={14} />
                {state.assignments.length} assignments
              </span>
              <button className="btn btn-ghost" type="button" onClick={logout}>
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>

          <div className="content">
            <div className="metrics">
              <MetricLite label="Active" value={activeCount} detail="In-progress writing" />
              <MetricLite label="Submitted" value={submittedCount} detail="Waiting on Discover admin" />
              <MetricLite label="Completed" value={completedCount} detail="Published or closed" />
              <MetricLite label="Open" value={state.assignments.length - completedCount} detail="Assigned, active, submitted" />
            </div>

            <section className="section">
              <div className="section-head">
                <h2>{view === "history" ? "History" : "My assignments"}</h2>
                <span className="chip">{filteredAssignments.length} visible</span>
              </div>
              <div className="toolbar">
                <select className="search-input category-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as (typeof openStatuses)[number])}>
                  {openStatuses.map((status) => (
                    <option key={status} value={status}>{status === "all" ? "All statuses" : status}</option>
                  ))}
                </select>
              </div>
              <div className="card sheet-wrap">
                <div className="sheet">
                  <div className="trow head media-assignment-grid">
                    <span>Code</span>
                    <span>Client / article</span>
                    <span>Criterion</span>
                    <span>Due</span>
                    <span>Status</span>
                    <span>Open</span>
                  </div>
                  {filteredAssignments.map((assignment) => (
                    <div className="trow media-assignment-grid" key={assignment.id}>
                      <span className="mono">{assignment.code}</span>
                      <div>
                        <button className="name-button" type="button" onClick={() => setSelectedId(assignment.id)}>
                          {assignment.client_display_name}
                        </button>
                        <div className="sub">{assignment.article_title}</div>
                      </div>
                      <span>{criterionLabel(assignment.eb1a_criterion)}</span>
                      <span className="mono">{dateLabel(assignment.due_date)}</span>
                      <span className={`pill ${mediaStatusTone(assignment.status)}`}>{assignment.status}</span>
                      <button className="btn btn-ghost" type="button" onClick={() => setSelectedId(assignment.id)}>
                        <FileText size={15} />
                        Detail
                      </button>
                    </div>
                  ))}
                  {!filteredAssignments.length ? <div className="empty">No assignments in this view.</div> : null}
                </div>
              </div>
            </section>

            {detail ? (
              <section className="section">
                <div className="section-head">
                  <h2>{detail.article_title}</h2>
                  <span className={`pill ${mediaStatusTone(detail.status)}`}>{detail.status}</span>
                </div>
                <div className="detail-banner">
                  <div>
                    <div className="card-label">{detail.code}</div>
                    <h2 style={{ margin: "4px 0 2px", fontSize: 22 }}>{detail.client_display_name}</h2>
                    <div className="sub">{criterionLabel(detail.eb1a_criterion)} · due {dateLabel(detail.due_date)}</div>
                  </div>
                  <div className="banner-actions">
                    {detail.status === "assigned" ? (
                      <button className="btn btn-primary" type="button" onClick={() => void runAction("start", {}, "Assignment started")}>
                        <CheckCircle2 size={15} />
                        Start
                      </button>
                    ) : null}
                    {detail.status === "active" ? (
                      <button className="btn btn-primary" type="button" onClick={() => void runAction("submit", { note: submitNote }, "Assignment submitted")}>
                        <Send size={15} />
                        Submit
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="two-col">
                  <div className="card" style={{ padding: 18 }}>
                    <div className="card-label">Brief</div>
                    <p className="sub" style={{ marginBottom: 0 }}>{detail.brief || "No brief recorded yet."}</p>
                    {detail.status === "active" ? (
                      <div className="field" style={{ marginTop: 14 }}>
                        <label>Submit note</label>
                        <textarea value={submitNote} onChange={(event) => setSubmitNote(event.target.value)} />
                      </div>
                    ) : null}
                  </div>
                  <div className="card" style={{ padding: 18 }}>
                    <div className="card-label">Boundaries</div>
                    <p className="sub" style={{ marginBottom: 0 }}>
                      Writer access is limited to this article assignment: client name, brief, criterion, due date, and work log only.
                    </p>
                  </div>
                </div>

                {detail.status === "active" ? (
                  <form className="card media-work-card" onSubmit={saveWork}>
                    <div className="section-head">
                      <h2>Save work</h2>
                      <span className="chip">Notes, draft text, or external doc link</span>
                    </div>
                    <div className="field-row">
                      <div className="field">
                        <label>Type</label>
                        <select value={workType} onChange={(event) => setWorkType(event.target.value)}>
                          <option value="note">note</option>
                          <option value="draft">draft</option>
                          <option value="submission">submission</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Title</label>
                        <input value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Draft URL</label>
                      <input value={workUrl} onChange={(event) => setWorkUrl(event.target.value)} placeholder="https://docs.example.com/draft" />
                    </div>
                    <div className="field">
                      <label>Body</label>
                      <textarea value={workBody} onChange={(event) => setWorkBody(event.target.value)} />
                    </div>
                    <button className="btn btn-primary" type="submit">
                      <PencilLine size={15} />
                      Save work
                    </button>
                  </form>
                ) : null}

                <WorkLogList detail={detail} />
              </section>
            ) : null}
          </div>
        </main>
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}

function MetricLite({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="metric">
      <div className="label">
        <FileText size={15} />
        {label}
      </div>
      <div className="value">{value}</div>
      <div className="delta">{detail}</div>
    </div>
  );
}

function WorkLogList({ detail }: { detail: MediaAssignmentDetail }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>Work log</h2>
        <span className="chip">{detail.work_log.length} entries</span>
      </div>
      <div className="card sheet-wrap">
        <div className="sheet">
          <div className="trow head media-work-grid">
            <span>Time</span>
            <span>Type</span>
            <span>Title / body</span>
            <span>Draft link</span>
          </div>
          {detail.work_log.map((entry) => (
            <div className="trow media-work-grid" key={entry.id}>
              <span className="mono">{dateLabel(entry.created_at)}</span>
              <span className="pill">{entry.entry_type}</span>
              <div>
                <div className="cust">{entry.title || "Untitled work"}</div>
                <div className="sub">{entry.body || "No body"}</div>
              </div>
              {entry.draft_url ? (
                <a className="inline-link" href={entry.draft_url} target="_blank" rel="noreferrer">
                  <LinkIcon size={13} />
                  Open draft
                </a>
              ) : (
                <span className="sub">No link</span>
              )}
            </div>
          ))}
          {!detail.work_log.length ? <div className="empty">No work saved yet.</div> : null}
        </div>
      </div>
    </section>
  );
}
