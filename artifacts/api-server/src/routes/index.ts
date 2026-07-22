import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import settingsRouter from "./settings";
import activityRouter from "./activity";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import diagnosticsRouter from "./diagnostics";
import growthAssessmentsRouter from "./growth-assessments";
import solutionRecommendationsRouter from "./solution-recommendations";
import growthBlueprintsRouter from "./growth-blueprints";
import blueprintSectionsRouter from "./blueprint-sections";
import blueprintInitiativesRouter from "./blueprint-initiatives";
import blueprintExportsRouter from "./blueprint-exports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(settingsRouter);
router.use(activityRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(diagnosticsRouter);
router.use(growthAssessmentsRouter);
router.use(solutionRecommendationsRouter);
router.use(growthBlueprintsRouter);
router.use(blueprintSectionsRouter);
router.use(blueprintInitiativesRouter);
router.use(blueprintExportsRouter);

export default router;
