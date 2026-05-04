import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const groupSummariesTable = pgTable("group_summaries", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().unique(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  keyDecisions: text("key_decisions").array().notNull().default([]),
  actionItems: text("action_items").array().notNull().default([]),
  participantCount: integer("participant_count").notNull().default(0),
  suggestedNextAction: text("suggested_next_action"),
});

export const insertGroupSummarySchema = createInsertSchema(groupSummariesTable).omit({ generatedAt: true });
export type InsertGroupSummary = z.infer<typeof insertGroupSummarySchema>;
export type GroupSummary = typeof groupSummariesTable.$inferSelect;
