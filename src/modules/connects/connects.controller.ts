import { RequestHandler } from "express";
import { requireFreelancer } from "../freelancer/freelancer.controller.js";
import { ApiResponse } from "../../types/common.types.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getConnectHistory } from "./connects.service.js";


export const getAvailableConnects: RequestHandler = (request, response) => {
    requireFreelancer(request)

    const body: ApiResponse<{connects: number}> = {
        success: true,
        message: "Available Connects retrieved.",
        data: {connects: request.availableConnects ?? 0}
    }

    response.status(200).json(body)
}


export const getLoggedInFreelancerConnectHistory: RequestHandler = asyncHandler(async(request, response)=>{
    const auth = requireFreelancer(request)
    const history = await getConnectHistory(auth.userId)

    const body: ApiResponse<typeof history> = {
        success: true,
        message: "Connects history retrieved.",
        data: history
    }

    response.status(200).json(body)
})