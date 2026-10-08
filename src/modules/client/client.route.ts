import { Router } from "express";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import { getLoggedInClientProfile, upsertClientProfile } from "./client.controller.js";

export const clientRouter = Router();
clientRouter.get("/profile", isAuthenticated, getLoggedInClientProfile)
clientRouter.put("/profile", isAuthenticated, upsertClientProfile)