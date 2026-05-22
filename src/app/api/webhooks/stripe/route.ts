import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const signingSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, signingSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const bookingId = session.client_reference_id || session.metadata?.bookingId;
        if (bookingId) {
          await supabase.from("Booking").update({
            paid: true,
            status: "confirmed",
            paymentId: session.id,
            updatedAt: new Date().toISOString(),
          }).eq("id", bookingId);
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as any;
        const bookingId = session.client_reference_id || session.metadata?.bookingId;
        if (bookingId) {
          await supabase.from("Booking").update({
            status: "cancelled",
            updatedAt: new Date().toISOString(),
          }).eq("id", bookingId);
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
