import { RequestHandler } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";



const accountRoles = ["client", "freelancer"] as const 
type AccountRole = (typeof accountRoles)[number]

interface CachedAccountAuth {
    userId: string;
    role: "client" | "freelancer";
    accountExists: boolean;
    isOnboarded: boolean;
}

const isAccountRole = (value: unknown): value is AccountRole => typeof value === "string" && accountRoles.some((accountRole) => accountRole === value);

const getBearerToken = (authorizationHeader: string | undefined) => {
    if (!authorizationHeader?.startsWith("Bearer ")) {
        return null
    }

    const token = authorizationHeader?.slice("Bearer ".length).trim();
    return token || null 
}

export const isAuthenticated: RequestHandler = asyncHandler(
    async (request, _response, next) => {
        const token = getBearerToken(request?.headers.authorization);
        const requestedRole = request.body?.role ?? request?.query.role;

        if (!token) {
            throw new ApiError(401, "Please login to access this API!")
        }

        if (!isAccountRole(requestedRole)) {
            throw new ApiError(400, "A valid role is required.")
        }

    }
)