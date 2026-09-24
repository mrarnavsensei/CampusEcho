"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Search, Send } from "lucide-react";
import { useResource } from "@/hooks/use-resource";
import { api, jsonBody } from "@/lib/client-api";
import type { Page, SocialConversation, SocialMessage } from "@/lib/social-types";
import { Avatar, dateLabel, Empty, Failure, Loading, ReportDialog } from "./shared";
import { PeoplePicker } from "./people";

export function MessagesPanel({ initialConversation, onPerson }: { initialConversation: string | null; onPerson: (id: string) => void }) {
  const resource = useResource<Page<SocialConversation>>("/api/conversations");
  const refresh = resource.refresh;
  const [selected, setSelected] = useState<string | null>(initialConversation), [search, setSearch] = useState(""), [newMessage, setNewMessage] = useState(false), [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [more, setMore] = useState<SocialConversation[]>([]), [cursor, setCursor] = useState<string | null | undefined>();
  useEffect(() => { const interval = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000); return () => clearInterval(interval); }, [refresh]);
  const conversations = [...new Map([...(resource.data?.items ?? []), ...more].map(item => [item.id, item])).values()];
  const listed = conversations.find(item => item.id === selected);
  const selectedResource = useResource<Page<SocialConversation>>(selected && !listed ? `/api/conversations?id=${encodeURIComponent(selected)}` : null);
  const active = listed ?? selectedResource.data?.items[0];
  const next = cursor === undefined ? resource.data?.nextCursor : cursor;
  async function start(userId: string) {
    if (busy) return; setBusy(true); setError(undefined);
    try { const result = await api<{ id: string }>("/api/conversations", { method: "POST", body: jsonBody({ userId }) }); setSelected(result.id); setNewMessage(false); resource.refresh(); }
    catch (failure) { setNewMessage(false); setError(failure); } finally { setBusy(false); }
  }
  return <div className={`messages-shell${selected ? " chat-open" : ""}`}><section className="chat-list"><div className="chat-title"><h2>Messages</h2><button aria-label="New message" onClick={() => setNewMessage(true)}><Plus /></button></div><button className="secondary new-chat-mobile" onClick={() => setNewMessage(true)}>New conversation</button><label className="search"><Search /><input aria-label="Search conversations" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" /></label>
    {resource.loading ? <Loading rows={2} /> : resource.error ? <Failure error={resource.error} retry={resource.refresh} /> : conversations.length ? conversations.filter(item => `${item.other.displayName} ${item.other.handle}`.toLowerCase().includes(search.toLowerCase())).map(item => <button key={item.id} className={`chat-row ${selected === item.id ? "active" : ""}`} onClick={() => setSelected(item.id)}><Avatar label={item.other.displayName} /><span><strong>{item.other.displayName}</strong><small>{item.blocked ? "Conversation unavailable" : item.lastMessage ?? "Say hello"}</small></span>{item.unread > 0 && <em><b>{item.unread}</b></em>}</button>) : <Empty title="Your conversations start here">Choose a student from your campus to say hello.</Empty>}
    {next && <button disabled={busy} className="secondary" onClick={async () => { setBusy(true); try { const page = await api<Page<SocialConversation>>(`/api/conversations?cursor=${encodeURIComponent(next)}`); setMore(items => [...items, ...page.items]); setCursor(page.nextCursor); } catch (failure) { setError(failure); } finally { setBusy(false); } }}>More conversations</button>}{Boolean(error) && <Failure error={error} />}</section>
    {active ? <Conversation key={active.id} conversation={active} onBack={() => setSelected(null)} onRead={resource.refresh} /> : <section className="conversation">{selected && <button className="secondary" onClick={() => setSelected(null)}>Back to conversations</button>}{selectedResource.error ? <Failure error={selectedResource.error} retry={selectedResource.refresh} /> : <Empty title={selected ? selectedResource.loading ? "Loading conversation…" : "Conversation unavailable" : "A conversation, just between you two"}>Messages update every few seconds while this screen is open.</Empty>}</section>}
    <aside className="chat-info">{active ? <><Avatar label={active.other.displayName} size={74} /><h3>{active.other.displayName}</h3><p>@{active.other.handle}</p><button className="secondary" onClick={() => onPerson(active.other.id)}>View profile</button><small>Private to participants. Messages are stored on the service and are not end-to-end encrypted.</small></> : <><h3>A safer inbox</h3><p>You can report individual messages and block accounts from their profile.</p></>}</aside>
    {newMessage && <PeoplePicker onClose={() => setNewMessage(false)} onSelect={id => void start(id)} />}
  </div>;
}
function Conversation({ conversation, onBack, onRead }: { conversation: SocialConversation; onBack: () => void; onRead: () => void }) {
  const resource = useResource<Page<SocialMessage>>(`/api/conversations/${conversation.id}/messages`);
  const refresh = resource.refresh;
  const [body, setBody] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [report, setReport] = useState<string | null>(null), [older, setOlder] = useState<SocialMessage[]>([]), [cursor, setCursor] = useState<string | null | undefined>();
  const pending = useRef<{ body: string; id: string } | null>(null), readBoundary = useRef<string | null>(null);
  const messages = [...new Map([...older, ...(resource.data?.items ?? [])].map(item => [item.id, item])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const newest = messages.at(-1)?.id, next = cursor === undefined ? resource.data?.nextCursor : cursor;
  useEffect(() => { const interval = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 5000); return () => clearInterval(interval); }, [refresh]);
  useEffect(() => {
    if (!newest || newest === readBoundary.current || conversation.blocked) return;
    api(`/api/conversations/${conversation.id}/read`, { method: "PATCH", body: jsonBody({ messageId: newest }) }).then(() => { readBoundary.current = newest; onRead(); }).catch(() => { /* Poll retries unread acknowledgement on the next received boundary. */ });
  }, [newest, conversation.id, conversation.blocked, onRead, resource.data]);
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (busy || !body.trim()) return; setBusy(true); setError(undefined);
    if (pending.current?.body !== body.trim()) pending.current = { body: body.trim(), id: crypto.randomUUID() };
    try { await api(`/api/conversations/${conversation.id}/messages`, { method: "POST", body: jsonBody({ body: pending.current.body, clientId: pending.current.id }) }); pending.current = null; setBody(""); resource.refresh(); onRead(); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  return <section className="conversation"><header><button className="conversation-back" aria-label="Back to conversations" onClick={onBack}><ArrowLeft /></button><Avatar label={conversation.other.displayName} /><div><strong>{conversation.other.displayName}</strong><small>{conversation.blocked ? "This conversation is restricted" : "Updates every 5 seconds"}</small></div></header><div className="message-flow">
    {next && <button className="secondary" disabled={busy} onClick={async () => { setBusy(true); try { const page = await api<Page<SocialMessage>>(`/api/conversations/${conversation.id}/messages?cursor=${encodeURIComponent(next)}`); setOlder(items => [...items, ...page.items]); setCursor(page.nextCursor); } catch (failure) { setError(failure); } finally { setBusy(false); } }}>Load older messages</button>}
    {resource.loading ? <Loading rows={2} /> : resource.error ? <Failure error={resource.error} retry={resource.refresh} /> : !messages.length ? <Empty title="Say hello">Only you and this student can access this conversation.</Empty> : messages.map(message => <div key={message.id} className={`bubble ${message.isOwn ? "mine" : ""}`}><span>{message.deleted ? "Message deleted" : message.body}</span><small>{dateLabel(message.createdAt)}{message.isOwn ? message.read ? " · Read" : " · Sent" : ""}</small>{!message.deleted && <div className="bubble-actions">{message.isOwn ? <button disabled={busy} onClick={async () => { if (!confirm("Delete this message for both participants?")) return; setBusy(true); try { await api(`/api/messages/${message.id}`, { method: "DELETE" }); setOlder(items => items.filter(item => item.id !== message.id)); resource.refresh(); } catch (failure) { setError(failure); } finally { setBusy(false); } }}>Delete</button> : <button onClick={() => setReport(message.id)}>Report</button>}</div>}</div>)}
    {Boolean(error) && <Failure error={error} />}</div><form className="message-box" onSubmit={send}><input aria-label="Message" maxLength={2000} disabled={conversation.blocked} value={body} onChange={e => setBody(e.target.value)} placeholder="Message privately…" /><button className="send" type="submit" aria-label="Send message" disabled={busy || !body.trim() || conversation.blocked}><Send /></button></form>{report && <ReportDialog targetType="message" targetId={report} onClose={() => setReport(null)} />}</section>;
}
