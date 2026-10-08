import { RequestHandler } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { ClientMetadataData, getClientProfile, SaveClientProfileInput, savedClientProfile } from "./client.service.js";
import { ApiResponse } from "../../types/common.types.js";

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

const requireText = (value:string | undefined, fieldName: string):string=>{
if(typeof value !== "string" || !value.trim()){
    throw new ApiError(400, `${fieldName} is required`)
}
return value.trim()
}

const requireWebsite = (value:string | undefined): string =>{
    const website = requireText(value, "Company Website");

    try {
        const url = new URL(website);
        if(url.protocol!=="https:"){
            throw new Error("Unsupported Protocol.")
        }
    } catch (error) {
        throw new ApiError(400, "Company website must be a valid HTTPS URL")
    }

    return website
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