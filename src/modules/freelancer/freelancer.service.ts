import { and, eq } from "drizzle-orm";
import { db } from "../../database/client.js";
import {
  accounts,
  freelancer_metadata,
  freelancer_portfolios,
} from "../../database/schema.js";
import {
  FreelancerProfileData,
  PortfolioData,
  SavedFreelancerProfileInput,
} from "./@types.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { imageKit } from "../../config/imageKit.js";
import { randomUUID } from "crypto";
import { redis } from "../../config/redis.js";
import { ACCOUNT_AUTH_CACHE_TTL_SECONDS, getAccountAuthCacheKey } from "../../config/constants.js";
import { createClerkClient } from "@clerk/backend";
import { addConnects } from "../connects/connects.service.js";

export const getFreelancerProfile = async (
  userId: string,
): Promise<FreelancerProfileData | null> => {
  const [result] = await db
    .select()
    .from(freelancer_metadata)
    .innerJoin(
      accounts,
      and(
        eq(accounts.auth_id, freelancer_metadata.auth_id),
        eq(accounts.role, "FREELANCER"),
      ),
    )
    .where(eq(freelancer_metadata.auth_id, userId))
    .limit(1);

  if (!result) return null;

  const profile = result.freelancer_metadata;

  const portfolios = await db
    .select()
    .from(freelancer_portfolios)
    .where(eq(freelancer_portfolios.freelancer_id, profile.id));

  return {
    ...profile,
    identityVerified: result.accounts.identityVerification === true,
    joined_at: profile.created_at,
    portfolios,
  };
};

const uploadPortfolioImages = async (
  userId: string,
  portfolios: PortfolioData[],
) => {
  if (!env.imageKitPrivateKey) {
    throw new ApiError(503, "Portfolio image upload are not configured");
  }

  const uploadFileIds: string[] = [];
  const uploadedPortfolios: PortfolioData[] = [];

  try {
    for (const portfolio of portfolios) {
      if (!portfolio.cover_image.url.startsWith("data:image/")) {
        uploadedPortfolios.push(portfolio);
        continue;
      }

      const upload = await imageKit.files.upload({
        file: portfolio.cover_image.url,
        fileName: `portfolio-${randomUUID()}`,
        folder: `/onemarketplace/freelancer-portfolios/${userId}`,
      });

      if (!upload.fileId || !upload.url) {
        throw new ApiError(502, "Portfolio image upload failed.");
      }

      uploadFileIds.push(upload.fileId);
      uploadedPortfolios.push({
        ...portfolio,
        cover_image: { imageId: upload.fileId, url: upload.url },
      });
    }

    return { uploadedPortfolios, uploadFileIds };
  } catch (error) {
    await Promise.allSettled(
      uploadFileIds.map((fileId) => imageKit.files.delete(fileId)),
    );
    throw error;
  }
};

export const savedFreelancerProfile = async (
  input: SavedFreelancerProfileInput,
  accountExists: Boolean | undefined,
): Promise<FreelancerProfileData> => {
  const existingImages = await db
    .select({ cover_image: freelancer_portfolios.cover_image })
    .from(freelancer_portfolios)
    .innerJoin(
      freelancer_metadata,
      eq(freelancer_portfolios.freelancer_id, freelancer_metadata.id),
    )
    .where(eq(freelancer_metadata.auth_id, input.userId));

  const { uploadedPortfolios, uploadFileIds } = await uploadPortfolioImages(
    input.userId,
    input.portfolios,
  );

  let profile: FreelancerProfileData;

  try {
    profile = await db.transaction(async (transaction) => {
      let [account] = await transaction
        .update(accounts)
        .set({ isOnboardingComplete: true, updated_at: new Date() })
        .where(
          and(
            eq(accounts.auth_id, input.userId),
            eq(accounts.role, "FREELANCER"),
          ),
        )
        .returning();

      if (!account) {
        const clerk = createClerkClient({ secretKey: env.clerkSecretKey });
        const clerkUser = await clerk.users.getUser(input.userId).catch(() => null);
        const email =
          clerkUser?.primaryEmailAddress?.emailAddress ??
          clerkUser?.emailAddresses?.at(0)?.emailAddress ??
          "unknown@onemarketplace.io";

        const now = new Date();
        const [newAccount] = await transaction
          .insert(accounts)
          .values({
            auth_id: input.userId,
            email,
            role: "FREELANCER",
            identityVerification: false,
            isOnboardingComplete: true,
            created_at: now,
            updated_at: now,
          })
          .onConflictDoUpdate({
            target: [accounts.auth_id, accounts.role],
            set: {
              isOnboardingComplete: true,
              updated_at: now,
            },
          })
          .returning();

        account = newAccount;
      }

      if (!account) throw new ApiError(404, "Freelancer account not found");

      const metadataValues = {
        professional_title: input.professional_title,
        professional_description: input.professional_description,
        hourly_rate: input.hourly_rate,
        country: input.country,
        city: input.city,
        availability_status: input.availability_status,
        weekly_availability: input.weekly_availability,
        experience_level: input.experience_level,
        skills: input.skills,
        languages: input.languages,
      };

      const [metadata] = await transaction
        .insert(freelancer_metadata)
        .values({
          auth_id: input.userId,
          ...metadataValues,
        })
        .onConflictDoUpdate({
          target: freelancer_metadata.auth_id,
          set: {
            ...metadataValues,
            updated_at: new Date(),
          },
        })
        .returning();

      if (!metadata) {
        throw new ApiError(500, "Freelancer profile could not be saved.");
      }

      await transaction
        .delete(freelancer_portfolios)
        .where(eq(freelancer_portfolios.freelancer_id, metadata.id));

      const portfolios = await transaction
        .insert(freelancer_portfolios)
        .values(
          uploadedPortfolios.map((portfolio) => ({
            freelancer_id: metadata.id,
            ...portfolio,
          })),
        )
        .returning();

      return {
        professional_title: metadata.professional_title,
        professional_description: metadata.professional_description,
        hourly_rate: metadata.hourly_rate,
        country: metadata.country,
        city: metadata.city,
        availability_status: metadata.availability_status,
        weekly_availability: metadata.weekly_availability,
        experience_level: metadata.experience_level,
        skills: metadata.skills,
        languages: metadata.languages,
        portfolios,
        identityVerified: account.identityVerification === true,
        joined_at: metadata.created_at,
      };
    });
  } catch (error) {
    await Promise.allSettled(
      uploadFileIds.map((fileId) => imageKit.files.delete(fileId)),
    );
    throw error;
  }

  const retainedImageIds = new Set(
    uploadedPortfolios.map(({ cover_image }) => cover_image.imageId),
  );

  await Promise.allSettled(
    existingImages
      .map(({ cover_image }) => cover_image.imageId)
      .filter((fileId) => fileId && !retainedImageIds.has(fileId))
      .map((fileId) => imageKit.files.delete(fileId)),
  );

  try {
    if(!accountExists){
      await addConnects(input.userId);

    }
  } catch (error) {
    console.log(error, "onboarding freelancer's connects adding error")
  }

   await redis.setEx(
      getAccountAuthCacheKey(input.userId, "freelancer"),
      ACCOUNT_AUTH_CACHE_TTL_SECONDS,
      JSON.stringify({
          userId: input.userId,
          role: "freelancer",
          accountExists: true,
          isOnboarded: true,
      })
      )

      return profile
};
