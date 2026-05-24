import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface VoiceWorkflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  triggerType: 'booking_reminder' | 'no_show_followup' | 'post_meeting' | 'custom';
  triggerTiming: number; // minutes
  eventTypeIds?: string[];
  minDuration?: number;
  actionType: 'ai_phone_call';
  messageTemplate: string;
  voiceProvider: 'custom' | 'retell';
  voiceId?: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  bookingId: string;
  scheduledFor: string;
  executedAt?: string;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  callSid?: string;
  creditsUsed?: number;
  errorMessage?: string;
}

// Available workflow templates
export const WORKFLOW_TEMPLATES = [
  {
    id: 'booking_reminder',
    name: 'Booking Reminder',
    description: 'Call attendees before their appointment',
    defaultTiming: 1440, // 24 hours
    timingLabel: 'hours before',
    defaultMessage: 'Bonjour {{attendeeName}}, ceci est un rappel de Planxo. Vous avez un rendez-vous "{{eventTitle}}" prévu le {{eventDate}} à {{eventTime}}. Répondez oui pour confirmer.'
  },
  {
    id: 'no_show_followup',
    name: 'No-Show Follow-up',
    description: 'Call after a missed appointment',
    defaultTiming: -15, // 15 minutes after
    timingLabel: 'minutes after',
    defaultMessage: 'Bonjour {{attendeeName}}, nous avons remarqué que vous avez manqué votre rendez-vous {{eventTitle}} prévu à {{eventTime}}. Souhaitez-vous reprogrammer?'
  },
  {
    id: 'post_meeting',
    name: 'Post-Meeting Survey',
    description: 'Call after meeting ends',
    defaultTiming: -30, // 30 minutes after
    timingLabel: 'minutes after',
    defaultMessage: 'Bonjour {{attendeeName}}, merci d\'avoir participé à notre rencontre {{eventTitle}}. Avez-vous quelques minutes pour un court sondage?'
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Create your own workflow',
    defaultTiming: 60,
    timingLabel: 'minutes',
    defaultMessage: 'Bonjour {{attendeeName}}, ceci est un message de {{professionalName}} concernant votre rendez-vous.'
  }
];

// Available message variables
export const MESSAGE_VARIABLES = [
  { key: '{{attendeeName}}', description: 'Name of the attendee' },
  { key: '{{eventTitle}}', description: 'Title of the event type' },
  { key: '{{eventDate}}', description: 'Date of the booking (e.g., "12 juin")' },
  { key: '{{eventTime}}', description: 'Time of the booking (e.g., "14h30")' },
  { key: '{{professionalName}}', description: 'Your name' }
];

// Get all workflows for a user
export async function getWorkflows(userId: string): Promise<VoiceWorkflow[]> {
  const { data, error } = await supabase
    .from('voice_workflows')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map(w => ({
    id: w.id,
    userId: w.user_id,
    name: w.name,
    description: w.description,
    triggerType: w.trigger_type,
    triggerTiming: w.trigger_timing,
    eventTypeIds: w.event_type_ids,
    minDuration: w.min_duration,
    actionType: w.action_type,
    messageTemplate: w.message_template,
    voiceProvider: w.voice_provider,
    voiceId: w.voice_id,
    isActive: w.is_active,
    lastTriggeredAt: w.last_triggered_at,
    triggerCount: w.trigger_count,
    createdAt: w.created_at,
    updatedAt: w.updated_at
  }));
}

// Get a single workflow
export async function getWorkflow(workflowId: string): Promise<VoiceWorkflow | null> {
  const { data, error } = await supabase
    .from('voice_workflows')
    .select('*')
    .eq('id', workflowId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    triggerType: data.trigger_type,
    triggerTiming: data.trigger_timing,
    eventTypeIds: data.event_type_ids,
    minDuration: data.min_duration,
    actionType: data.action_type,
    messageTemplate: data.message_template,
    voiceProvider: data.voice_provider,
    voiceId: data.voice_id,
    isActive: data.is_active,
    lastTriggeredAt: data.last_triggered_at,
    triggerCount: data.trigger_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

// Create a new workflow
export async function createWorkflow(
  userId: string,
  workflow: Omit<VoiceWorkflow, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'triggerCount' | 'lastTriggeredAt'>
): Promise<VoiceWorkflow | null> {
  const { data, error } = await supabase
    .from('voice_workflows')
    .insert({
      user_id: userId,
      name: workflow.name,
      description: workflow.description,
      trigger_type: workflow.triggerType,
      trigger_timing: workflow.triggerTiming,
      event_type_ids: workflow.eventTypeIds,
      min_duration: workflow.minDuration,
      action_type: workflow.actionType,
      message_template: workflow.messageTemplate,
      voice_provider: workflow.voiceProvider,
      voice_id: workflow.voiceId,
      is_active: workflow.isActive
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating workflow:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    triggerType: data.trigger_type,
    triggerTiming: data.trigger_timing,
    eventTypeIds: data.event_type_ids,
    minDuration: data.min_duration,
    actionType: data.action_type,
    messageTemplate: data.message_template,
    voiceProvider: data.voice_provider,
    voiceId: data.voice_id,
    isActive: data.is_active,
    lastTriggeredAt: data.last_triggered_at,
    triggerCount: data.trigger_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

// Update a workflow
export async function updateWorkflow(
  workflowId: string,
  updates: Partial<VoiceWorkflow>
): Promise<boolean> {
  const { error } = await supabase
    .from('voice_workflows')
    .update({
      name: updates.name,
      description: updates.description,
      trigger_type: updates.triggerType,
      trigger_timing: updates.triggerTiming,
      event_type_ids: updates.eventTypeIds,
      min_duration: updates.minDuration,
      message_template: updates.messageTemplate,
      voice_provider: updates.voiceProvider,
      voice_id: updates.voiceId,
      is_active: updates.isActive,
      updated_at: new Date().toISOString()
    })
    .eq('id', workflowId);

  if (error) {
    console.error('Error updating workflow:', error);
    return false;
  }

  return true;
}

// Delete a workflow
export async function deleteWorkflow(workflowId: string): Promise<boolean> {
  const { error } = await supabase
    .from('voice_workflows')
    .delete()
    .eq('id', workflowId);

  if (error) {
    console.error('Error deleting workflow:', error);
    return false;
  }

  return true;
}

// Toggle workflow active status
export async function toggleWorkflowStatus(workflowId: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('voice_workflows')
    .update({ is_active: isActive })
    .eq('id', workflowId);

  if (error) {
    console.error('Error toggling workflow:', error);
    return false;
  }

  return true;
}

// Get execution history
export async function getWorkflowExecutions(
  workflowId: string,
  limit: number = 50
): Promise<WorkflowExecution[]> {
  const { data, error } = await supabase
    .from('voice_workflow_executions')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(e => ({
    id: e.id,
    workflowId: e.workflow_id,
    bookingId: e.booking_id,
    scheduledFor: e.scheduled_for,
    executedAt: e.executed_at,
    status: e.status,
    callSid: e.call_sid,
    creditsUsed: e.credits_used,
    errorMessage: e.error_message
  }));
}

// Preview message with variables replaced
export function previewMessage(
  template: string,
  variables: Record<string, string>
): string {
  let preview = template;
  for (const [key, value] of Object.entries(variables)) {
    preview = preview.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  return preview;
}
