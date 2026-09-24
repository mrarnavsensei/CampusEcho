import { sql } from "drizzle-orm";
import { ApiError, jsonError, jsonOk, readJson, requireApiUser } from "@/lib/api";
import { moderateText } from "@/lib/moderation";
import { execute, mutationUser, one, readProfile, textInput } from "@/lib/social";
export async function GET(request: Request) { try { const user = await requireApiUser(request); return jsonOk(await readProfile(user, user.id)); } catch (error) { return jsonError(error); } }
export async function PATCH(request: Request) {
  try {
    const user = await mutationUser(request, "profile", 10), input = await readJson<{ displayName?: unknown; handle?: unknown; bio?: unknown; isPrivate?: unknown; anonymousByDefault?: unknown }>(request);
    const updates = [];
    if (input.displayName !== undefined) updates.push(sql`display_name=${textInput(input.displayName, "Display name", 60)}`);
    if (input.handle !== undefined) {
      const handle = textInput(input.handle, "Username", 30, 3).toLowerCase();
      if (!/^[a-z0-9_]+$/.test(handle)) throw new ApiError(422, "invalid_handle", "Username may contain letters, numbers, and underscores.");
      if (await one(sql`SELECT user_id FROM profiles WHERE handle=${handle} AND user_id<>${user.id}`)) throw new ApiError(409, "handle_taken", "This username is already in use.");
      updates.push(sql`handle=${handle}`);
    }
    if (input.bio !== undefined) updates.push(sql`bio=${textInput(input.bio, "Bio", 280, 0)}`);
    if (input.isPrivate !== undefined) { if (typeof input.isPrivate !== "boolean") throw new ApiError(422, "invalid_privacy", "Privacy must be true or false."); updates.push(sql`is_private=${input.isPrivate ? 1 : 0}`); }
    if (input.anonymousByDefault !== undefined) { if (typeof input.anonymousByDefault !== "boolean") throw new ApiError(422, "invalid_privacy", "Default posting mode must be true or false."); updates.push(sql`anonymous_by_default=${input.anonymousByDefault ? 1 : 0}`); }
    const profileText = [input.displayName, input.bio].filter(value => typeof value === "string" && value.trim()).join("\n");
    if (profileText) { const moderation = await moderateText(profileText); if (!moderation.allowed) throw new ApiError(422, "moderation_required", moderation.reason); }
    if (updates.length) { updates.push(sql`updated_at=${Date.now()}`); try { await execute(sql`UPDATE profiles SET ${sql.join(updates, sql`, `)} WHERE user_id=${user.id}`); } catch (error) { if (error instanceof Error && /unique/i.test(error.message)) throw new ApiError(409, "handle_taken", "This username is already in use."); throw error; } }
    return jsonOk(await readProfile(user, user.id));
  } catch (error) { return jsonError(error); }
}
