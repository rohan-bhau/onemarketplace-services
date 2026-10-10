import { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { ClientMetadataData, getClientProfile, SaveClientProfileInput, savedClientProfile } from "./client.service.js";
import { ApiResponse } from "../../types/common.types.js";
import { requireText, requireWebsite } from "../../config/constants.js";

export const getLoggedInClientProfile:RequestHandler=asyncHandler(
    async(request, response)=>{
        if(!request.auth){
            throw new ApiError(401, "Authentication is required.")
        }

        if(request.auth.role !== "client"){
            throw new ApiError(403, "A client account is required.")
        }

        const profile = await getClientProfile(request.auth.userId)

        const responseBody:ApiResponse<ClientMetadataData | null> = {
            success: true,
            message: profile ? "Client Profile retrieved" : "Client profile has not been completed.",
            data: profile,
        }

        response.status(200).json(responseBody)

    }
)

interface ClientProfileBody {
  professionalRole?: string;
  companyName?: string;
  companyWebsite?: string | undefined;
  companySize?: string;
  industry?: string;
  companyDescription?: string;
}


export const upsertClientProfile: RequestHandler = asyncHandler(
    async(request, response) =>{
        if(!request.auth){
            throw new ApiError(401, "Authentication is required.")
        }

        if (request.auth.role !=="client") {
          throw new ApiError(403, "A client is required.");
        }

        const body = request.body as ClientProfileBody

        const input:SaveClientProfileInput = {
            userId: request.auth.userId,
            professionalRole: requireText(body.professionalRole, "Professional Role"),
            companyName: requireText(body.companyName, "Company Name"),
            companyWebsite: requireWebsite(body.companyWebsite),
            companySize: requireText(body.companySize, "Company Size"),
            industry: requireText(body.industry, "Industry"),
            companyDescription: requireText(body.companyDescription, "Company Description")

        }

        const profile = await savedClientProfile(input)

        const responseBody:ApiResponse<ClientProfileBody> = {
            success: true,
            message: "Client profile saved",
            data: profile
        }

        response.status(200).json(responseBody)
    }
)