import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";
import { calculateQuebecTaxes } from "@/lib/taxEngine";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function normalizeSchedulingType(value: unknown): "individual" | "round_robin" | "collective" | "pooled" {
  if (typeof value !== "string") return "individual";
  const normalized = value.toLowerCase();
  if (normalized === "round_robin" || normalized === "collective" || normalized === "pooled") {
    return normalized;
  }
  return "individual";
}

function normalizeTeamMembers(value: unknown, fallbackUserId: string) {
  if (Array.isArray(value)) {
    const ids = value.filter((v): v is string => typeof v === "string" && v.length > 0);
    return ids.length ? ids : [fallbackUserId];
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  if (value && typeof value === "object" && "ids" in value && Array.isArray((value as { ids?: unknown[] }).ids)) {
    const ids = (value as { ids: unknown[] }).ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    return ids.length ? ids : [fallbackUserId];
  }
  return [fallbackUserId];
}

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
      const { data: user } = await supabase.from("users").select("id").eq("username", username || "planxo").single();
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

    // Calculate Quebec taxes (TPS 5% + TVQ 9.975%)
    const tax = calculateQuebecTaxes(et.price);

    const guestName = attendee?.name || "";
    const guestEmail = attendee?.email || "";
    if (!guestName || !guestEmail) return NextResponse.json({ error: "attendee.name and attendee.email required" }, { status: 400 });

    const schedulingType = normalizeSchedulingType(et.schedulingType);
    const teamIds = (schedulingType === "round_robin" || schedulingType === "collective" || schedulingType === "pooled")
      ? normalizeTeamMembers(et.teamMembers, et.userId)
      : [et.userId];

    const checkStart = new Date(startDate.getTime() - (et.bufferBefore || 0) * 60000);
    const checkEnd = new Date(endDate.getTime() + (et.bufferAfter || 0) * 60000);
    const { data: conflicts } = await supabase
      .from("Booking")
      .select("id,userId")
      .in("userId", teamIds)
      .neq("status", "cancelled")
      .neq("status", "CANCELLED")
      .lt("startTime", checkEnd.toISOString())
      .gt("endTime", checkStart.toISOString());

    const conflictedHostIds = new Set((conflicts || []).map((b: { userId: string }) => b.userId));
    let assignedHostId = et.userId;
    if (schedulingType === "collective") {
      if (conflictedHostIds.size > 0) {
        return NextResponse.json({ error: "Slot not available for all hosts" }, { status: 409 });
      }
    } else if (schedulingType === "round_robin" || schedulingType === "pooled") {
      const availableHosts = teamIds.filter((id) => !conflictedHostIds.has(id));
      if (!availableHosts.length) {
        return NextResponse.json({ error: "Slot not available" }, { status: 409 });
      }

      const { data: recentBookings } = await supabase
        .from("Booking")
        .select("userId")
        .in("userId", availableHosts)
        .neq("status", "cancelled")
        .neq("status", "CANCELLED")
        .gte("startTime", new Date(startDate.getTime() - 86400000).toISOString());

      const load: Record<string, number> = {};
      for (const id of availableHosts) load[id] = 0;
      for (const b of recentBookings || []) load[b.userId] = (load[b.userId] || 0) + 1;
      assignedHostId = availableHosts.reduce((a, b) => (load[a] ?? 0) <= (load[b] ?? 0) ? a : b);
    } else if (conflictedHostIds.has(et.userId)) {
      return NextResponse.json({ error: "Slot not available" }, { status: 409 });
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    // Look up username from userId (used for the booking page redirect URL)
    const { data: hostUser } = await supabase.from("users").select("username").eq("id", et.userId).single();
    const hostUsername = username || hostUser?.username || "planxo";

    const locationType = Array.isArray(et.locations) ? (et.locations[0]?.type || "google-meet") : "google-meet";

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
        {
          price_data: {
            currency: et.currency || "cad",
            product_data: { name: "TPS (5%)" },
            unit_amount: tax.tpsCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: et.currency || "cad",
            product_data: { name: "TVQ (9.975%)" },
            unit_amount: tax.tvqCents,
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
        userId: assignedHostId,
        lengthMinutes: String(lengthMin),
        basePriceCents: String(et.price),
        tpsCents: String(tax.tpsCents),
        tvqCents: String(tax.tvqCents),
        totalCents: String(tax.totalCents),
        eventTitle: et.title,
        hostUsername,
        locationType,
      },
      success_url: `${origin}/${hostUsername}/${et.slug}?booking=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${hostUsername}/${et.slug}?booking=cancelled`,
    });

    return NextResponse.json({
      status: "success",
      data: { checkoutUrl: session.url, sessionId: session.id },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
