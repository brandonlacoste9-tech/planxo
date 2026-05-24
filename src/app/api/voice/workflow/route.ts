import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Trigger automated voice calls for reminders, no-shows, etc.
export async function POST(req: NextRequest) {
  try {
    const { triggerType, bookingId, userId } = await req.json();
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, start, end, status,
        attendees:attendeeEmail, attendeeName, attendeePhone,
        eventType:eventTypeId(title, length, location),
        user:userId(name, phoneNumber)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check if attendee has phone number
    if (!booking.attendeePhone) {
      return NextResponse.json({ error: 'No phone number for attendee' }, { status: 400 });
    }

    // Determine message based on trigger type
    let purpose: string;
    let customParams: Record<string, string> = {};
    const userArr = booking.user as any[];
    const userName = userArr?.[0]?.name || 'votre professionnel';

    switch (triggerType) {
      case 'booking_reminder':
        purpose = 'reminder';
        customParams = {
          message: `Bonjour ${booking.attendeeName}, je vous appelle pour vous rappeler de votre rendez-vous demain avec ${userName}.`,
        };
        break;
      case 'no_show_followup':
        purpose = 'no_show_followup';
        customParams = {
          message: `Bonjour ${booking.attendeeName}, nous avons remarqué que vous avez manqué votre rendez-vous. Souhaitez-vous le reprogrammer?`,
        };
        break;
      case 'post_booking_confirm':
        purpose = 'confirmation';
        customParams = {
          message: `Bonjour ${booking.attendeeName}, votre rendez-vous avec ${userName} est confirmé.`,
        };
        break;
      default:
        return NextResponse.json({ error: 'Invalid trigger type' }, { status: 400 });
    }

    // Trigger outbound call
    const callResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/voice/outbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: booking.attendeePhone,
        userId,
        bookingId,
        purpose,
        professionalName: userName,
      }),
    });

    if (!callResponse.ok) {
      const error = await callResponse.json();
      throw new Error(error.error || 'Failed to initiate call');
    }

    const callData = await callResponse.json();

    return NextResponse.json({
      success: true,
      callSid: callData.callSid,
      message: `Call initiated to ${booking.attendeePhone}`,
    });

  } catch (error: any) {
    console.error('Workflow trigger error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check scheduled calls and trigger them
// This would be called by a cron job
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find bookings that need reminder calls (24h before)
    const reminderThreshold = new Date();
    reminderThreshold.setHours(reminderThreshold.getHours() + 24);
    
    const { data: bookingsNeedingReminders, error } = await supabase
      .from('bookings')
      .select(`
        id, start, attendeeName, attendeePhone, userId,
        user:userId(name, phoneNumber, voiceAgentEnabled)
      `)
      .eq('status', 'confirmed')
      .gt('start', new Date().toISOString())
      .lt('start', reminderThreshold.toISOString())
      .not('attendeePhone', 'is', null)
      .eq('user.voiceAgentEnabled', true);

    if (error) {
      throw error;
    }

    // Trigger calls for each booking
    const results = [];
    for (const booking of bookingsNeedingReminders || []) {
      const userData = Array.isArray(booking.user) ? booking.user[0] : booking.user;
      if (!userData?.voiceAgentEnabled) continue;
      
      // Check if we already called this person
      const { data: existingCalls } = await supabase
        .from('voice_calls')
        .select('id')
        .eq('bookingId', booking.id)
        .eq('purpose', 'reminder')
        .gte('createdAt', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

      if (existingCalls && existingCalls.length > 0) {
        continue; // Already reminded
      }

      // Trigger the call
      const result = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/voice/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerType: 'booking_reminder',
          bookingId: booking.id,
          userId: booking.userId,
        }),
      });

      results.push({
        bookingId: booking.id,
        success: result.ok,
      });
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
