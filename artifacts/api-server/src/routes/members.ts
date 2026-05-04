import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, groupMembersTable, usersTable } from "@workspace/db";
import {
  AddGroupMemberBody,
  AddGroupMemberParams,
  ListGroupMembersParams,
  RemoveGroupMemberParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/groups/:groupId/members", async (req, res): Promise<void> => {
  const params = ListGroupMembersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { groupId } = params.data;

  const members = await db
    .select({
      groupId: groupMembersTable.groupId,
      userId: groupMembersTable.userId,
      role: groupMembersTable.role,
      joinedAt: groupMembersTable.joinedAt,
      user: {
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
      },
    })
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
    .where(eq(groupMembersTable.groupId, groupId));

  res.json(members);
});

router.post("/groups/:groupId/members", async (req, res): Promise<void> => {
  const params = AddGroupMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { groupId } = params.data;

  const parsed = AddGroupMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, parsed.data.userId)
      )
    );

  if (existing) {
    res.status(409).json({ error: "User is already a member" });
    return;
  }

  const [member] = await db
    .insert(groupMembersTable)
    .values({
      groupId,
      userId: parsed.data.userId,
      role: parsed.data.role ?? "PARTICIPANT",
    })
    .returning();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, member.userId));

  res.status(201).json({ ...member, user });
});

router.delete("/groups/:groupId/members/:userId", async (req, res): Promise<void> => {
  const params = RemoveGroupMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { groupId, userId } = params.data;

  await db
    .delete(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, groupId),
        eq(groupMembersTable.userId, userId)
      )
    );

  res.sendStatus(204);
});

export default router;
