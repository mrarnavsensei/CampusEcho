import { jsonError, jsonOk } from "@/lib/api";
import { requireAdminFromRequest } from "@/lib/admin-auth";
export async function GET(request: Request) { try { return jsonOk(await requireAdminFromRequest(request)); } catch (error) { return jsonError(error); } }
