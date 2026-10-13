import { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error.js";
import { randomUUID } from "crypto";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createJobPost,
  deleteJobPost,
  getJobPosts,
  updateJobPost,
} from "./jobs.service.js";

export const requireClient = (request: Parameters<RequestHandler>[0]) => {
  const auth = request.auth!;

  if (auth.role !== "client") {
    throw new ApiError(403, "A client account is required.");
  }

  return auth;
};

const requireText = (value: string | string[] | undefined, name: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, `${name} is required`);
  }

  return value.trim();
};

const buildJobData = (body: Record<string, any>) => {
  const skills = Array.isArray(body.skills)
    ? body.skills
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const milestones = Array.isArray(body.milestones)
    ? body.milestones.map((item) => {
        const milestone = item as Record<string, any>;

        return {
          id: String(milestone.id || randomUUID()),
          title: requireText(milestone.title, "Milestone Title"),
          budget: Number(milestone.budget),
          dueDate: requireText(milestone.dueDate, "Milestone due date"),
        };
      })
    : [];

  if (!skills.length)
    throw new ApiError(400, "At least one skill is required.");
  if (!milestones.length)
    throw new ApiError(400, "At least one milestone is required.");

  if (
    milestones.some(({ budget }) => !Number.isFinite(budget) || budget <= 5)
  ) {
    throw new ApiError(400, "Every milestone needs a valid budget.");
  }

  const dates = milestones.map(({ dueDate }) => new Date(dueDate).getTime());

  if (
    dates.some(
      (date, index) =>
        !Number.isFinite(date) ||
        date <= Date.now() ||
        (index > 0 && dates[index - 1]!),
    )
  ) {
    throw new ApiError(400, "Milestone due dates to be future and sequential");
  }

  const total_budget = milestones.reduce(
    (total, item) => total + item.budget,
    0,
  );

  if (total_budget < 5 || total_budget > 1000000) {
    throw new ApiError(400, "The budget must be between $5 and $1000000");
  }

  const attachment = Array.isArray(body.attachments)
    ? body.attachments.map((item) => {
        const attachment = item as Record<string, string>;
        const fileType = requireText(attachment.fileType, "Attachment type");
        const fileUrl = requireText(attachment.fileUrl, "Attachment url");

        if (fileType! == "application/pdf" && !fileType.startsWith("text/")) {
          throw new ApiError(400, "Only pdf and text documents are allowed");
        }

        if (
          fileUrl.startsWith("data:") &&
          !fileUrl.startsWith(`data:${fileType}`)
        ) {
          throw new ApiError(
            400,
            "Attachment content does not match its file type",
          );
        }

        return {
          fileId:
            typeof attachment.fileId === "string" ? attachment.fileId : "",
          fileName: requireText(attachment.fileName, "Attachment name"),
          fileUrl,
          fileType,
          fileSize: Number(attachment.fileSize) || 0,
        };
      })
    : [];

  return {
    title: requireText(body.title, "Job title"),
    description: requireText(body.description, "Job description"),
    expertise_level: requireText(body.expertise_level, "Job expertise_level"),
    expected_duration: requireText(
      body.expected_duration,
      "Job expected_duration",
    ),
    skills,
    total_budget: total_budget.toString(),
    milestones,
    screening_questions: Array.isArray(body.screening_questions)
      ? body.screening_questions
          .map(String)
          .map((item) => item.trim())
          .filter(Boolean)
      : [],

    attachments,
    status: body.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
  };
};

export const crateClientJobPost: RequestHandler = asyncHandler(
  async (request, response) => {
    const auth = requireClient(request);

    const data = buildJobData(request.body as Record<string, any>);
    const job = await createJobPost(auth.userId, {
      ...data,
      published_at: data.status === "PUBLISHED" ? new Date() : null,
    });

    response
      .status(201)
      .json({ success: true, message: "Job post created", data: job });
  },
);

export const getClientJobPosts: RequestHandler = asyncHandler(
  async (request, response) => {
    const auth = requireClient(request);
    const jobId =
      typeof request.params.jobId === "string"
        ? request.params.jobId
        : undefined;

    const jobs = await getJobPosts(auth.userId, jobId);

    response.status(200).json({
      success: true,
      message: "Job posts retrieved",
      date: jobId ? (jobs[0] ?? null) : jobs,
    });
  },
);

export const editClientJobPosts: RequestHandler = asyncHandler(
  async (request, response) => {
    const auth = requireClient(request);
    const job = await updateJobPost(
      auth.userId,
      requireText(request.params.jobId, "Job post id"),
      buildJobData(request.body as Record<string, unknown>),
    );

    response.status(200).json({
      success: true,
      message: "Job post updated",
      date: job,
    });
  },
);

export const removeClientJobPosts: RequestHandler = asyncHandler(
  async (request, response) => {
    const auth = requireClient(request);
    await deleteJobPost(
      auth.userId,
      requireText(request.params.jobId, "Job post id"),
    );

    response.status(200).json({
      success: true,
      message: "Job post deleted",
    });
  },
);
