import { Router } from "express";
import { isAuthenticated } from "../../middleware/auth.middleware.js";
import { crateClientJobPost, editClientJobPosts, getClientJobPosts, removeClientJobPosts } from "./jobs.controller.js";


export const jobRouter = Router()

jobRouter.post("/", isAuthenticated, crateClientJobPost);
jobRouter.get("/", isAuthenticated, getClientJobPosts);
jobRouter.get("/:jobId", isAuthenticated, getClientJobPosts);
jobRouter.put("/:jobId", isAuthenticated, editClientJobPosts);
jobRouter.delete("/:jobId", isAuthenticated, removeClientJobPosts);

