import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This endpoint runs via cron job to schedule and execute workflow calls
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret or authorization
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Also allow internal calls without auth for testing
      const isInternal = req.headers.get('x-internal') === 'true';
      if (!isInternal) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const results = {
      scheduled: 0,
      executed: 0,
      failed: 0,
      workflowsChecked: 0,
      details: [] as any[]
    };

    // Get all active workflows
    const { data: workflows, error: workflowError } = await supabase
      .from('voice_workflows')
      .select('*')
      .eq('is_active', true);

    if (workflowError) {
      console.error('Error fetching workflows:', workflowError);
      return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
    }

    results.workflowsChecked = workflows?.length || 0;

    // Process each workflow
    for (const workflow of workflows || []) {
      try {
        // Get user info separately
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, raw_user_meta_data')
          .eq('id', workflow.user_id)
          .single();

        if (!userData) continue;

        // Get professional name from user metadata
        const userMeta = userData.raw_user_meta_data || {};
        const professionalName = userMeta.name || userMeta.full_name || 'Planxo';

        // Find bookings that match this workflow's criteria
        const scheduledCount = await scheduleWorkflowExecutions(
          workflow,
          professionalName
        );

        results.scheduled += scheduledCount;
        results.details.push({
          workflowId: workflow.id,
          name: workflow.name,
          scheduled: scheduledCount
        });
      } catch (err) {
        console.error(`Error processing workflow ${workflow.id}:`, err);
        results.failed++;
      }
    }

    // Now execute any pending executions that are due
    const executedCount = await executePendingCalls();
    results.executed = executedCount;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    console.error('Workflow executor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function scheduleWorkflowExecutions(workflow: any, professionalName: string): Promise<number> {
  let scheduledCount = 0;
  const now = new Date();
  
  const triggerMinutes = workflow.trigger_timing;
  
  // Find bookings in the relevant time window
  let bookingQuery = supabase
    .from('Booking')
    .select('*')
    .eq('userId', workflow.user_id);

  // Apply event type filter if specified
  if (workflow.event_type_ids && workflow.event_type_ids.length > 0) {
    bookingQuery = bookingQuery.in('eventTypeId', workflow.event_type_ids);
  }

  // Get bookings based on trigger type
  if (triggerMinutes > 0) {
    // Reminder: bookings happening in the future
    const windowStart = new Date(now.getTime() + (triggerMinutes - 30) * 60000);
    const windowEnd = new Date(now.getTime() + (triggerMinutes + 30) * 60000);
    
    bookingQuery = bookingQuery
      .gte('startTime', windowStart.toISOString())
      .lte('startTime', windowEnd.toISOString())
      .eq('status', 'accepted');
  } else {
    // Follow-up: bookings that ended recently
    const minutesAgo = Math.abs(triggerMinutes);
    const windowStart = new Date(now.getTime() - (minutesAgo + 30) * 60000);
    const windowEnd = new Date(now.getTime() - (minutesAgo - 30) * 60000);
    
    bookingQuery = bookingQuery
      .gte('endTime', windowStart.toISOString())
      .lte('endTime', windowEnd.toISOString());
  }

  const { data: bookings, error: bookingError } = await bookingQuery;

  if (bookingError) {
    console.error('Error fetching bookings:', bookingError);
    return 0;
  }

  // Schedule executions for each booking
  for (const booking of bookings || []) {
    try {
      // Check if we already have a pending execution for this booking/workflow
      const { data: existingExec } = await supabase
        .from('voice_workflow_executions')
        .select('id')
        .eq('workflow_id', workflow.id)
        .eq('booking_id', String(booking.id))
        .in('status', ['pending', 'executed'])
        .maybeSingle();

      if (existingExec) {
        continue;
      }

      // Calculate when to make the call
      let scheduledFor: Date;
      if (triggerMinutes > 0) {
        const bookingStart = new Date(booking.startTime);
        scheduledFor = new Date(bookingStart.getTime() - triggerMinutes * 60000);
      } else {
        const bookingEnd = new Date(booking.endTime);
        scheduledFor = new Date(bookingEnd.getTime() + Math.abs(triggerMinutes) * 60000);
      }

      // Don't schedule if it's in the past
      if (scheduledFor < now) {
        scheduledFor = new Date(now.getTime() + 60000);
      }

      // Create execution record
      const { error: execError } = await supabase
        .from('voice_workflow_executions')
        .insert({
          workflow_id: workflow.id,
          booking_id: String(booking.id),
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending'
        });

      if (execError) {
        console.error('Error creating execution:', execError);
        continue;
      }

      scheduledCount++;
    } catch (err) {
      console.error('Error scheduling execution for booking:', booking.id, err);
    }
  }

  return scheduledCount;
}

async function executePendingCalls(): Promise<number> {
  const now = new Date();
  let executedCount = 0;

  // Get pending executions that are due
  const { data: pendingExecutions, error } = await supabase
    .from('voice_workflow_executions')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .limit(50);

  if (error) {
    console.error('Error fetching pending executions:', error);
    return 0;
  }

  // Execute each pending call
  for (const execution of pendingExecutions || []) {
    try {
      // Get workflow details
      const { data: workflow } = await supabase
        .from('voice_workflows')
        .select('*')
        .eq('id', execution.workflow_id)
        .single();

      // Get booking details
      const { data: booking } = await supabase
        .from('Booking')
        .select('*')
        .eq('id', execution.booking_id)
        .single();
      
      if (!workflow || !booking) {
        await markExecutionFailed(execution.id, 'Missing workflow or booking data');
        continue;
      }

      // Check if user has enough credits
      const { data: creditData } = await supabase
        .from('voice_credits')
        .select('balance')
        .eq('user_id', workflow.user_id)
        .single();

      const balance = creditData?.balance || 0;
      if (balance < 15) {
        await markExecutionFailed(execution.id, 'Insufficient credits');
        continue;
      }

      // Get attendee phone - try smsReminderNumber first, then responses
      const attendeePhone = booking.smsReminderNumber || 
        (booking.responses && typeof booking.responses === 'object' ? booking.responses.phone : null);
      
      if (!attendeePhone) {
        await markExecutionFailed(execution.id, 'No phone number for attendee');
        continue;
      }

      // Get user info for professional name
      const { data: userData } = await supabase
        .from('users')
        .select('raw_user_meta_data')
        .eq('id', workflow.user_id)
        .single();

      const userMeta = userData?.raw_user_meta_data || {};
      const professionalName = userMeta.name || userMeta.full_name || 'Planxo';

      // Get event type info
      const { data: eventType } = await supabase
        .from('EventType')
        .select('title')
        .eq('id', booking.eventTypeId)
        .single();

      // Prepare message with variables replaced
      const attendeeName = (booking.responses && typeof booking.responses === 'object' ? booking.responses.name : null) || 'there';
      const message = replaceMessageVariables(
        workflow.message_template,
        {
          attendeeName: attendeeName,
          eventTitle: eventType?.title || 'appointment',
          eventDate: formatDate(booking.startTime),
          eventTime: formatTime(booking.startTime),
          professionalName: professionalName
        }
      );

      // Trigger outbound call
      const callResult = await triggerOutboundCall({
        to: attendeePhone,
        userId: workflow.user_id,
        workflowExecutionId: execution.id,
        customMessage: message,
        professionalName: professionalName,
        eventTypeId: booking.eventTypeId
      });

      if (callResult.success) {
        // Update execution record
        await supabase
          .from('voice_workflow_executions')
          .update({
            status: 'executed',
            executed_at: new Date().toISOString(),
            call_sid: callResult.callSid
          })
          .eq('id', execution.id);

        // Update workflow trigger count
        await supabase
          .from('voice_workflows')
          .update({
            trigger_count: workflow.trigger_count + 1,
            last_triggered_at: new Date().toISOString()
          })
          .eq('id', workflow.id);

        executedCount++;
      } else {
        await markExecutionFailed(execution.id, callResult.error || 'Call failed');
      }
    } catch (err) {
      console.error('Error executing call:', err);
      await markExecutionFailed(execution.id, 'Internal error');
    }
  }

  return executedCount;
}

async function markExecutionFailed(executionId: string, errorMessage: string) {
  await supabase
    .from('voice_workflow_executions')
    .update({
      status: 'failed',
      error_message: errorMessage,
      executed_at: new Date().toISOString()
    })
    .eq('id', executionId);
}

function replaceMessageVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long'
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

async function triggerOutboundCall(params: {
  to: string;
  userId: string;
  workflowExecutionId: string;
  customMessage: string;
  professionalName: string;
  eventTypeId?: string;
}): Promise<{ success: boolean; callSid?: string; error?: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/voice/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`
      },
      body: JSON.stringify({
        to: params.to,
        userId: params.userId,
        purpose: 'workflow_call',
        workflowExecutionId: params.workflowExecutionId,
        customMessage: params.customMessage,
        professionalName: params.professionalName,
        eventTypeId: params.eventTypeId
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, callSid: data.callSid };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// GET endpoint for manual triggering/testing
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return POST(req);
}
