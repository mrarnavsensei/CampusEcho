"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, ShieldCheck, X } from "lucide-react";
import { api, errorMessage, jsonBody } from "@/lib/client-api";
import { PolicyLinks } from "./policy-links";

export function Avatar({ label, size = 42 }: { label: string; size?: number }) {
  return <span aria-hidden="true" className="avatar" style={{ width: size, height: size, background: "linear-gradient(145deg,#6d28d9,#171717)" }}>{label.slice(0, 2).toUpperCase()}</span>;
}
export function Brand() { return <div className="brand"><span className="brand-mark"><span /></span><span>campuscrate <b>echo</b></span></div>; }
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) { return <div className="echo-empty"><ShieldCheck /><h3>{title}</h3>{children && <p>{children}</p>}</div>; }
export function Failure({ error, retry }: { error: unknown; retry?: () => void }) { return <div className="echo-error" role="alert"><AlertCircle /><span>{errorMessage(error)}</span>{retry && <button className="secondary" onClick={retry}>Try again</button>}</div>; }
export function Loading({ rows = 3 }: { rows?: number }) { return <div aria-label="Loading" role="status" className="echo-skeletons">{Array.from({ length: rows }, (_, i) => <div className="echo-skeleton" key={i}><span /><span /><span /></div>)}</div>; }
export function When({ loading, error, retry, children }: { loading: boolean; error: unknown; retry: () => void; children: React.ReactNode }) { return loading ? <Loading /> : error ? <Failure error={error} retry={retry} /> : children; }
export function dateLabel(value: string) { return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

export function Modal({ title, children, onClose, busy = false }: { title: string; children: React.ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    // React autofocus can run before a native dialog is opened. Focus after showModal.
    dialog?.querySelector<HTMLElement>("textarea, input:not([type=checkbox]), select")?.focus();
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className="modal echo-dialog" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <header><h2 id={titleId}>{title}</h2><button aria-label="Close dialog" disabled={busy} onClick={onClose}><X /></button></header>{children}
  </dialog>;
}
export function ReportDialog({ targetType, targetId, onClose }: { targetType: string; targetId: string; onClose: () => void }) {
  const [reason, setReason] = useState("harassment"), [details, setDetails] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [done, setDone] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(undefined);
    try { await api("/api/reports", { method: "POST", body: jsonBody({ targetType, targetId, reason, details }) }); setDone(true); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  return <Modal title="Report a concern" onClose={onClose} busy={busy}>{done ? <><Empty title="Report received">The moderation team can now review this case.</Empty><button className="primary" onClick={onClose}>Done</button></> : <form className="echo-form" onSubmit={submit}>
    <p className="muted">Reports are reviewed by authorized moderators. Include only information needed to explain the concern.</p>
    <PolicyLinks includeAppeals label="Report policy links" />
    <label>Reason<select value={reason} onChange={e => setReason(e.target.value)}><option value="harassment">Harassment or abuse</option><option value="spam">Spam</option><option value="privacy">Privacy concern</option><option value="threat">Threat or safety risk</option><option value="other">Other</option></select></label>
    <label>Details<textarea maxLength={2000} value={details} onChange={e => setDetails(e.target.value)} placeholder="What should the reviewer know?" /></label>
    {Boolean(error) && <Failure error={error} />}<button disabled={busy} className="primary">{busy ? "Submitting…" : "Submit report"}</button>
  </form>}</Modal>;
}
