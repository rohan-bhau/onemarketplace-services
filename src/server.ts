import { Server } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { SERVICE_NAME } from "./config/constants.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
// import { env } from "node:process";

let server: Server | undefined
let isShuttingDown = false

const start = async (): Promise<void> => {
    await connectRedis()
    server = app.listen(env.port, () => {
        console.log(
            `${SERVICE_NAME} listening on http:localhost:${env.port} in ${env.nodeEnv} mode`
        )
    })
}

const closeHttpServer = async (): Promise<void> => {
    if (!server) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
            if (error) {
                reject(error)
                reject;
            }
            resolve()
        })
    })
}


const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
        return
    }
    isShuttingDown = true

    console.log(`${signal} received. Closing Services`)

    try {
        await closeHttpServer()
        await disconnectRedis()
        process.exit(0)
    } catch (error) {
        console.log("Failed to shut down cleanly.", error)   
        process.exit(1)
    }
}

process.on("SIGINT", ()=> void shutdown('SIGINT'))
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start().catch(async (error) => {
    
    console.error(`Failed to start ${SERVICE_NAME}.`, error)
    await disconnectRedis().catch(()=> undefined)
    process.exit(1)
})