import express from 'express'
import cors from 'cors'
import { ApiResponse } from './types/common.types.js'
// import { API_PREFIX } from './config/redis.js'
import { apiRouter } from './routes/index.js'
import { notFoundHandler } from './middleware/not-found.middleware.js'
import { errorHandler } from './middleware/error.middleware.js'
import { API_PREFIX } from './config/constants.js'

export const app = express()

app.disable("X-powered-by")
app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

app.get("/", (_request, response) => {
    const body: ApiResponse<never>= {
        success: true,
        message: "OneMarketPlace.io API is running."
    }
    response.status(200).json(body)
})

app.use(API_PREFIX, apiRouter)
app.use(notFoundHandler)
app.use(errorHandler)