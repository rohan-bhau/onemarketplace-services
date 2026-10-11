import { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../types/common.types.js";


export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const statusCode =
        error instanceof ApiError
            ? error.statusCode
            : typeof (error as { status?: unknown })?.status === "number"
              ? (error as { status: number }).status
              : typeof (error as { statusCode?: unknown })?.statusCode === "number"
                ? (error as { statusCode: number }).statusCode
                : 500
    const message = error instanceof Error ? error.message : "An Unexpected error occurred."

    response.status(statusCode).json({
        success: false,
        message,
    } satisfies ApiResponse<never>)
};