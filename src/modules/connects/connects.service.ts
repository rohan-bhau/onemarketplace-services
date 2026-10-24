import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  CONNECTS_CACHE_TTL_SECONDS,
  CONNECTS_PLAN,
  ConnectsPlan,
  getConnectsCachedKey,
  INITIAL_CONNECTS,
  PROPOSAL_CONNECTS,
} from "../../config/constants.js";
import { db } from "../../database/client.js";
import {
  accounts,
  connects,
  connects_history,
  connects_purchase_history,
} from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { stripe } from "../../config/stripe.js";
import { createClerkClient } from "@clerk/backend";

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

export const getConnectHistory = async (freelancerId: string) =>
  db
    .select({
      id: connects_history.id,
      type: connects_history.type,
      description: connects_history.description,
      amount: connects_history.amount,
      created_at: connects_history.created_at,
    })
    .from(connects_history)
    .innerJoin(connects, eq(connects_history.connects_id, connects.id))
    .where(eq(connects.freelancer_id, freelancerId))
    .orderBy(desc(connects_history.created_at))
    .limit(10);

export const createsConnectsCheckout = async (
  freelancerId: string,
  purchaseConnects: ConnectsPlan,
) => {
  if (!env.stripeSecretKey || !env.freelancerDashboard) {
    throw new ApiError(503, "Connects payment are not configured");
  }

  const [account] = await db
    .select({ email: accounts.email })
    .from(accounts)
    .where(
      and(eq(accounts.auth_id, freelancerId), eq(accounts.role, "FREELANCER")),
    )
    .limit(1);

  let customerEmail = account?.email;

  if (!customerEmail && env.clerkSecretKey) {
    try {
      const clerk = createClerkClient({ secretKey: env.clerkSecretKey });
      const clerkUser = await clerk.users.getUser(freelancerId);
      customerEmail =
        clerkUser?.primaryEmailAddress?.emailAddress ??
        clerkUser?.emailAddresses?.at(0)?.emailAddress;
    } catch {
      // Fallback if clerk API call fails
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail || undefined,
    client_reference_id: freelancerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: CONNECTS_PLAN[purchaseConnects],
          product_data: { name: `${purchaseConnects} connects` },
        },
      },
    ],
    metadata: {
      freelancerId,
      purchasedConnects: String(purchaseConnects),
      purchaseConnects: String(purchaseConnects),
    },
    success_url: `${env.freelancerDashboard}/settings?section=connects&payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.freelancerDashboard}/settings?section=connects&payment=cancelled`,
  });

  if (!session.url) throw new ApiError(502, "Stripe checkout could not start");

  return session.url;
};

export const completeConnectsPurchase = async (
  freelancerId: string,
  purchasedConnects: ConnectsPlan,
  paymentId: string,
) => {
  const balance = await db.transaction(async (transaction) => {
    let [userConnects] = await transaction
      .select()
      .from(connects)
      .where(eq(connects.freelancer_id, freelancerId))
      .limit(1);

    if (!userConnects) {
      [userConnects] = await transaction
        .insert(connects)
        .values({
          freelancer_id: freelancerId,
          connects: INITIAL_CONNECTS,
        })
        .returning();

      if (userConnects) {
        await transaction.insert(connects_history).values({
          connects_id: userConnects.id,
          type: "Onboarding bonus",
          description: "New account welcome bonus",
          amount: INITIAL_CONNECTS,
        });
      }
    }

    if (!userConnects) return;

    const [purchase] = await transaction
      .insert(connects_purchase_history)
      .values({
        connects_id: userConnects.id,
        purchased_connects: purchasedConnects,
        amount_paid: String(CONNECTS_PLAN[purchasedConnects] / 100),
        payment_id: paymentId,
        status: "COMPLETED",
      })
      .onConflictDoNothing({ target: connects_purchase_history.payment_id })
      .returning();

    if (!purchase) return;

    const [updateBalance] = await transaction
      .update(connects)
      .set({
        connects: sql`${connects.connects} + ${purchasedConnects}`,
        updated_at: new Date(),
      })
      .where(eq(connects.freelancer_id, freelancerId))
      .returning();

    if (!updateBalance) throw new ApiError(404, "Connects balance not found");

    await transaction.insert(connects_history).values({
      connects_id: updateBalance.id,
      type: "Connects purchased",
      description: `Purchased ${purchasedConnects} connects`,
      amount: purchasedConnects,
    });

    return updateBalance;
  });

  if (balance) await cacheBalance(freelancerId, balance.connects);
  return balance;
};
