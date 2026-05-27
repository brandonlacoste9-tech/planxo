'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Server Actions for ElevenLabs Agent Management
 * 
 * These functions handle ElevenLabs agent configuration on the server side.
 */

export interface AgentConfig {
  id: string;
  userId: string;
  agentId: string;
  agentName: string;
  systemPrompt?: string;
  voiceId?: string;
  language: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get the current user's ElevenLabs agent configuration
 */
export async function getAgentConfig(): Promise<AgentConfig | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('voice_agent_configs')
      .select('*')
      .eq('userId', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // No rows found
      return null;
    }

    if (error) {
      throw error;
    }

    return data as AgentConfig;
  } catch (error: any) {
    console.error('[ElevenLabs] Error getting agent config:', error);
    throw error;
  }
}

/**
 * Save or update ElevenLabs agent configuration
 */
export async function saveAgentConfig(
  config: Partial<AgentConfig>
): Promise<AgentConfig> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    if (!config.agentId) {
      throw new Error('agentId is required');
    }

    // Check if config exists
    const { data: existing } = await supabase
      .from('voice_agent_configs')
      .select('id')
      .eq('userId', user.id)
      .single();

    const now = new Date().toISOString();
    const configData = {
      userId: user.id,
      agentId: config.agentId,
      agentName: config.agentName || 'Planxo Appointment Scheduler',
      systemPrompt: config.systemPrompt,
      voiceId: config.voiceId,
      language: config.language || 'en',
      isActive: config.isActive !== false,
      updatedAt: now,
      ...(existing ? {} : { createdAt: now })
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('voice_agent_configs')
        .update(configData)
        .eq('userId', user.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('voice_agent_configs')
        .insert(configData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return result as AgentConfig;
  } catch (error: any) {
    console.error('[ElevenLabs] Error saving agent config:', error);
    throw error;
  }
}

/**
 * Delete ElevenLabs agent configuration
 */
export async function deleteAgentConfig(): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { error } = await supabase
      .from('voice_agent_configs')
      .delete()
      .eq('userId', user.id);

    if (error) throw error;
  } catch (error: any) {
    console.error('[ElevenLabs] Error deleting agent config:', error);
    throw error;
  }
}

/**
 * Get conversation history for the current user
 */
export async function getConversationHistory(limit: number = 10) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('voice_agent_conversations')
      .select('*')
      .eq('userId', user.id)
      .order('startTime', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error: any) {
    console.error('[ElevenLabs] Error getting conversation history:', error);
    throw error;
  }
}

/**
 * Get a specific conversation by ID
 */
export async function getConversation(conversationId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('voice_agent_conversations')
      .select('*')
      .eq('conversationId', conversationId)
      .eq('userId', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  } catch (error: any) {
    console.error('[ElevenLabs] Error getting conversation:', error);
    throw error;
  }
}

/**
 * Get conversation statistics for the current user
 */
export async function getConversationStats() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get total conversations
    const { count: totalConversations } = await supabase
      .from('voice_agent_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('userId', user.id);

    // Get completed conversations
    const { count: completedConversations } = await supabase
      .from('voice_agent_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('userId', user.id)
      .eq('status', 'completed');

    // Get failed conversations
    const { count: failedConversations } = await supabase
      .from('voice_agent_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('userId', user.id)
      .eq('status', 'failed');

    return {
      totalConversations: totalConversations || 0,
      completedConversations: completedConversations || 0,
      failedConversations: failedConversations || 0,
      successRate: totalConversations
        ? ((completedConversations || 0) / totalConversations * 100).toFixed(1)
        : 0
    };
  } catch (error: any) {
    console.error('[ElevenLabs] Error getting conversation stats:', error);
    throw error;
  }
}
