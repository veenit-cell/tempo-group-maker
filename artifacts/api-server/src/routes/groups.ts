import { Router, type IRouter } from "express";
import { and, count, eq, inArray } from "drizzle-orm";
import {
  db,
  groupMembersTable,
  groupSummariesTable,
  groupsTable,
  messagesTable,
  usersTable,
} from "@workspace/db";
import {
  BranchGroupBody,
  BranchGroupParams,
  CloseGroupParams,
  CreateGroupBody,
  ExtendGroupBody,
  ExtendGroupParams,
  GetGroupParams,
  ListGroupsQueryParams,
  UpdateGroupBody,
  UpdateGroupParams,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { computeUrgency } from "../lib/group-helpers";

const router: IRouter = Router();

async function buildGroupWithMeta(group: {
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
    .from(groupsTable)
    .where(eq(groupsTable.parentGroupId, group.id));

  const urgency = computeUrgency(group.deadline, group.status);
  const now = new Date();
  const hoursUntilDeadline =
    (group.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  return {
    ...group,
    adminName: adminUser?.name ?? "Unknown",
    memberCount: memberCountRow?.value ?? 0,
    messageCount: messageCountRow?.value ?? 0,
    urgency,
    hoursUntilDeadline: hoursUntilDeadline > 0 ? hoursUntilDeadline : null,
    hasSummary: !!summaryRow,
    childGroupCount: childCountRow?.value ?? 0,
  };
}

router.get("/groups", async (req, res): Promise<void> => {
  const query = ListGroupsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  // Auto-expire groups whose deadline has passed
  await db
    .update(groupsTable)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(groupsTable.status, "ACTIVE"),
        // deadline < now
      )
    );

  let groups;
  if (query.data.status) {
    groups = await db
      .select()
      .from(groupsTable)
      .where(eq(groupsTable.status, query.data.status))
      .orderBy(groupsTable.deadline);
  } else {
    groups = await db.select().from(groupsTable).orderBy(groupsTable.deadline);
  }

  // Auto-expire in memory
  const now = new Date();
  const enriched = await Promise.all(
    groups.map(async (g) => {
      const effective = {
        ...g,
        status:
          g.status === "ACTIVE" && g.deadline < now ? ("EXPIRED" as const) : g.status,
      };
      return buildGroupWithMeta(effective);
    })
  );

  res.json(enriched);
});

router.post("/groups", async (req, res): Promise<void> => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Use first user as default admin
  const [firstUser] = await db.select().from(usersTable).limit(1);
  if (!firstUser) {
    res.status(400).json({ error: "No users exist" });
    return;
  }

  const groupId = randomUUID();

  const [group] = await db
    .insert(groupsTable)
    .values({
      id: groupId,
      name: parsed.data.name,
      purpose: parsed.data.purpose,
      deadline: new Date(parsed.data.deadline),
      adminId: firstUser.id,
      parentGroupId: null,
    })
    .returning();

  // Add admin as member
  await db.insert(groupMembersTable).values({
    groupId,
    userId: firstUser.id,
    role: "ADMIN",
  });

  // Add additional members
  if (parsed.data.memberIds && parsed.data.memberIds.length > 0) {
    const otherMembers = parsed.data.memberIds.filter((id) => id !== firstUser.id);
    if (otherMembers.length > 0) {
      await db.insert(groupMembersTable).values(
        otherMembers.map((userId) => ({
          groupId,
          userId,
          role: "PARTICIPANT" as const,
        }))
      );
    }
  }

  const enriched = await buildGroupWithMeta(group);
  res.status(201).json(enriched);
});

router.get("/groups/:groupId", async (req, res): Promise<void> => {
  const params = GetGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, params.data.groupId));

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const now = new Date();
  const effective = {
    ...group,
    status:
      group.status === "ACTIVE" && group.deadline < now
        ? ("EXPIRED" as const)
        : group.status,
  };

  const enriched = await buildGroupWithMeta(effective);
  res.json(enriched);
});

router.patch("/groups/:groupId", async (req, res): Promise<void> => {
  const params = UpdateGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.status) updateData.status = parsed.data.status;

  const [group] = await db
    .update(groupsTable)
    .set(updateData)
    .where(eq(groupsTable.id, params.data.groupId))
    .returning();

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const enriched = await buildGroupWithMeta(group);
  res.json(enriched);
});

router.post("/groups/:groupId/close", async (req, res): Promise<void> => {
  const params = CloseGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [group] = await db
    .update(groupsTable)
    .set({ status: "CLOSED" })
    .where(eq(groupsTable.id, params.data.groupId))
    .returning();

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const enriched = await buildGroupWithMeta(group);
  res.json(enriched);
});

router.post("/groups/:groupId/extend", async (req, res): Promise<void> => {
  const params = ExtendGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ExtendGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [group] = await db
    .update(groupsTable)
    .set({
      deadline: new Date(parsed.data.newDeadline),
      status: "ACTIVE",
    })
    .where(eq(groupsTable.id, params.data.groupId))
    .returning();

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const enriched = await buildGroupWithMeta(group);
  res.json(enriched);
});

router.post("/groups/:groupId/branch", async (req, res): Promise<void> => {
  const params = BranchGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = BranchGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [parentGroup] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, params.data.groupId));

  if (!parentGroup) {
    res.status(404).json({ error: "Parent group not found" });
    return;
  }

  const branchGroups = await Promise.all(
    parsed.data.branches.map(async (branch) => {
      const groupId = randomUUID();
      const deadline = new Date(
        Date.now() + branch.durationDays * 24 * 60 * 60 * 1000
      );

      const [group] = await db
        .insert(groupsTable)
        .values({
          id: groupId,
          name: `${parentGroup.name} — ${branch.topic}`,
          purpose: parentGroup.purpose,
          deadline,
          adminId: parentGroup.adminId,
          parentGroupId: parentGroup.id,
        })
        .returning();

      // Add members
      if (branch.memberIds.length > 0) {
        await db.insert(groupMembersTable).values(
          branch.memberIds.map((userId, i) => ({
            groupId,
            userId,
            role: i === 0 ? ("ADMIN" as const) : ("PARTICIPANT" as const),
          }))
        );
      }

      return buildGroupWithMeta(group);
    })
  );

  // Mark parent as closed
  await db
    .update(groupsTable)
    .set({ status: "CLOSED" })
    .where(eq(groupsTable.id, parentGroup.id));

  res.status(201).json(branchGroups);
});

export default router;
