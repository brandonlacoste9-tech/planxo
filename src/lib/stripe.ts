import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) throw new Error("STRIPE_SECRET_KEY not set");

export const stripe = new Stripe(stripeSecret, {
  apiVersion: "2025-03-31.basil" as any,
  typescript: true,
});
