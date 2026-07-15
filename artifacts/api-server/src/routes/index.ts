import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import settingsRouter from "./settings";
import activityRouter from "./activity";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(settingsRouter);
router.use(activityRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(projectsRouter);
router.use(tasksRouter);

export default router;
