import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import playersRouter from "./players";
import gameStateRouter from "./game-state";
import qualityCodesRouter from "./quality-codes";
import photoSubmissionsRouter from "./photo-submissions";
import completionLogRouter from "./completion-log";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tasksRouter);
router.use(playersRouter);
router.use(gameStateRouter);
router.use(qualityCodesRouter);
router.use(photoSubmissionsRouter);
router.use(completionLogRouter);

export default router;
