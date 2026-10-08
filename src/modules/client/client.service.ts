import { and, eq } from "drizzle-orm";
import { db } from "../../database/client.js";
import { accounts, client_metadata } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { redis } from "../../config/redis.js";
import { ACCOUNT_AUTH_CACHE_TTL_SECONDS, getAccountAuthCacheKey } from "../../config/constants.js";

export interface SaveClientProfileInput {
  userId: string;
  professionalRole: string;
  companyName: string;
  companyWebsite: string;
  companySize: string;
  industry: string;
  companyDescription: string;
}

export interface ClientMetadataData {
    professionalRole: string;
    companyName: string;
    companyWebsite: string;
    companySize: string;
    industry: string;
    companyDescription: string;
    joinedAt: Date | null;
    identityVerified: boolean;
    paymentMethodVerified: boolean;
}

export interface ClientProfileData extends ClientMetadataData {
    isOnboarded: true;
}

export const getClientProfile = async(userId:string):Promise<ClientMetadataData | null>=>{
    const [profile] = await db.select({
      professionalRole: client_metadata.role,
      companyName: client_metadata.company_name,
      companyWebsite: client_metadata.company_website,
      companySize: client_metadata.company_size,
      industry: client_metadata.industry,
      companyDescription: client_metadata.company_description,
      joinedAt: client_metadata.created_at,
      identityVerified: accounts.identityVerification,
      paymentMethodVerified: accounts.paymentMethodVerified,
    }).from(client_metadata).innerJoin(
        accounts,
        and(
            eq(accounts.auth_id, client_metadata.auth_id),
            eq(accounts.role, "CLIENT"),
        )
    ).where(eq(client_metadata.auth_id, userId)).limit(1);

    if(!profile) return null;

    return {
        ...profile,
        identityVerified: profile.identityVerified === true,
        paymentMethodVerified: profile.paymentMethodVerified===true,
    }
}



export const savedClientProfile = async(input:SaveClientProfileInput):Promise<ClientProfileData>=>{
    const now = new Date();

    const profile:any = await db.transaction(async(transaction)=>{
        const [account] = await transaction.update(accounts).set({
            isOnboardingComplete: true,
            updated_at: now,
        }).where(
            and(eq(accounts.auth_id, input.userId), eq(accounts.role, "CLIENT")),
        ).returning({
            id: accounts.id,
            identityVerification: accounts.identityVerification,
            paymentVerified: accounts.paymentMethodVerified
        })

        if(!account) {
            throw new ApiError(404, "Client account not found")
        }

        const [savedProfile] = await transaction
          .insert(client_metadata)
          .values({
            auth_id: input.userId,
            role: input.professionalRole,
            company_name: input.companyName,
            company_website: input.companyWebsite,
            company_size: input.companySize,
            industry: input.industry,
            company_description: input.companyDescription,
            created_at: now,
            updated_at: now,
          })
          .onConflictDoUpdate({
            target: client_metadata.auth_id,
            set: {
              role: input.professionalRole,
              company_name: input.companyName,
              company_website: input.companyWebsite,
              company_size: input.companySize,
              industry: input.industry,
              company_description: input.companyDescription,
              updated_at: now,
            },
          })
          .returning({
            professionalRole: client_metadata.role,
            companyName: client_metadata.company_name,
            companyWebsite: client_metadata.company_website,
            companySize: client_metadata.company_size,
            industry: client_metadata.industry,
            companyDescription: client_metadata.company_description,
            joinedAt:client_metadata?.created_at,
          });

          if(!savedProfile){
            throw new ApiError(500, "Client profile could not be saved.")
          }

          return {
            ...savedProfile,
            identityVerification: account.identityVerification === true,
            paymentMethodVerified: account.paymentVerified === true,
          };
    })

    await redis.setEx(
    getAccountAuthCacheKey(input.userId, "client"),
    ACCOUNT_AUTH_CACHE_TTL_SECONDS,
    JSON.stringify({
        userId: input.userId,
        role: "client",
        accountExists: true,
        isOnboarded: true,
    })
    )

    return {
        ...profile,
        isOnboarded: true
    }
}