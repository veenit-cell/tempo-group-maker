import { Router, type IRouter } from "express";
import { count, eq, gt, and, desc } from "drizzle-orm";
import { db, groupsTable, messagesTable, groupMembersTable, usersTable } from "@workspace/db";
import { computeUrgency } from "../lib/group-helpers";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const [activeRow] = await db
    .select({ value: count() })
    .from(groupsTable)
    .where(eq(groupsTable.status, "ACTIVE"));

  const [expiredRow] = await db
    .select({ value: count() })
    .from(groupsTable)
    .where(eq(groupsTable.status, "EXPIRED"));

  const [closedRow] = await db
    .select({ value: count() })
    .from(groupsTable)
    .where(eq(groupsTable.status, "CLOSED"));

  const [archivedRow] = await db
    .select({ value: count() })
    .from(groupsTable)
    .where(eq(groupsTable.status, "ARCHIVED"));

  const [totalMsgRow] = await db.select({ value: count() }).from(messagesTable);

  const purposeRows = await db
    .select({ purpose: groupsTable.purpose, cnt: count() })
    .from(groupsTable)
    .groupBy(groupsTable.purpose);

  res.json({
    activeGroups: activeRow?.value ?? 0,
    expiredGroups: expiredRow?.value ?? 0,
    closedGroups: closedRow?.value ?? 0,
    archivedGroups: archivedRow?.value ?? 0,
    totalMessages: totalMsgRow?.value ?? 0,
    groupsByPurpose: purposeRows.map((r) => ({ purpose: r.purpose, count: r.cnt })),
  });
});

router.get("/dashboard/expiring-soon", async (req, res): Promise<void> => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const groups = await db
    .select()
    .from(groupsTable)
    .where(
      and(
        eq(groupsTable.status, "ACTIVE"),
        gt(groupsTable.deadline, now),
      )
    )
    .orderBy(groupsTable.deadline)
    .limit(10);

  const expiring = groups.filter((g) => g.deadline <= sevenDaysFromNow);

  const enriched = await Promise.all(
    expiring.map(async (group) => {
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

      const urgency = computeUrgency(group.deadline, group.status);
      const hoursUntilDeadline =
        (group.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      return {
        ...group,
        adminName: adminUser?.name ?? "Unknown",
        memberCount: memberCountRow?.value ?? 0,
        messageCount: messageCountRow?.value ?? 0,
        urgency,
        hoursUntilDeadline,
        hasSummary: false,
        childGroupCount: 0,
      };
    })
  );

  res.json(enriched);
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const groups = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.status, "ACTIVE"))
    .limit(20);

  const now = new Date();
  const activity = await Promise.all(
    groups.map(async (group) => {
      const [lastMsg] = await db
        .select({
          content: messagesTable.content,
          createdAt: messagesTable.createdAt,
          userId: messagesTable.userId,
        })
        .from(messagesTable)
        .where(eq(messagesTable.groupId, group.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      let lastMessageUser: string | null = null;
      if (lastMsg) {
        const [u] = await db
          .select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, lastMsg.userId));
        lastMessageUser = u?.name ?? null;
      }

      const urgency = computeUrgency(group.deadline, group.status);

      return {
        groupId: group.id,
        groupName: group.name,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt ?? null,
        lastMessageUser,
        urgency,
      };
    })
  );

  activity.sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) return 0;
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
  });

  res.json(activity.slice(0, 10));
});

export default router;
