import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const calledNumber = formData.get('Called') as string;
  const callerNumber = formData.get('Caller') as string;
  const callSid = formData.get('CallSid') as string;
  
  // Find which user owns this phone number
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: user } = await supabase
    .from('users')
    .select('id, name, username')
    .eq('phoneNumber', calledNumber)
    .single();
  
  // Generate TwiML for streaming
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${req.headers.get('host')}/api/voice/stream">
      <Parameter name="userId" value="${user?.id || ''}"/>
      <Parameter name="professionalName" value="${user?.name || ''}"/>
      <Parameter name="callerNumber" value="${callerNumber}"/>
      <Parameter name="callSid" value="${callSid}"/>
    </Stream>
  </Connect>
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

// Status callback for call tracking
export async function PUT(req: NextRequest) {
  const formData = await req.formData();
  const callSid = formData.get('CallSid') as string;
  const callStatus = formData.get('CallStatus') as string;
  const recordingUrl = formData.get('RecordingUrl') as string;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Update call record in database
  await supabase
    .from('voice_calls')
    .update({
      status: callStatus,
      recordingUrl,
      endedAt: callStatus === 'completed' ? new Date().toISOString() : null,
    })
    .eq('callSid', callSid);
  
  return NextResponse.json({ success: true });
}
