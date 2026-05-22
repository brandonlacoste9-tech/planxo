import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventTypeId, eventTypeSlug, start, attendee, metadata, username } = body;

    // Resolve event type
    let et: any = null;
    if (eventTypeId) {
      const { data } = await supabase.from("EventType").select("*").eq("id", eventTypeId).single();
      et = data;
    } else if (eventTypeSlug) {
      const { data: user } = await supabase.from("User").select("id").eq("username", username || "planxo").single();
      if (user) {
        const { data } = await supabase.from("EventType").select("*").eq("slug", eventTypeSlug).eq("userId", user.id).single();
        et = data;
      }
    }

    if (!et) return NextResponse.json({ error: "Event type not found" }, { status: 404 });
    if (!et.isActive) return NextResponse.json({ error: "Event type not available" }, { status: 404 });
    if (et.price === 0) return NextResponse.json({ error: "This event type is free — book directly via POST /api/v2/bookings" }, { status: 400 });

    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) return NextResponse.json({ error: "Invalid start time" }, { status: 400 });

    const lengthMin = body.lengthInMinutes || et.length;
    const endDate = new Date(startDate.getTime() + lengthMin * 60000);

    const guestName = attendee?.name || "";
    const guestEmail = attendee?.email || "";
    if (!guestName || !guestEmail) return NextResponse.json({ error: "attendee.name and attendee.email required" }, { status: 400 });

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from("Booking").select("id").eq("eventTypeId", et.id)
      .neq("status", "cancelled")
      .lt("startTime", endDate.toISOString())
      .gt("endTime", startDate.toISOString())
      .limit(1);

    if (conflicts?.length) return NextResponse.json({ error: "Slot not available" }, { status: 409 });

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: guestEmail,
      line_items: [
        {
          price_data: {
            currency: et.currency || "cad",
            product_data: {
              name: et.title,
              description: `${new Date(start).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${new Date(start).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })} (${lengthMin} min)`,
            },
            unit_amount: et.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        eventTypeId: et.id,
        eventTypeSlug: et.slug,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        guestName,
        guestEmail,
        guestNotes: metadata?.notes || "",
        guestTimezone: attendee?.timeZone || "UTC",
        userId: et.userId,
        lengthMinutes: String(lengthMin),
      },
      success_url: `${origin}/${et.slug}?booking=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${et.slug}?booking=cancelled`,
    });

    return NextResponse.json({
      status: "success",
      data: { checkoutUrl: session.url, sessionId: session.id },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
