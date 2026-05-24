import { NextRequest, NextResponse } from 'next/server';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER!;

// Trigger an outbound call (for reminders, no-shows, etc.)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { to, userId, purpose, bookingId, professionalName } = body;

  if (!to || !purpose) {
    return NextResponse.json(
      { error: 'Missing required fields: to, purpose' },
      { status: 400 }
    );
  }

  try {
    // Create call via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    
    const formData = new URLSearchParams({
      To: to,
      From: TWILIO_PHONE_NUMBER,
      Url: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/twiml?purpose=${purpose}&userId=${userId}&professionalName=${encodeURIComponent(professionalName || '')}&bookingId=${bookingId || ''}`,
      StatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/status`,
      StatusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'].join(' '),
      StatusCallbackMethod: 'POST',
      MachineDetection: 'Enable',
      AsyncAmd: 'true',
    });

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio error: ${error}`);
    }

    const callData = await response.json();

    // Store call record in database
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from('voice_calls').insert({
      callSid: callData.sid,
      userId,
      bookingId,
      purpose,
      to,
      from: TWILIO_PHONE_NUMBER,
      status: 'queued',
      direction: 'outbound',
      professionalName,
    });

    return NextResponse.json({
      success: true,
      callSid: callData.sid,
    });

  } catch (error: any) {
    console.error('Outbound call error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
