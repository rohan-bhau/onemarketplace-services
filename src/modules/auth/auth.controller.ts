import { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error.js";
import { ApiResponse } from "../../types/common.types.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { receiveSignup } from "./auth.service.js";

interface AuthStatusData {
    role: "client" | "freelancer";
    accountExists: boolean;
    isOnboarded: boolean;
}


export const getAuthStatus:RequestHandler= (request, response) => {
    if(!request.auth){
        throw new ApiError(401, "Authentication is required.")
    }

    const body: ApiResponse<AuthStatusData> = {
        success: true,
        message: "Authentication status retrieved successfully.",
        data: {
            role: request.auth.role,
            accountExists: request.auth.accountExists,
            isOnboarded: request.auth.isOnboarded
        }
    }
    response.status(200).json(body)
}


export const signup:RequestHandler = asyncHandler(
    async(request, response)=>{
        if(!request.auth){
            throw new ApiError(401, "Authentication is required.")
        }
        await receiveSignup(request.auth);

        const body:ApiResponse<never>={
            success: true,
            message: "Signup successful."
        }
        response.status(201).json(body)
    }
)