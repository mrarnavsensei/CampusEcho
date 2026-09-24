"use client";
import { useState } from "react";
import { useResource } from "@/hooks/use-resource";
import { api, jsonBody } from "@/lib/client-api";
import { dateLabel, Empty, Failure, Loading, Modal } from "./shared";
type Notification = { id: string; body: string; createdAt: string; readAt: string | null };
export function Notifications({ onClose }: { onClose: () => void }) {
  const resource = useResource<{ items: Notification[]; nextCursor: string | null }>("/api/notifications"), [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [extra, setExtra] = useState<Notification[]>([]), [cursor, setCursor] = useState<string | null | undefined>();
  const next = cursor === undefined ? resource.data?.nextCursor : cursor;
  return <Modal title="Your notifications" onClose={onClose}>{resource.loading ? <Loading rows={2} /> : resource.error ? <Failure error={resource.error} retry={resource.refresh} /> : resource.data?.items.length ? <div className="notification-list">{[...resource.data.items, ...extra].map(item => <article className={item.readAt ? "read" : "unread"} key={item.id}><p>{item.body}</p><small>{dateLabel(item.createdAt)}</small>{!item.readAt && <button disabled={busy} onClick={async () => { setBusy(true); try { await api("/api/notifications", { method: "PATCH", body: jsonBody({ ids: [item.id] }) }); setExtra(items => items.map(row => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row)); resource.refresh(); } catch (failure) { setError(failure); } finally { setBusy(false); } }}>Mark read</button>}</article>)}</div> : <Empty title="All quiet for now">Replies and relevant account updates will appear here.</Empty>}{Boolean(error) && <Failure error={error} />}{next && <button className="secondary" disabled={busy} onClick={async () => { setBusy(true); try { const page = await api<{ items: Notification[]; nextCursor: string | null }>(`/api/notifications?cursor=${encodeURIComponent(next)}`); setExtra(items => [...items, ...page.items]); setCursor(page.nextCursor); } catch (failure) { setError(failure); } finally { setBusy(false); } }}>More notifications</button>}</Modal>;
}
