import { Router, type IRouter } from "express";
import { eq, lt, desc } from "drizzle-orm";
import { db, messagesTable, usersTable, groupsTable } from "@workspace/db";
import { SendMessageBody, SendMessageParams, ListMessagesQueryParams, ListMessagesParams } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/groups/:groupId/messages", async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = ListMessagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { groupId } = params.data;
  const limit = query.data.limit ?? 50;

  let baseQuery = db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.groupId, groupId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  const msgs = await baseQuery;

  const enriched = await Promise.all(
    msgs.reverse().map(async (msg) => {
      const [user] = await db
        .select({ name: usersTable.name, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, msg.userId));

      return {
        ...msg,
        userName: user?.name ?? "Unknown",
        userAvatarUrl: user?.avatarUrl ?? null,
      };
    })
  );

  res.json(enriched);
});

router.post("/groups/:groupId/messages", async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { groupId } = params.data;

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId));

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  if (group.status !== "ACTIVE") {
    res.status(403).json({ error: "Cannot send messages to a non-active group" });
    return;
  }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [msg] = await db
    .insert(messagesTable)
    .values({
      id: randomUUID(),
      groupId,
      userId: parsed.data.userId,
      content: parsed.data.content,
    })
    .returning();

  const [user] = await db
    .select({ name: usersTable.name, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, msg.userId));

  res.status(201).json({
    ...msg,
    userName: user?.name ?? "Unknown",
    userAvatarUrl: user?.avatarUrl ?? null,
  });
});

export default router;
