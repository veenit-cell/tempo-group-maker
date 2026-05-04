import { Router, type IRouter } from "express";
import { eq, ilike } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, ListUsersQueryParams } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/users", async (req, res): Promise<void> => {
  const query = ListUsersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { search } = query.data;
  let users;
  if (search) {
    users = await db
      .select()
      .from(usersTable)
      .where(ilike(usersTable.name, `%${search}%`))
      .limit(20);
  } else {
    users = await db.select().from(usersTable).limit(50);
  }

  res.json(users);
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({ id: randomUUID(), ...parsed.data })
    .returning();

  res.status(201).json(user);
});

router.get("/users/me", async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    res.status(404).json({ error: "No user found" });
    return;
  }
  res.json(user);
});

export default router;
