import { NextFunction, Request, RequestHandler, Response, response } from "express";


type AsyncHandler = (
    request: Request,
    response: Response,
    next: NextFunction,

) => Promise<unknown>

export const asyncHandler = (handler: AsyncHandler): RequestHandler => (request, response, next) => {
    void handler(request, response, next).catch(next)
}