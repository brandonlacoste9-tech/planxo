import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * ElevenLabs Agent Configuration Endpoint
 * 
 * Manages ElevenLabs agent configuration for the current user.
 * Supports GET (retrieve), POST (create/update), and DELETE operations.
 */

// GET: Retrieve agent configuration
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Try to get existing agent config
    const { data, error } = await supabase
      .from("voice_agent_configs")
      .select("*")
      .eq("userId", user.id)
      .single();

    // Handle "no rows" error gracefully
    if (error && error.code === "PGRST116") {
      return NextResponse.json({
        agentConfig: null,
        message: "No agent configuration found. Create one to get started."
      });
    }

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      agentConfig: data,
      message: "Agent configuration retrieved successfully"
    });
  } catch (error: any) {
    console.error("[ElevenLabs Agent] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to retrieve agent configuration"
      },
      { status: 500 }
    );
  }
}

// POST: Create or update agent configuration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      agentId,
      agentName = "Planxo Appointment Scheduler",
      systemPrompt,
      voiceId,
      language = "en",
      isActive = true
    } = body;

    // Validate required fields
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: "agentId is required"
        },
        { status: 400 }
      );
    }

    // Check if config already exists
    const { data: existing } = await supabase
      .from("voice_agent_configs")
      .select("id")
      .eq("userId", user.id)
      .single();

    let result;
    if (existing) {
      // Update existing config
      const { data, error } = await supabase
        .from("voice_agent_configs")
        .update({
          agentId,
          agentName,
          systemPrompt,
          voiceId,
          language,
          isActive,
          updatedAt: new Date().toISOString()
        })
        .eq("userId", user.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new config
      const { data, error } = await supabase
        .from("voice_agent_configs")
        .insert({
          userId: user.id,
          agentId,
          agentName,
          systemPrompt,
          voiceId,
          language,
          isActive,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      agentConfig: result,
      message: existing ? "Agent configuration updated" : "Agent configuration created"
    });
  } catch (error: any) {
    console.error("[ElevenLabs Agent] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to save agent configuration"
      },
      { status: 500 }
    );
  }
}

// DELETE: Remove agent configuration
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from("voice_agent_configs")
      .delete()
      .eq("userId", user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Agent configuration deleted"
    });
  } catch (error: any) {
    console.error("[ElevenLabs Agent] DELETE error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete agent configuration"
      },
      { status: 500 }
    );
  }
}
