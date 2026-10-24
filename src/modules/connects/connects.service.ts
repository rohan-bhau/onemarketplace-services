import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  CONNECTS_CACHE_TTL_SECONDS,
  getConnectsCachedKey,
  INITIAL_CONNECTS,
  PROPOSAL_CONNECTS,
} from "../../config/constants.js";
import { db } from "../../database/client.js";
import { connects, connects_history } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { redis } from "../../config/redis.js";

const cacheBalance = (freelancerId: string, balance: number) =>
  redis.setEx(
    getConnectsCachedKey(freelancerId),
    CONNECTS_CACHE_TTL_SECONDS,
    String(balance),
  );

export const addConnects = async (freelancerId: string) => {
  const balance = await db.transaction(async (transaction) => {
    const [balance] = await transaction
      .insert(connects)
      .values({
        freelancer_id: freelancerId,
        connects: INITIAL_CONNECTS,
      })
      .onConflictDoNothing({ target: connects.freelancer_id })
      .returning();

    if (!balance) return;

    await transaction.insert(connects_history).values({
      connects_id: balance.id,
      type: "Onboarding bonus",
      description: "New account welcome bonus",
      amount: INITIAL_CONNECTS,
    });

    return balance;
  });

  if (balance) await cacheBalance(freelancerId, balance.connects);

  return balance;
};

export const chargeConnects = async (
  freelancerId: string,
  description: string,
) => {
  const balance = await db.transaction(async (transaction) => {
    const [balance] = await transaction
      .update(connects)
      .set({
        connects: sql`${connects.connects} - ${PROPOSAL_CONNECTS}`,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(connects.freelancer_id, freelancerId),
          gte(connects.connects, PROPOSAL_CONNECTS),
        ),
      )
      .returning();

    if (!balance) throw new ApiError(400, "Not enough Connects");

    await transaction.insert(connects_history).values({
      connects_id: balance.id,
      type: "Proposal submitted",
      description,
      amount: -PROPOSAL_CONNECTS,
    });
    return balance;
  });

  await cacheBalance(freelancerId, balance.connects);

  return balance;
};

export const returnConnects = async (
  freelancerId: string,
  description: string,
) => {
  const balance = await db.transaction(async (transaction) => {
    const [balance] = await transaction
      .update(connects)
      .set({
        connects: sql`${connects.connects} + ${PROPOSAL_CONNECTS}`,
        updated_at: new Date(),
      })
      .where(eq(connects.freelancer_id, freelancerId))
      .returning();

    if (!balance) throw new ApiError(404, "Connects balance not found.");

    await transaction.insert(connects_history).values({
      connects_id: balance.id,
      type: "Proposal withdrawn found",
      description,
      amount: -PROPOSAL_CONNECTS,
    });
    return balance;
  });

  //CachedBalance
  await cacheBalance(freelancerId, balance.connects);

  return balance;
};

export  const getConnectHistory =async (freelancerId: string) => 
  db.select({
    id: connects_history.id,
    type: connects_history.type,
    description: connects_history.description,
    amount: connects_history.amount,
    created_at: connects_history.created_at
  })
    .from(connects_history)
    .innerJoin(connects, eq(connects_history.connects_id, connects.id))
    .where(eq(connects.freelancer_id, freelancerId))
    .orderBy(desc(connects_history.created_at))
    .limit(10);

