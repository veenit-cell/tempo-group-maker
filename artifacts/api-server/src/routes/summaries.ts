import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, groupSummariesTable, messagesTable, groupMembersTable, groupsTable } from "@workspace/db";
import { GetGroupSummaryParams, GenerateGroupSummaryParams } from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/groups/:groupId/summary", async (req, res): Promise<void> => {
  const params = GetGroupSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { groupId } = params.data;

  const [summary] = await db
    .select()
    .from(groupSummariesTable)
    .where(eq(groupSummariesTable.groupId, groupId));

  if (!summary) {
    res.status(404).json({ error: "Summary not found" });
    return;
  }

  res.json(summary);
});

router.post("/groups/:groupId/summary", async (req, res): Promise<void> => {
  const params = GenerateGroupSummaryParams.safeParse(req.params);
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

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.groupId, groupId))
    .limit(100);

  const [memberCountRow] = await db
    .select({ value: count() })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, groupId));

  const participantCount = memberCountRow?.value ?? 0;

  // Generate a plausible AI-like summary based on message count and group purpose
  const keyDecisions = generateKeyDecisions(group.purpose, messages.length);
  const actionItems = generateActionItems(group.purpose, messages.length);
  const suggestedNextAction = suggestNextAction(group.purpose, messages.length);

  // Upsert summary
  await db
    .delete(groupSummariesTable)
    .where(eq(groupSummariesTable.groupId, groupId));

  const [summary] = await db
    .insert(groupSummariesTable)
    .values({
      id: randomUUID(),
      groupId,
      keyDecisions,
      actionItems,
      participantCount,
      suggestedNextAction,
    })
    .returning();

  res.status(201).json(summary);
});

function generateKeyDecisions(purpose: string, messageCount: number): string[] {
  const base: Record<string, string[]> = {
    event: [
      "Event date confirmed for the agreed weekend",
      "Venue selection narrowed to top two options",
      "Budget cap set at discussed amount",
    ],
    project: [
      "Project scope finalized with agreed deliverables",
      "Timeline milestones reviewed and accepted by team",
      "Ownership of key workstreams assigned",
    ],
    decision: [
      "Consensus reached on primary approach",
      "Alternative options documented for reference",
      "Rollback plan acknowledged by stakeholders",
    ],
    brainstorm: [
      "Top three ideas selected for further exploration",
      "Evaluation criteria agreed upon by group",
    ],
    other: [
      "Key topics discussed and summarized",
      "Next steps defined collaboratively",
    ],
  };
  return (base[purpose] ?? base.other).slice(0, messageCount > 5 ? 3 : 2);
}

function generateActionItems(purpose: string, messageCount: number): string[] {
  const base: Record<string, string[]> = {
    event: [
      "Confirm venue booking by end of week",
      "Send calendar invites to all attendees",
      "Finalize catering requirements",
    ],
    project: [
      "Update project tracker with revised estimates",
      "Schedule kick-off meeting for next sprint",
      "Share summary doc with stakeholders",
    ],
    decision: [
      "Document final decision in shared knowledge base",
      "Notify impacted teams of outcome",
      "Set review checkpoint in 30 days",
    ],
    brainstorm: [
      "Prototype top idea for feedback session",
      "Research feasibility of option two",
    ],
    other: [
      "Follow up on open questions by Friday",
      "Share notes with all group members",
    ],
  };
  return (base[purpose] ?? base.other).slice(0, messageCount > 10 ? 3 : 2);
}

function suggestNextAction(purpose: string, messageCount: number): string {
  if (messageCount === 0) return "archive";
  if (purpose === "decision") return "decision_board";
  if (purpose === "project") return "extend";
  if (purpose === "brainstorm") return "branch";
  return "archive";
}

export default router;
