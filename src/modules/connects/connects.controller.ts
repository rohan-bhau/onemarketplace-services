import { RequestHandler } from "express";
import { requireFreelancer } from "../freelancer/freelancer.controller.js";
import { ApiResponse } from "../../types/common.types.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  completeConnectsPurchase,
  createsConnectsCheckout,
  getConnectHistory,
} from "./connects.service.js";
import { CONNECTS_PLAN, ConnectsPlan, getConnectsCachedKey } from "../../config/constants.js";
import { ApiError } from "../../utils/api-error.js";
import { env } from "../../config/env.js";
import { stripe } from "../../config/stripe.js";
import { redis } from "../../config/redis.js";
import { db } from "../../database/client.js";
import { connects } from "../../database/schema.js";
import { eq } from "drizzle-orm";

export const getAvailableConnects: RequestHandler = (request, response) => {
  requireFreelancer(request);

  const body: ApiResponse<{ connects: number }> = {
    success: true,
    message: "Available Connects retrieved.",
    data: { connects: request.availableConnects ?? 0 },
  };

  response.status(200).json(body);
};

export const getLoggedInFreelancerConnectHistory: RequestHandler = asyncHandler(
  async (request, response) => {
    const auth = requireFreelancer(request);
    const history = await getConnectHistory(auth.userId);

    const body: ApiResponse<typeof history> = {
      success: true,
      message: "Connects history retrieved.",
      data: history,
    };

    response.status(200).json(body);
  },
);

export const buyConnects: RequestHandler = asyncHandler(
  async (request, response) => {
    const auth = requireFreelancer(request);
    const purchaseConnects = Number(request.body?.connects) as ConnectsPlan;
    if (!(purchaseConnects in CONNECTS_PLAN)) {
      throw new ApiError(400, "Select a valid connects plan.");
    }

    const url = await createsConnectsCheckout(auth.userId, purchaseConnects);

    response.status(200).json({
      success: true,
      message: "Stripe checkout created.",
      data: { url },
    } satisfies ApiResponse<{ url: string }>);
  },
);

export const verifyConnectsCheckout: RequestHandler = asyncHandler(
  async (request, response) => {
    const auth = requireFreelancer(request);
    const sessionId = (request.body?.sessionId ?? request.query.sessionId) as string;

    if (!sessionId || typeof sessionId !== "string") {
      throw new ApiError(400, "Session ID is required.");
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.freelancerId !== auth.userId) {
      throw new ApiError(403, "Invalid checkout session for this account.");
    }

    const rawConnects =
      session.metadata?.purchasedConnects ?? session.metadata?.purchaseConnects;
    const purchasedConnects = Number(rawConnects) as ConnectsPlan;

    if (
      session.payment_status === "paid" &&
      purchasedConnects in CONNECTS_PLAN
    ) {
      await completeConnectsPurchase(
        auth.userId,
        purchasedConnects,
        session.id,
      );
    }

    const cacheKey = getConnectsCachedKey(auth.userId);
    const cachedConnects = await redis.get(cacheKey);
    let currentConnects = cachedConnects !== null ? Number(cachedConnects) : null;

    if (currentConnects === null) {
      const [balance] = await db
        .select({ connects: connects.connects })
        .from(connects)
        .where(eq(connects.freelancer_id, auth.userId))
        .limit(1);
      currentConnects = balance?.connects ?? 0;
    }

    response.status(200).json({
      success: true,
      message: "Checkout session verified.",
      data: { connects: currentConnects },
    } satisfies ApiResponse<{ connects: number }>);
  },
);

export const connectsWebhook: RequestHandler = asyncHandler(
  async (request, response) => {
    const signature = request.headers["stripe-signature"];

    if (!env.stripeWebhookSecret || typeof signature !== "string") {
      throw new ApiError(400, "Invalid Stripe webhook");
    }

    const event = stripe.webhooks.constructEvent(
      request.body,
      signature,
      env.stripeWebhookSecret,
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const rawConnects =
        session.metadata?.purchasedConnects ?? session.metadata?.purchaseConnects;
      const purchasedConnects = Number(rawConnects) as ConnectsPlan;

      const freelancerId = session.metadata?.freelancerId;

      if (
        session.payment_status === "paid" &&
        freelancerId &&
        purchasedConnects in CONNECTS_PLAN
      ) {
        await completeConnectsPurchase(
          freelancerId,
          purchasedConnects,
          session.id,
        );
      }
    }

    response.status(200).json({ received: true });
  },
);
