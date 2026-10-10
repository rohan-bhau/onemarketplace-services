import { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiResponse } from "../../types/common.types.js";
import { FreelancerProfileData, SavedFreelancerProfileInput } from "./@types.js";
import { requireText } from "../../config/constants.js";
import { getFreelancerProfile, savedFreelancerProfile } from "./freelancer.service.js";

const requireFreelancer = (request: Parameters<RequestHandler>[0]) => {
  if (!request.auth) throw new ApiError(401, "Authentication is required.");

  if (request.auth.role !== "freelancer") {
    throw new ApiError(403, "A freelancer account is required.");
  }

  return request.auth;
};

export const getLoggedInFreelancerProfile:RequestHandler= asyncHandler(async(request, response)=>{
    const auth = requireFreelancer(request)
    const profile = await getFreelancerProfile(auth.userId)

    const body: ApiResponse<FreelancerProfileData | null> = {
        success: true,
        message: profile ? "Freelancer profile retrieved" : "Freelancer profile has not been completed yet.",
        data: profile
    }
    response.status(200).json(body)
})


export const upsertFreelancerProfile: RequestHandler = asyncHandler(async(request, response)=>{
    const auth  = requireFreelancer(request)
    const metadata = request.body?.freelancer_metadata as | Record<string , any> | undefined;

    const portfolios = request?.body?.freelancer_portfolios as any;

    if(!metadata) throw new ApiError(400, "Freelancer metadata is required.")

    if(!Array.isArray(portfolios) || portfolios.length <1){
        throw new ApiError(400, "At least one portfolio project is required.")
    }

    const hourlyRate = Number(metadata.hourly_rate)
    if(!Number.isFinite(hourlyRate) || hourlyRate < 5 || hourlyRate > 1000) {
        throw new ApiError(400, "Hourly rate must be between 5 and 1000$")
    }

    const skills = metadata.skills
    if(!Array.isArray(skills) || skills.length < 3 || skills.length > 15 || skills.some((skill)=> typeof skill !== "string" || !skill.trim() || skill.trim().length > 20)){
        throw new ApiError(
            400, 
            "Add 3 to 15 skills with at most 20 characters."
        )
    }

    const languages = metadata.languages
    if(!Array.isArray(languages) || languages.length<1 || languages.length> 5){
        throw new ApiError(400, "Add between 1 to 5 languages.")
    }

    const input: SavedFreelancerProfileInput = {
      userId: auth.userId,
      professional_title: requireText(
        metadata.professional_title,
        "Professional title",
      ),
      professional_description: requireText(
        metadata.professional_description,
        "Professional description",
      ),
      hourly_rate: hourlyRate.toString(),
      country: requireText(metadata.country, "Country"),
      city: requireText(metadata.city, "City"),
      availability_status: requireText(
        metadata.availability_status,
        "Availability Status",
      ),
      weekly_availability: requireText(
        metadata.weekly_availability,
        "Weekly availability",
      ),
      experience_level: requireText(metadata.experience_level, "Experience Level"),
      skills: skills.map((skill) => String(skill).trim()),
      languages: languages.map((item)=>{
        const language = item as Record<string, any>;
        return {
            language: requireText(language.language, "Language"),
            proficiency: requireText(language.proficiency, "Proficiency"),
        }
      }),
      portfolios: portfolios.map((item)=>{
        const portfolio = item as Record<string, any>
        const coverImage = portfolio.cover_image as Record<string, string> | undefined;
        if(!coverImage){
            throw new ApiError(400, "Portfolio cover is required")
        }
        const imageId = typeof coverImage.imageId === "string" ? coverImage.imageId : "";
        const imageUrl = requireText(coverImage.url, "Portfolio cover image url")
        
        if(!imageId && !imageUrl.startsWith("data:image/")){
            throw new ApiError(400, "Portfolio cover image is invalid")
        }

        return {
            title: requireText(portfolio.title, "Portfolio title"),
            category: requireText(portfolio.category, "Portfolio Category"),
            description: requireText(portfolio.description, "Portfolio Description"),
            live_url: typeof portfolio.live_url === "string" && portfolio.live_url.trim() ? portfolio.live_url.trim() : null,
            cover_image: {
                imageId,
                url: imageUrl
            }
        }
      })
    };

    const profile = await savedFreelancerProfile(input)

    const body: ApiResponse<FreelancerProfileData> = {
        success: true,
        message: "Freelancer Profile saved.",
        data: profile
    }

    response.status(200).json(body)
})