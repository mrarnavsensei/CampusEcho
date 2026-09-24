import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

export interface AuditParams {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string;
  campusId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAdminAction(params: AuditParams): Promise<void> {
  await adminAuditStatement(params);
}

// Include this statement in the same D1 batch as the administrative mutation.
// A failed audit write then rolls back the operation instead of losing evidence.
export function adminAuditStatement(params: AuditParams) {
    const { adminId, action, targetType, targetId, campusId, metadata = {} } = params;
    return getDb().insert(auditLogs).values({
      id: crypto.randomUUID(),
      campusId: campusId ?? null,
      actorId: null, // admin actions use admin_actor_id in metadata
      action,
      targetType,
      targetId: targetId ?? null,
      metadata: JSON.stringify({ ...metadata, admin_actor_id: adminId }),
      createdAt: new Date(),
    });
}
