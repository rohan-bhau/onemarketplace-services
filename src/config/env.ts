import "dotenv/config"

const parsePort = (value: string | undefined): number => {
    const port = Number(value ?? 4000)
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("PORT Must be integer between 1 and 655535.")
    }

    return port
}

export const env = {
    port: parsePort(process.env.PORT),
} as const;