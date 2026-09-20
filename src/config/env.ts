import "dotenv/config"


const parseRedisDatabase = (value: string | undefined): number => {
    const database = Number(value ?? 0)

    if (!Number.isInteger(database) || database < 0) {
        throw new Error ("Redis DB must be a non integer")
    }

    return database;

} 

const parsePort = (value: string | undefined): number => {
    const port = Number(value ?? 4000)
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("PORT Must be integer between 1 and 655535.")
    }

    return port
}

export const env = {
    port: parsePort(process.env.PORT),
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    nodeEnv: process.env.NODE_ENV || "development",
    redis: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: parsePort(process.env.REDIS_PORT ?? "6379"),
        password: process.env.REDIS_PASSWORD ?? undefined,
        database: parseRedisDatabase(process.env.REDIS_DB)
    }
} as const;