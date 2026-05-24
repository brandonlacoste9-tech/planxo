'use client';

import { useState, useEffect } from 'react';
import { WORKFLOW_TEMPLATES, MESSAGE_VARIABLES, previewMessage } from '../../../../lib/voice/workflows';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_timing: number;
  message_template: string;
  is_active: boolean;
  trigger_count: number;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(WORKFLOW_TEMPLATES[0]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerTiming: WORKFLOW_TEMPLATES[0].defaultTiming,
    messageTemplate: WORKFLOW_TEMPLATES[0].defaultMessage
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

  async function fetchWorkflows() {
    try {
      const res = await fetch('/api/voice/workflows');
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows || []);
      }
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createWorkflow(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    
    try {
      const res = await fetch('/api/voice/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          triggerType: selectedTemplate.id,
          triggerTiming: formData.triggerTiming,
          messageTemplate: formData.messageTemplate,
          voiceProvider: 'custom',
          isActive: true
        })
      });

      if (res.ok) {
        setShowCreate(false);
        setFormData({
          name: '',
          description: '',
          triggerTiming: WORKFLOW_TEMPLATES[0].defaultTiming,
          messageTemplate: WORKFLOW_TEMPLATES[0].defaultMessage
        });
        fetchWorkflows();
      }
    } catch (err) {
      console.error('Failed to create workflow:', err);
    } finally {
      setCreating(false);
    }
  }

  async function toggleWorkflow(id: string, currentStatus: boolean) {
    try {
      const res = await fetch(`/api/voice/workflows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (res.ok) {
        fetchWorkflows();
      }
    } catch (err) {
      console.error('Failed to toggle workflow:', err);
    }
  }

  function formatTiming(timing: number): string {
    if (timing >= 1440) {
      return `${Math.floor(timing / 1440)} days before`;
    } else if (timing >= 60) {
      return `${Math.floor(timing / 60)} hours before`;
    } else if (timing > 0) {
      return `${timing} minutes before`;
    } else if (timing < 0) {
      return `${Math.abs(timing)} minutes after`;
    }
    return 'At event time';
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <a href="/dashboard/voice" style={{ color: '#6b7280', textDecoration: 'none' }}>
          ← Back to Voice Agent
        </a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700 }}>Call Workflows</h1>
            <p style={{ color: '#6b7280' }}>Automate AI phone calls based on triggers</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '12px 24px',
              background: '#242424',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Create Workflow
          </button>
        </div>
      </div>

      {/* Workflows List */}
      {loading ? (
        <p>Loading...</p>
      ) : workflows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#f9fafb', borderRadius: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📩</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No workflows yet</h3>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>
            Create your first automated call workflow
          </p>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '12px 24px',
              background: '#242424',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Create Workflow
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 24
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600 }}>{workflow.name}</h3>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      background: workflow.is_active ? '#d1fae5' : '#f3f4f6',
                      color: workflow.is_active ? '#065f46' : '#6b7280'
                    }}>
                      {workflow.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p style={{ color: '#6b7280', marginBottom: 8 }}>{workflow.description}</p>
                  <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#6b7280' }}>
                    <span>🕐 {formatTiming(workflow.trigger_timing)}</span>
                    <span>📞 {workflow.trigger_count} calls made</span>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={workflow.is_active}
                    onChange={() => toggleWorkflow(workflow.id, workflow.is_active)}
                    style={{ marginRight: 8 }}
                  />
                  {workflow.is_active ? 'On' : 'Off'}
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            padding: 32,
            maxWidth: 600,
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Create Workflow</h2>
            
            <form onSubmit={createWorkflow}>
              {/* Template Selection */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Template</label>
                <div style={{ display: 'grid', gap: 12 }}>
                  {WORKFLOW_TEMPLATES.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setFormData(prev => ({
                          ...prev,
                          triggerTiming: template.defaultTiming,
                          messageTemplate: template.defaultMessage
                        }));
                      }}
                      style={{
                        padding: 16,
                        border: `2px solid ${selectedTemplate.id === template.id ? '#242424' : '#e5e7eb'}`,
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: selectedTemplate.id === template.id ? '#f9fafb' : '#fff'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{template.name}</div>
                      <div style={{ fontSize: 14, color: '#6b7280' }}>{template.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Workflow Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 24h Booking Reminder"
                  required
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                />
              </div>

              {/* Timing */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
                  Timing ({selectedTemplate.timingLabel})
                </label>
                <input
                  type="number"
                  value={formData.triggerTiming}
                  onChange={(e) => setFormData({ ...formData, triggerTiming: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                />
              </div>

              {/* Message Template */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Message Template</label>
                <textarea
                  value={formData.messageTemplate}
                  onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 16,
                    resize: 'vertical'
                  }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                  Variables: {MESSAGE_VARIABLES.map(v => v.key).join(', ')}
                </div>
              </div>

              {/* Preview */}
              <div style={{ marginBottom: 24, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>
                  Preview
                </div>
                <div style={{ fontStyle: 'italic', color: '#374151' }}>
                  {previewMessage(formData.messageTemplate, {
                    '{{attendeeName}}': 'Marie',
                    '{{eventTitle}}': 'Consultation',
                    '{{eventDate}}': '15 juin',
                    '{{eventTime}}': '14h30',
                    '{{professionalName}}': 'Dr. Smith'
                  })}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    padding: '12px 24px',
                    background: '#f3f4f6',
                    color: '#242424',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '12px 24px',
                    background: '#242424',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.7 : 1
                  }}
                >
                  {creating ? 'Creating...' : 'Create Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
