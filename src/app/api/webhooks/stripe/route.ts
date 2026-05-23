import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (e: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${e.message}` }, { status: 400 });
  }

  // Handle checkout.session.completed — create the booking
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata;
    if (!meta) return NextResponse.json({ error: "No metadata" }, { status: 400 });

    const bookingId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Generate meeting URL
    const locationType = meta.locationType || "google-meet";
    let meetingUrl: string | null = null;
    const randStr = () => {
      const c = "abcdefghijklmnopqrstuvwxyz";
      let r = "";
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 4; j++) r += c[Math.floor(Math.random() * c.length)];
        if (i < 2) r += "-";
      }
      return r;
    };

    if (locationType === "google-meet") meetingUrl = `https://meet.google.com/${randStr()}`;
    else if (locationType === "zoom") meetingUrl = `https://zoom.us/j/${Math.floor(Math.random() * 9999999999)}`;

    const { error } = await supabase.from("Booking").insert({
      id: bookingId,
      eventTypeId: meta.eventTypeId,
      userId: meta.userId,
      guestName: meta.guestName,
      guestEmail: meta.guestEmail,
      guestNotes: meta.guestNotes || "",
      startTime: meta.startTime,
      endTime: meta.endTime,
      status: "confirmed",
      paid: true,
      basePriceCents: parseInt(meta.basePriceCents || "0"),
      tpsCents: parseInt(meta.tpsCents || "0"),
      tvqCents: parseInt(meta.tvqCents || "0"),
      totalCents: parseInt(meta.totalCents || "0"),
      meetingUrl,
      updatedAt: now,
    });

    if (error) {
      console.error("Failed to create booking:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire webhooks if any
    const { data: webhooks } = await supabase
      .from("Webhook")
      .select("*")
      .eq("userId", meta.userId)
      .eq("isActive", true);

    for (const wh of webhooks || []) {
      if (wh.events.includes("booking.created")) {
        fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "booking.created",
            booking: { id: bookingId, guestName: meta.guestName, start: meta.startTime, paid: true },
          }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ status: "success", data: { bookingId } });
  }

  // Handle other events
  return NextResponse.json({ status: "received", type: event.type });
}
