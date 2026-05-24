import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      env: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'missing',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing'
      }
    };

    // Test 1: Get workflows
    const { data: workflows, error: workflowError } = await supabase
      .from('voice_workflows')
      .select('*')
      .eq('is_active', true);

    results.workflows = {
      count: workflows?.length || 0,
      error: workflowError?.message || null,
      data: workflows?.map(w => ({ id: w.id, name: w.name, user_id: w.user_id })) || []
    };

    if (workflows && workflows.length > 0) {
      const workflow = workflows[0];

      // Test 2: Get user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', workflow.user_id)
        .single();

      results.user = {
        found: !!userData,
        error: userError?.message || null,
        data: userData ? { id: userData.id, email: userData.email } : null
      };

      // Test 3: Get bookings in window
      const now = new Date();
      const triggerMinutes = workflow.trigger_timing;
      const windowStart = new Date(now.getTime() + (triggerMinutes - 30) * 60000);
      const windowEnd = new Date(now.getTime() + (triggerMinutes + 30) * 60000);

      const { data: bookings, error: bookingError } = await supabase
        .from('Booking')
        .select('id, startTime, endTime, status')
        .eq('userId', workflow.user_id)
        .gte('startTime', windowStart.toISOString())
        .lte('startTime', windowEnd.toISOString())
        .eq('status', 'accepted');

      results.bookings = {
        query: { windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString() },
        count: bookings?.length || 0,
        error: bookingError?.message || null,
        data: bookings || []
      };

      // Test 4: Check existing executions
      const { data: executions, error: execError } = await supabase
        .from('voice_workflow_executions')
        .select('*')
        .limit(5);

      results.executions = {
        count: executions?.length || 0,
        error: execError?.message || null,
        data: executions?.map(e => ({ id: e.id, status: e.status, booking_id: e.booking_id })) || []
      };
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
