import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { moderationDecisions, posts, polls, pollOptions } from "@/db/schema";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { moderateText } from "@/lib/moderation";
import { mutationUser, pagination, page, readPosts, textInput } from "@/lib/social";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const { params, limit, cursor } = pagination(request);
    const filters = [sql`1=1`];
    if (cursor) filters.push(sql`(p.created_at < ${cursor.time} OR (p.created_at=${cursor.time} AND p.id<${cursor.id}))`);
    if (params.get("filter") === "saved") filters.push(sql`EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id=p.id AND b.user_id=${user.id})`);
    if (params.get("filter") === "mine") filters.push(sql`p.author_id=${user.id}`);
    if (params.get("filter") === "following") filters.push(sql`p.visibility='profile' AND EXISTS(SELECT 1 FROM follows f WHERE f.followed_id=p.author_id AND f.follower_id=${user.id})`);
    if (params.get("author")) filters.push(sql`p.visibility='profile' AND p.author_id=${params.get("author")}`);
    if (params.get("q")) filters.push(sql`instr(lower(p.body),${params.get("q")!.toLowerCase().slice(0, 100)})>0`);
    const result = page(await readPosts(user, sql.join(filters, sql` AND `), limit + 1), limit);
    const items = result.rows.map(({ created_at, ...item }) => { void created_at; return item; });
    return jsonOk({ items, nextCursor: result.nextCursor });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await mutationUser(request, "post", 10);
    const input = await readJson<{ body?: unknown; visibility?: unknown; pollOptions?: unknown }>(request);
    const body = textInput(input.body, "Post", 500);
    if (input.visibility !== undefined && !["anonymous", "profile"].includes(String(input.visibility))) throw new ApiError(422, "invalid_visibility", "Choose anonymous or profile posting.");
    const visibility = input.visibility === "profile" ? "profile" : "anonymous";
    let labels: string[] = [];
    if (input.pollOptions !== undefined) {
      if (!Array.isArray(input.pollOptions) || input.pollOptions.length < 2 || input.pollOptions.length > 4) throw new ApiError(422, "invalid_poll", "A poll needs 2-4 options.");
      labels = input.pollOptions.map(value => textInput(value, "Poll option", 80));
      if (new Set(labels.map(label => label.toLowerCase())).size !== labels.length) throw new ApiError(422, "invalid_poll", "Poll options must be different.");
    }
    const moderation = await moderateText([body, ...labels].join("\n"));
    const db = getDb(), now = new Date(), id = crypto.randomUUID(), pollId = crypto.randomUUID();
    const post = db.insert(posts).values({ id, campusId: user.campusId, authorId: user.id, alias: visibility === "anonymous" ? `Anonymous Echo ${crypto.randomUUID().slice(0, 8)}` : null, visibility, body, kind: labels.length ? "poll" : "text", status: moderation.allowed ? "published" : "pending", moderationStatus: moderation.status, createdAt: now, updatedAt: now });
    const decision = db.insert(moderationDecisions).values({ id: crypto.randomUUID(), campusId: user.campusId, subjectType: "post", subjectId: id, provider: moderation.provider, outcome: moderation.status, categories: JSON.stringify(moderation.categories), reason: moderation.reason, createdAt: now });
    if (labels.length) await db.batch([post, decision, db.insert(polls).values({ id: pollId, postId: id, createdAt: now }), db.insert(pollOptions).values(labels.map((label, position) => ({ id: crypto.randomUUID(), pollId, label, position })))]);
    else await db.batch([post, decision]);
    return jsonOk({ id, status: moderation.allowed ? "published" : "pending", message: moderation.allowed ? "Post published." : "Your post is awaiting moderation review." }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
