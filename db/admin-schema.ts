import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { adminAccounts, reports } from "./schema";

export const reportReviews = sqliteTable("report_reviews", {
  reportId: text("report_id").primaryKey().references(() => reports.id, { onDelete: "cascade" }),
  assignedAdminId: text("assigned_admin_id").references(() => adminAccounts.id),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
