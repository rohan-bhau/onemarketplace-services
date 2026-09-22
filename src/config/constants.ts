export const API_PREFIX = "/api/v1"
export const SERVICE_NAME = "onemarketplace-services"

export const ACCOUNT_AUTH_CACHE_TTL_SECONDS = 10 * 60 // 10 minutes

export const getAccountAuthCacheKey = (
    userId: string,
    role: "client" | "freelancer"
):string => `account-auth:${userId}:${role}`