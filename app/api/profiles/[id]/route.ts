import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { readProfile } from "@/lib/social";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiUser(request), { id } = await params; return jsonOk(await readProfile(user, id)); } catch (error) { return jsonError(error); } }
