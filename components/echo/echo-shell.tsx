"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import { Bell, CircleUserRound, Home, MessageCircle, Mic2, Plus, Search, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import { useResource } from "@/hooks/use-resource";
import { api, ClientError, jsonBody } from "@/lib/client-api";
import type { SocialProfile } from "@/lib/social-types";
import { AuthPanel } from "./auth-panel";
import { Avatar, Brand, Empty, Failure, Loading } from "./shared";
import { Composer, FeedPanel, SharedPost } from "./feed";
import { PeoplePicker, ProfilePanel } from "./people";
import { MessagesPanel } from "./messages";
import { EventsPanel } from "./events";
import { Notifications } from "./notifications";
import { PolicyLinks } from "./policy-links";

const ChessHub = lazy(() => import("@/components/chess/ChessHub"));
type Tab = "feed" | "spaces" | "messages" | "compete" | "profile";
const nav = [["feed", Home, "Home"], ["spaces", Mic2, "Spaces"], ["messages", MessageCircle, "Messages"], ["compete", Trophy, "Compete"], ["profile", CircleUserRound, "Profile"]] as const;

export default function EchoShell() {
  const viewer = useResource<SocialProfile>("/api/profiles/me");
  const [sharedPost, setSharedPost] = useState<string | null>(null), [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("feed"), [composer, setComposer] = useState(false), [people, setPeople] = useState(false), [notifications, setNotifications] = useState(false), [search, setSearch] = useState(""), [searchOpen, setSearchOpen] = useState(false), [personId, setPersonId] = useState<string | null>(null), [conversation, setConversation] = useState<string | null>(null), [feedRevision, setFeedRevision] = useState(0), [authToken, setAuthToken] = useState(false);
  useEffect(() => {
    if (/^#(verify|reset)=/.test(window.location.hash)) queueMicrotask(() => setAuthToken(true));
    const params = new URLSearchParams(window.location.search);
    if (params.get("post")) queueMicrotask(() => setSharedPost(params.get("post")));
    const desired = params.get("tab");
    if (nav.some(([id]) => id === desired)) queueMicrotask(() => setTab(desired as Tab));
  }, []);
  function chooseTab(next: Tab) { setTab(next); setSharedPost(null); if (next === "profile") setPersonId(null); const url = new URL(window.location.href); url.searchParams.delete("post"); url.searchParams.set("tab", next); window.history.replaceState(null, "", url); }
  function openPerson(id: string) { setPersonId(id); setTab("profile"); setPeople(false); }
  async function openConversation(id: string) { const result = await api<{ id: string }>("/api/conversations", { method: "POST", body: jsonBody({ userId: id }) }); setConversation(result.id); setTab("messages"); }
  const signedIn = () => { setAuthToken(false); viewer.refresh(); };
  if (authToken) return <AuthPanel onSignedIn={signedIn} />;
  if (viewer.loading) return <main className="echo-boot"><Brand /><Loading /><p>Opening your campus…</p></main>;
  if (!viewer.data) {
    const authError = viewer.error instanceof ClientError && [401, 403].includes(viewer.error.status);
    if (authError || !viewer.error) return <AuthPanel initialError={viewer.error instanceof ClientError && viewer.error.status === 403 ? viewer.error : undefined} onSignedIn={signedIn} />;
    return <main className="echo-boot"><Brand /><Failure error={viewer.error} retry={viewer.refresh} /><a href="/admin/login">Administrator sign in</a></main>;
  }
  const profile = viewer.data;
  const pageTitle = ({ feed: `Welcome back, ${profile.displayName.split(" ")[0]}`, spaces: "Live conversations", messages: "Your inbox", compete: "Campus arena", profile: personId && personId !== profile.id ? "Campus profile" : "Your echo" })[tab];
  return <div className="app-shell"><aside className="side-nav"><Brand /><nav aria-label="Main navigation">{nav.map(([id, Icon, label]) => <button key={id} title={label} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => chooseTab(id)}><Icon /><span>{label}</span></button>)}</nav><div className="side-card"><Sparkles /><strong>Keep it kind.</strong><p>Your campus works best when everyone feels welcome.</p><a href="/community">Community information</a></div><button className="profile-mini" onClick={() => chooseTab("profile")}><Avatar label={profile.displayName} /><span><strong>{profile.displayName}</strong><small>@{profile.handle}</small></span></button></aside>
    <main className="main-stage"><header className="topbar"><div><p>{profile.campusName}</p><h1>{pageTitle}</h1></div><div className="top-actions"><button aria-label="Search feed" aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setTab("feed"); }}><Search /></button><button aria-label="Discover students" onClick={() => setPeople(true)}><Users /></button><button aria-label="Notifications" onClick={() => setNotifications(true)}><Bell /></button>{tab === "feed" && <button className="primary compact" onClick={() => setComposer(true)}><Plus /> Post</button>}</div></header>
      {notice && <p className="echo-success" role="status">{notice}</p>}
      {tab === "feed" && <div className="feed-layout"><section>{searchOpen && <label className="search feed-search"><Search /><input autoFocus aria-label="Search campus feed" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search campus conversations…" /></label>}<div className="composer-card"><button className="compose-trigger" onClick={() => setComposer(true)}><Avatar label={profile.anonymousByDefault ? "?" : profile.displayName} /><span>Share something with your campus…</span></button><button aria-label="Create post" onClick={() => setComposer(true)}><Plus /></button></div>{sharedPost ? <SharedPost id={sharedPost} onPerson={openPerson} onBack={() => chooseTab("feed")} /> : <FeedPanel revision={feedRevision} search={search} onPerson={openPerson} />}</section><aside className="right-rail"><div className="rail-card purple"><ShieldCheck /><h3>Your voice belongs here.</h3><p>Choose an alias for a thought, or share it with your profile. Your posting identity is always your choice.</p></div><div className="rail-card"><h3>A familiar face, a new connection</h3><p className="muted">Find students in your college and start a conversation.</p><button className="secondary" onClick={() => setPeople(true)}>Discover students</button></div><div className="rail-card"><h3>Events & friendly competition</h3><p className="muted">Play chess or register for a published campus event.</p><button className="secondary" onClick={() => chooseTab("compete")}>Open campus arena</button></div></aside></div>}
      {tab === "spaces" && <div className="page-grid"><section><div className="hero-card"><div><span className="eyebrow">Voice spaces</span><h2>Speak freely.<br />Listen closely.</h2><p>College conversations, with room for everyone.</p></div><div className="sound-orb" aria-hidden="true"><span /><span /><span /><span /><span /></div></div><Empty title="Voice spaces aren’t available yet">Live audio needs the platform’s voice service to be connected. No microphone access or room connection is active.</Empty></section><aside className="right-rail"><div className="rail-card"><h3>When spaces open</h3>{["Join as a listener", "Ask to speak at your own pace", "Report concerns to the moderation team"].map((text, i) => <div className="rule" key={text}><span>{i + 1}</span><p>{text}</p></div>)}</div></aside></div>}
      {tab === "messages" && <MessagesPanel key={conversation ?? "inbox"} initialConversation={conversation} onPerson={openPerson} />}
      {tab === "compete" && <div className="arena-page"><Suspense fallback={<Loading />}><ChessHub /></Suspense><EventsPanel /></div>}
      {tab === "profile" && <ProfilePanel key={personId ?? "me"} personId={personId} onPerson={openPerson} onMessage={openConversation} onSignedOut={() => { viewer.refresh(); setTab("feed"); setPersonId(null); }} onUpdated={viewer.refresh} />}
      <footer className="echo-footer"><PolicyLinks includeAppeals label="Application legal and support links" /></footer>
    </main><nav className="mobile-nav" aria-label="Mobile navigation">{nav.map(([id, Icon, label]) => <button key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => chooseTab(id)}><Icon /><span>{label}</span></button>)}</nav>
    {composer && <Composer anonymousDefault={profile.anonymousByDefault} onClose={() => setComposer(false)} onPublished={message => { setNotice(message); setSharedPost(null); setComposer(false); setFeedRevision(value => value + 1); setTab("feed"); }} />}{people && <PeoplePicker onSelect={openPerson} onClose={() => setPeople(false)} />}{notifications && <Notifications onClose={() => setNotifications(false)} />}
  </div>;
}
