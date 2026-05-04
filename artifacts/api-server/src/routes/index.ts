import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import groupsRouter from "./groups";
import messagesRouter from "./messages";
import membersRouter from "./members";
import summariesRouter from "./summaries";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(groupsRouter);
router.use(messagesRouter);
router.use(membersRouter);
router.use(summariesRouter);
router.use(dashboardRouter);

export default router;
