import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { execute, mutationUser, one, readPosts, visiblePost, textInput } from "@/lib/social";
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await mutationUser(request, "vote"), { id } = await params;
    await visiblePost(user, id);
    const input = await readJson<{ optionId?: unknown }>(request), optionId = textInput(input.optionId, "Poll option", 100);
    const poll = await one<{ id: string; closes_at: number | null }>(sql`SELECT p.id,p.closes_at FROM polls p JOIN poll_options o ON o.poll_id=p.id WHERE p.post_id=${id} AND o.id=${optionId}`);
    if (!poll) throw new ApiError(404, "not_found", "Poll option not found.");
    if (poll.closes_at !== null && poll.closes_at <= Date.now()) throw new ApiError(409, "poll_closed", "This poll has closed.");
    await execute(sql`INSERT OR IGNORE INTO poll_votes(poll_id,option_id,user_id,created_at) SELECT ${poll.id},${optionId},${user.id},${Date.now()} WHERE EXISTS(SELECT 1 FROM polls WHERE id=${poll.id} AND (closes_at IS NULL OR closes_at>${Date.now()}))`);
    const [post] = await readPosts(user, sql`p.id=${id}`, 1);
    return jsonOk({ poll: post.poll });
  } catch (error) { return jsonError(error); }
}
