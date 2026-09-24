"use client";
import { useState } from "react";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send, ShieldCheck, Vote } from "lucide-react";
import { api, errorMessage, jsonBody } from "@/lib/client-api";
import { useResource } from "@/hooks/use-resource";
import type { Page, SocialComment, SocialPost } from "@/lib/social-types";
import { Avatar, dateLabel, Empty, Failure, Loading, Modal, ReportDialog } from "./shared";

export function Composer({ anonymousDefault = true, onClose, onPublished }: { anonymousDefault?: boolean; onClose: () => void; onPublished: (message: string) => void }) {
  const [body, setBody] = useState(""), [anonymous, setAnonymous] = useState(anonymousDefault), [poll, setPoll] = useState(false), [options, setOptions] = useState(["", ""]), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(undefined);
    try { const result = await api<{ message: string }>("/api/posts", { method: "POST", body: jsonBody({ body, visibility: anonymous ? "anonymous" : "profile", ...(poll ? { pollOptions: options } : {}) }) }); onPublished(result.message); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  return <Modal title="Share an echo" onClose={onClose} busy={busy}><form className="echo-form" onSubmit={submit}>
    <label className="sr-only" htmlFor="post-body">Your post</label><textarea id="post-body" autoFocus required maxLength={500} value={body} onChange={e => setBody(e.target.value)} placeholder="What’s happening on campus?" />
    <div className="echo-between"><label className="check-label"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />Post anonymously</label><span className="muted">{body.length}/500</span></div>
    <div className="identity-note"><ShieldCheck /><span><strong>{anonymous ? "A fresh alias, just for this post" : "Your profile will appear on this post"}</strong><small>Visible inside your college, subject to moderation.</small></span></div>
    <label className="check-label"><input type="checkbox" checked={poll} onChange={e => setPoll(e.target.checked)} /><Vote size={16} /> Add a poll</label>
    {poll && <div className="poll-editor">{options.map((option, index) => <label key={index}>Option {index + 1}<input required maxLength={80} value={option} onChange={e => setOptions(previous => previous.map((item, i) => i === index ? e.target.value : item))} /></label>)}<div className="echo-inline">{options.length < 4 && <button type="button" className="secondary" onClick={() => setOptions([...options, ""])}>Add option</button>}{options.length > 2 && <button type="button" className="secondary" onClick={() => setOptions(options.slice(0, -1))}>Remove last option</button>}</div></div>}
    {Boolean(error) && <Failure error={error} />}<button className="primary" disabled={busy || !body.trim()}>{busy ? "Publishing…" : anonymous ? "Post anonymously" : "Post with profile"}</button>
  </form></Modal>;
}

export function FeedPanel({ search, revision = 0, onPerson }: { search: string; revision?: number; onPerson: (id: string) => void }) {
  const [filter, setFilter] = useState("all");
  return <><div className="section-row"><h2>Campus pulse</h2><div className="chips" aria-label="Feed filters">{[["all", "Latest"], ["following", "Following"], ["saved", "Saved"], ["mine", "My posts"]].map(([value, label]) => <button aria-pressed={filter === value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div></div>{filter === "following" && <p className="muted">Identified posts from people you follow. Anonymous posts stay in the campus feed.</p>}<FeedList key={`${filter}:${search}:${revision}`} query={`filter=${filter}&q=${encodeURIComponent(search)}`} onPerson={onPerson} /></>;
}
export function FeedList({ query, onPerson }: { query: string; onPerson: (id: string) => void }) {
  const resource = useResource<Page<SocialPost>>(`/api/posts?${query}`);
  const [extra, setExtra] = useState<SocialPost[]>([]), [cursor, setCursor] = useState<string | null | undefined>(), [paging, setPaging] = useState(false), [pageError, setPageError] = useState<unknown>();
  const next = cursor === undefined ? resource.data?.nextCursor : cursor;
  function refresh() { setExtra([]); setCursor(undefined); resource.refresh(); }
  async function loadMore() {
    if (!next || paging) return; setPaging(true); setPageError(undefined);
    try { const page = await api<Page<SocialPost>>(`/api/posts?${query}&cursor=${encodeURIComponent(next)}`); setExtra(items => [...items, ...page.items]); setCursor(page.nextCursor); }
    catch (error) { setPageError(error); } finally { setPaging(false); }
  }
  if (resource.loading) return <Loading />;
  if (resource.error) return <Failure error={resource.error} retry={refresh} />;
  const posts = [...new Map([...(resource.data?.items ?? []), ...extra].map(item => [item.id, item])).values()];
  return <div className="post-list">{posts.length ? posts.map(post => <PostCard key={post.id} post={post} onChange={refresh} onPerson={onPerson} />) : <Empty title="No echoes here yet">Start a conversation, or try another filter.</Empty>}{Boolean(pageError) && <Failure error={pageError} />}{next && <button className="secondary load-more" onClick={loadMore} disabled={paging}>{paging ? "Loading…" : "Load more echoes"}</button>}</div>;
}
export function SharedPost({ id, onPerson, onBack }: { id: string; onPerson: (id: string) => void; onBack: () => void }) {
  const resource = useResource<SocialPost>(`/api/posts/${encodeURIComponent(id)}`);
  return <><button className="secondary" onClick={onBack}>Back to campus feed</button>{resource.loading ? <Loading /> : resource.error ? <Failure error={resource.error} retry={resource.refresh} /> : resource.data ? <PostCard post={resource.data} onChange={resource.refresh} onPerson={onPerson} /> : null}</>;
}
function PostCard({ post, onChange, onPerson }: { post: SocialPost; onChange: () => void; onPerson: (id: string) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [comments, setComments] = useState(false), [report, setReport] = useState(false), [editing, setEditing] = useState(false), [text, setText] = useState(post.body), [copied, setCopied] = useState(false);
  async function mutate(path: string, method: string, body?: unknown) {
    if (busy) return; setBusy(true); setError(undefined);
    try { await api(path, { method, ...(body ? { body: jsonBody(body) } : {}) }); setEditing(false); onChange(); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  async function share() {
    const url = `${location.origin}/?post=${encodeURIComponent(post.id)}`;
    try { if (navigator.share) await navigator.share({ title: "CampusCrate Echo", url }); else { await navigator.clipboard.writeText(url); setCopied(true); } }
    catch (failure) { if (!(failure instanceof DOMException && failure.name === "AbortError")) setError(failure); }
  }
  const displayName = post.alias ?? post.author?.displayName ?? "Student";
  return <article className="post-card"><div className="post-head"><Avatar label={post.visibility === "anonymous" ? "?" : displayName} /><div>{post.author ? <button className="person-link" onClick={() => onPerson(post.author!.id)}>{displayName}</button> : <strong>{displayName}</strong>}<span><ShieldCheck /> {post.visibility === "anonymous" ? "Anonymous" : `@${post.author?.handle}`} · {dateLabel(post.createdAt)}{post.editedAt ? " · edited" : ""}</span></div><details className="echo-menu"><summary aria-label="Post options"><MoreHorizontal /></summary><div>{post.isOwn && <><button onClick={() => setEditing(true)}>Edit post</button><button disabled={busy} onClick={() => { if (confirm("Delete this post? It will disappear from the feed.")) void mutate(`/api/posts/${post.id}`, "DELETE"); }}>Delete post</button></>}<button onClick={() => setReport(true)}>Report post</button></div></details></div>
    <p className="post-body">{post.body}</p>
    {post.poll && <div className="poll">{post.poll.options.map(option => { const total = post.poll!.options.reduce((sum, item) => sum + item.votes, 0), percentage = total ? Math.round(option.votes / total * 100) : 0; return <button key={option.id} disabled={busy || !!post.poll!.votedOptionId} className={post.poll!.votedOptionId === option.id ? "voted" : ""} onClick={() => mutate(`/api/posts/${post.id}/vote`, "PUT", { optionId: option.id })}><span style={{ width: `${percentage}%` }} /><b>{option.label}</b><em>{percentage}%</em></button>; })}<small>{post.poll.options.reduce((sum, item) => sum + item.votes, 0)} votes{post.poll.votedOptionId ? " · Vote recorded" : ""}</small></div>}
    <div className="post-actions"><button aria-label={post.liked ? "Unlike post" : "Like post"} aria-pressed={post.liked} disabled={busy} className={post.liked ? "liked" : ""} onClick={() => mutate(`/api/posts/${post.id}/like`, post.liked ? "DELETE" : "PUT")}><Heart /> {post.likes}</button><button onClick={() => setComments(!comments)} aria-expanded={comments}><MessageCircle /> {post.comments}</button><button onClick={share}><Send /> {copied ? "Copied" : "Share"}</button><button aria-label={post.saved ? "Unsave post" : "Save post"} aria-pressed={post.saved} disabled={busy} className={`bookmark ${post.saved ? "liked" : ""}`} onClick={() => mutate(`/api/posts/${post.id}/bookmark`, post.saved ? "DELETE" : "PUT")}><Bookmark /></button></div>
    {Boolean(error) && <Failure error={error} />}{comments && <Comments postId={post.id} onChange={onChange} />}{report && <ReportDialog targetType="post" targetId={post.id} onClose={() => setReport(false)} />}
    {editing && <Modal title="Edit your echo" busy={busy} onClose={() => setEditing(false)}><form className="echo-form" onSubmit={e => { e.preventDefault(); void mutate(`/api/posts/${post.id}`, "PATCH", { body: text }); }}><textarea aria-label="Post body" value={text} onChange={e => setText(e.target.value)} required maxLength={500} /><p className="muted">Your original posting identity stays the same.</p>{Boolean(error) && <Failure error={error} />}<button className="primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></form></Modal>}
  </article>;
}
function Comments({ postId, onChange }: { postId: string; onChange: () => void }) {
  const resource = useResource<Page<SocialComment>>(`/api/posts/${postId}/comments`);
  const [body, setBody] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [reportId, setReportId] = useState<string | null>(null), [edit, setEdit] = useState<SocialComment | null>(null), [more, setMore] = useState<SocialComment[]>([]), [cursor, setCursor] = useState<string | null | undefined>();
  const next = cursor === undefined ? resource.data?.nextCursor : cursor;
  async function action(path: string, method: string, data?: unknown) {
    if (busy) return; setBusy(true); setError(undefined);
    try { await api(path, { method, ...(data ? { body: jsonBody(data) } : {}) }); setBody(""); setEdit(null); setMore([]); setCursor(undefined); resource.refresh(); onChange(); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  async function load() {
    if (!next || busy) return; setBusy(true);
    try { const page = await api<Page<SocialComment>>(`/api/posts/${postId}/comments?cursor=${encodeURIComponent(next)}`); setMore(items => [...items, ...page.items]); setCursor(page.nextCursor); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  return <section className="echo-comments"><h3>Replies</h3>{resource.loading ? <Loading rows={1} /> : resource.error ? <Failure error={resource.error} retry={resource.refresh} /> : [...(resource.data?.items ?? []), ...more].map(comment => <article key={comment.id} className="echo-comment"><div><strong>{comment.alias}</strong><small>{dateLabel(comment.createdAt)}</small></div><p>{comment.body}</p><div className="echo-inline">{comment.isOwn && <><button onClick={() => { setEdit(comment); setBody(comment.body); }}>Edit</button><button disabled={busy} onClick={() => { if (confirm("Delete this reply?")) void action(`/api/comments/${comment.id}`, "DELETE"); }}>Delete</button></>}<button onClick={() => setReportId(comment.id)}>Report</button></div></article>)}{next && <button className="secondary" disabled={busy} onClick={load}>More replies</button>}
    <form onSubmit={event => { event.preventDefault(); void action(edit ? `/api/comments/${edit.id}` : `/api/posts/${postId}/comments`, edit ? "PATCH" : "POST", { body }); }} className="echo-form"><label>{edit ? "Edit reply" : "Reply anonymously"}<input value={body} onChange={e => setBody(e.target.value)} maxLength={1000} required placeholder="Add to the conversation…" /></label><div className="echo-inline"><button className="primary" disabled={busy || !body.trim()}>{busy ? "Saving…" : edit ? "Save reply" : "Reply"}</button>{edit && <button type="button" className="secondary" onClick={() => { setEdit(null); setBody(""); }}>Cancel edit</button>}</div></form>{Boolean(error) && <Failure error={new Error(errorMessage(error))} />}{reportId && <ReportDialog targetType="comment" targetId={reportId} onClose={() => setReportId(null)} />}
  </section>;
}
