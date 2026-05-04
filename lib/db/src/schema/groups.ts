import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const groupPurposeEnum = pgEnum("group_purpose", [
  "event",
  "project",
  "decision",
  "brainstorm",
  "other",
]);

export const groupStatusEnum = pgEnum("group_status", [
  "ACTIVE",
  "EXPIRED",
  "CLOSED",
  "ARCHIVED",
]);

export const groupsTable = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  purpose: groupPurposeEnum("purpose").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  status: groupStatusEnum("status").notNull().default("ACTIVE"),
  adminId: text("admin_id").notNull(),
  parentGroupId: text("parent_group_id"),
});

export const insertGroupSchema = createInsertSchema(groupsTable).omit({ createdAt: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groupsTable.$inferSelect;
