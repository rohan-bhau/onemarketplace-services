import { Router } from "express";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import { availableConnects } from "../../middleware/connects.middleware.js";
import { getAvailableConnects, getLoggedInFreelancerConnectHistory } from "./connects.controller.js";


export const connectsRouter = Router()

connectsRouter.use(isAuthenticated, availableConnects)
connectsRouter.get("/", getAvailableConnects);
connectsRouter.get("/history", getLoggedInFreelancerConnectHistory)