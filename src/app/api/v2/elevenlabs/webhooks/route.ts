import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * ElevenLabs Webhook Handler
 * 
 * Receives post-call events from ElevenLabs agents and logs conversation data.
 * Verifies webhook signature for security.
 */

// Verify webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return hash === signature;
}

export async function POST(request: NextRequest) {
  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn("[ElevenLabs Webhooks] ELEVENLABS_WEBHOOK_SECRET not configured");
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-elevenlabs-signature");

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.warn("[ElevenLabs Webhooks] Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // Parse webhook payload
    const body = JSON.parse(rawBody);
    const {
      event_type,
      conversation_id,
      user_id,
      agent_id,
      transcript,
      status,
      duration_ms,
      metadata
    } = body;

    console.log(`[ElevenLabs Webhooks] Received ${event_type} event for conversation ${conversation_id}`);

    const supabase = await createClient();

    // Handle different event types
    switch (event_type) {
      case "conversation_completed":
        await handleConversationCompleted({
          supabase,
          conversationId: conversation_id,
          userId: user_id,
          agentId: agent_id,
          transcript,
          status,
          durationMs: duration_ms,
          metadata
        });
        break;

      case "conversation_started":
        await handleConversationStarted({
          supabase,
          conversationId: conversation_id,
          userId: user_id,
          agentId: agent_id
        });
        break;

      case "tool_called":
        console.log("[ElevenLabs Webhooks] Tool called:", metadata?.tool_name);
        break;

      default:
        console.log(`[ElevenLabs Webhooks] Unknown event type: ${event_type}`);
    }

    return NextResponse.json({
      success: true,
      message: `${event_type} processed`
    });
  } catch (error: any) {
    console.error("[ElevenLabs Webhooks] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Webhook processing failed"
      },
      { status: 500 }
    );
  }
}

/**
 * Handle conversation completed event
 */
async function handleConversationCompleted({
  supabase,
  conversationId,
  userId,
  agentId,
  transcript,
  status,
  durationMs,
  metadata
}: any) {
  try {
    // Format transcript for storage
    const formattedTranscript = transcript?.map((msg: any) => ({
      role: msg.role,
      text: msg.text,
      timestamp: msg.timestamp || new Date().toISOString()
    })) || [];

    // Try to insert conversation record
    const { error: insertError } = await supabase
      .from("voice_agent_conversations")
      .insert({
        userId,
        agentId,
        conversationId,
        transcript: formattedTranscript,
        status: status === "completed" ? "completed" : "failed",
        endTime: new Date().toISOString(),
        metadata: {
          durationMs,
          ...metadata
        }
      });

    if (insertError && insertError.code !== "23505") {
      // Ignore duplicate key errors
      throw insertError;
    }

    // Also log in voice_calls for backward compatibility
    const durationSeconds = Math.floor((durationMs || 0) / 1000);
    
    await supabase.from("voice_calls").insert({
      userId,
      callSid: conversationId,
      direction: "inbound",
      status: status === "completed" ? "completed" : "failed",
      purpose: "appointment_booking",
      transcript: formattedTranscript,
      context: metadata || {},
      startedAt: new Date(Date.now() - durationMs).toISOString(),
      endedAt: new Date().toISOString(),
      recordingDuration: durationSeconds
    }).catch((err) => {
      // Ignore if voice_calls table doesn't exist
      console.warn("[ElevenLabs Webhooks] Could not log to voice_calls:", err.message);
    });

    console.log(`[ElevenLabs Webhooks] Conversation ${conversationId} completed and logged`);
  } catch (error: any) {
    console.error("[ElevenLabs Webhooks] Error handling conversation_completed:", error);
    throw error;
  }
}

/**
 * Handle conversation started event
 */
async function handleConversationStarted({
  supabase,
  conversationId,
  userId,
  agentId
}: any) {
  try {
    // Create conversation record
    const { error } = await supabase
      .from("voice_agent_conversations")
      .insert({
        userId,
        agentId,
        conversationId,
        transcript: [],
        status: "active",
        startTime: new Date().toISOString()
      });

    if (error && error.code !== "23505") {
      // Ignore duplicate key errors
      throw error;
    }

    console.log(`[ElevenLabs Webhooks] Conversation ${conversationId} started`);
  } catch (error: any) {
    console.error("[ElevenLabs Webhooks] Error handling conversation_started:", error);
    throw error;
  }
}
