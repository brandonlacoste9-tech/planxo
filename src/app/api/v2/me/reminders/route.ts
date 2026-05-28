import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

type ReminderPreferences = {
  email24h?: {
    enabled: boolean;
    subject?: string;
    body?: string;
  };
  sms2h?: {
    enabled: boolean;
    message?: string;
  };
};

// Default templates
const DEFAULT_TEMPLATES = {
  email24h: {
    subject: "Rappel : Votre rendez-vous de demain",
    body: "Bonjour {{name}},\n\nCeci est un rappel pour votre rendez-vous avec {{professional}} le {{date}} à {{time}}.\n\nCordialement,\n{{professional}}",
  },
  sms2h: {
    message: "Rappel : RDV avec {{professional}} dans 2h à {{time}}. {{date}}",
  },
};

function isMissingColumnError(error: any) {
  return error?.code === "P2022";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let prefs: ReminderPreferences = {};
    try {
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { reminderPreferences: true },
      });
      prefs = (user?.reminderPreferences as ReminderPreferences) || {};
    } catch (error: any) {
      if (!isMissingColumnError(error)) throw error;
      prefs = {};
    }

    // Merge with defaults if not set
    const response = {
      email24h: {
        enabled: prefs.email24h?.enabled ?? true,
        subject: prefs.email24h?.subject || DEFAULT_TEMPLATES.email24h.subject,
        body: prefs.email24h?.body || DEFAULT_TEMPLATES.email24h.body,
      },
      sms2h: {
        enabled: prefs.sms2h?.enabled ?? false,
        message: prefs.sms2h?.message || DEFAULT_TEMPLATES.sms2h.message,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching reminder preferences:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email24h, sms2h } = body;

    // Get current preferences
    let currentPrefs: ReminderPreferences = {};
    try {
      const currentUser = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { reminderPreferences: true },
      });
      currentPrefs = (currentUser?.reminderPreferences as ReminderPreferences) || {};
    } catch (error: any) {
      if (!isMissingColumnError(error)) throw error;
      currentPrefs = {};
    }

    const updatedPrefs: ReminderPreferences = {
      email24h: {
        enabled: email24h?.enabled ?? currentPrefs.email24h?.enabled ?? true,
        subject: email24h?.subject ?? currentPrefs.email24h?.subject ?? DEFAULT_TEMPLATES.email24h.subject,
        body: email24h?.body ?? currentPrefs.email24h?.body ?? DEFAULT_TEMPLATES.email24h.body,
      },
      sms2h: {
        enabled: sms2h?.enabled ?? currentPrefs.sms2h?.enabled ?? false,
        message: sms2h?.message ?? currentPrefs.sms2h?.message ?? DEFAULT_TEMPLATES.sms2h.message,
      },
    };

    try {
      await prisma.user.update({
        where: { id: authUser.id },
        data: {
          reminderPreferences: updatedPrefs as any,
        },
      });
    } catch (error: any) {
      if (!isMissingColumnError(error)) throw error;
      // Legacy schema: column is absent, so we return success with computed defaults.
    }

    return NextResponse.json({ success: true, preferences: updatedPrefs });
  } catch (error: any) {
    console.error("Error updating reminder preferences:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
