import { and, count, eq, sql } from "drizzle-orm";
import { db, groupMembersTable, groupSummariesTable, messagesTable, usersTable } from "@workspace/db";

export type Urgency = "safe" | "warning" | "critical" | "expired";

export function computeUrgency(deadline: Date, status: string): Urgency {
  if (status === "EXPIRED" || status === "CLOSED" || status === "ARCHIVED") return "expired";
  const now = new Date();
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft < 0) return "expired";
  if (hoursLeft < 72) return "critical"; // < 3 days
  if (hoursLeft < 168) return "warning"; // < 7 days
  return "safe";
}

export async function enrichGroup(group: {
  id: string;
  name: string;
  purpose: "event" | "project" | "decision" | "brainstorm" | "other";
  createdAt: Date;
  deadline: Date;
  status: "ACTIVE" | "EXPIRED" | "CLOSED" | "ARCHIVED";
  adminId: string;
  parentGroupId: string | null;
}) {
  const [adminUser] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, group.adminId));

  const [memberCountRow] = await db
    .select({ value: count() })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, group.id));

  const [messageCountRow] = await db
    .select({ value: count() })
    .from(messagesTable)
    .where(eq(messagesTable.groupId, group.id));

  const [summaryRow] = await db
    .select({ id: groupSummariesTable.id })
    .from(groupSummariesTable)
    .where(eq(groupSummariesTable.groupId, group.id));

  const [childCountRow] = await db
    .select({ value: count() })
    .from(db
      .select({ id: sql<string>`id` })
      .from(db.$with("child_groups").as(
        db.select().from(db.$count(groupMembersTable))
      ))
      .as("child")
    ).catch(() => [{ value: 0 }]);

  const urgency = computeUrgency(group.deadline, group.status);
  const now = new Date();
  const hoursUntilDeadline = (group.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  return {
    ...group,
    adminName: adminUser?.name ?? "Unknown",
    memberCount: memberCountRow?.value ?? 0,
    messageCount: messageCountRow?.value ?? 0,
    urgency,
    hoursUntilDeadline: hoursUntilDeadline > 0 ? hoursUntilDeadline : null,
    hasSummary: !!summaryRow,
    childGroupCount: 0,
  };
}
