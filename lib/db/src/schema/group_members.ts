import { pgTable, text, timestamp, pgEnum, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const memberRoleEnum = pgEnum("member_role", ["ADMIN", "PARTICIPANT"]);

export const groupMembersTable = pgTable(
  "group_members",
  {
    groupId: text("group_id").notNull(),
    userId: text("user_id").notNull(),
    role: memberRoleEnum("role").notNull().default("PARTICIPANT"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

export const insertGroupMemberSchema = createInsertSchema(groupMembersTable).omit({ joinedAt: true });
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;
export type GroupMember = typeof groupMembersTable.$inferSelect;
