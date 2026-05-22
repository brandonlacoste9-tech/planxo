import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST — Create Stripe Checkout Session for a booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const successUrl = body.successUrl || `${request.nextUrl.origin}/booking-confirmed?bookingId=${id}`;
    const cancelUrl = body.cancelUrl || `${request.nextUrl.origin}`;

    // Fetch booking
    const { data: booking } = await supabase.from("Booking").select("*, eventType:EventType(*)").eq("id", id).single();
    if (!booking) return apiError("Booking not found", 404);
    if (booking.status !== "pending_payment") return apiError("Booking is not awaiting payment", 400);

    const et = booking.eventType;
    if (!et || et.price <= 0) return apiError("This event type is free", 400);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: (et.currency || "cad").toLowerCase(),
          product_data: {
            name: et.title,
            description: `${new Date(booking.startTime).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} — ${et.length} min`,
          },
          unit_amount: et.price, // price is in cents
        },
        quantity: 1,
      }],
      client_reference_id: id,
      customer_email: booking.guestEmail,
      metadata: {
        bookingId: id,
        eventTypeId: et.id,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({
      status: "success",
      data: { checkoutUrl: session.url, sessionId: session.id },
    });
  } catch (e: any) {
    return apiError(e.message || "Internal error", 500);
  }
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}
