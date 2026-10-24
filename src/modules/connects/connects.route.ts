import { Router } from "express";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import { availableConnects } from "../../middleware/connects.middleware.js";
import {
  buyConnects,
  connectsWebhook,
  getAvailableConnects,
  getLoggedInFreelancerConnectHistory,
  verifyConnectsCheckout,
} from "./connects.controller.js";

export const connectsRouter = Router();

connectsRouter.post("/webhook", connectsWebhook);

connectsRouter.use(isAuthenticated, availableConnects);
connectsRouter.get("/", getAvailableConnects);
connectsRouter.get("/history", getLoggedInFreelancerConnectHistory);
connectsRouter.post("/checkout", buyConnects);
connectsRouter.post("/verify-checkout", verifyConnectsCheckout);