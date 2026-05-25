"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTheme } from "@/lib/theme";
import { ChevronDown, Copy, Plus, Trash2, Clock, AlertCircle, Check, Loader2 } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIMEZONES = [
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Australia/Sydney",
];

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<Record<number, DaySchedule>>({});
  const [timezone, setTimezone] = useState("America/Toronto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const { colors } = useTheme();

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/availability");
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        const weekly: Record<number, DaySchedule> = {};
        for (let i = 0; i < 7; i++) {
          weekly[i] = { enabled: false, slots: [] };
        }

        if (data.intervals) {
          data.intervals.forEach((row: any) => {
            const day = row.dayOfWeek;
            weekly[day].enabled = true;
            weekly[day].slots.push({
              id: row.id,
              startTime: row.startTime.substring(0, 5),
              endTime: row.endTime.substring(0, 5),
              isActive: row.isActive,
            });
          });
        }

        Object.keys(weekly).forEach((k) => {
          const day = parseInt(k);
          if (weekly[day].enabled && weekly[day].slots.length === 0) {
            weekly[day].slots = [
              {
                id: `new-${Date.now()}`,
                startTime: "09:00",
                endTime: "17:00",
                isActive: true,
              },
            ];
          }
        });

        setSchedule(weekly);
        if (data.timeZone) setTimezone(data.timeZone);
      } catch (err: any) {
        setError(err.message || "Failed to load availability");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleDay = (day: number) => {
    setSchedule((prev) => {
      const isEnabled = !prev[day].enabled;
      return {
        ...prev,
        [day]: {
          ...prev[day],
          enabled: isEnabled,
          slots:
            isEnabled && prev[day].slots.length === 0
              ? [
                  {
                    id: `new-${Date.now()}`,
                    startTime: "09:00",
                    endTime: "17:00",
                    isActive: true,
                  },
                ]
              : prev[day].slots,
        },
      };
    });
  };

  const addSlot = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: [
          ...prev[day].slots,
          {
            id: `new-${Date.now()}`,
            startTime: "17:00",
            endTime: "18:00",
            isActive: true,
          },
        ],
      },
    }));
    setExpandedDay(day);
  };

  const removeSlot = (day: number, slotId: string) => {
    setSchedule((prev) => {
      const newSlots = prev[day].slots.filter((s) => s.id !== slotId);
      return {
        ...prev,
        [day]: {
          ...prev[day],
          enabled: newSlots.length > 0,
          slots: newSlots,
        },
      };
    });
  };

  const updateSlot = (day: number, slotId: string, field: "startTime" | "endTime", value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((s) => (s.id === slotId ? { ...s, [field]: value } : s)),
      },
    }));
  };

  const copyDaySchedule = (fromDay: number) => {
    const source = schedule[fromDay];
    setSchedule((prev) => {
      const next = { ...prev };
      for (let i = 0; i < 7; i++) {
        if (i !== fromDay) {
          next[i] = {
            enabled: source.enabled,
            slots: source.slots.map((s) => ({
              ...s,
              id: `copy-${Date.now()}-${Math.random()}`,
            })),
          };
        }
      }
      return next;
    });
    setSuccess("Copied to all days!");
    setTimeout(() => setSuccess(""), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const intervals: any[] = [];
      Object.entries(schedule).forEach(([day, data]) => {
        if (data.enabled) {
          data.slots.forEach((slot) => {
            intervals.push({
              dayOfWeek: parseInt(day),
              startTime: slot.startTime,
              endTime: slot.endTime,
              isActive: true,
            });
          });
        }
      });

      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, intervals }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setSuccess("Availability saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Error saving availability");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: colors.textMuted }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: colors.text, margin: 0 }}>Availability</h1>
          <p style={{ fontSize: 14, color: colors.textMuted, margin: "8px 0 0" }}>
            Configure when you are available for bookings
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              background: "#ef444420",
              border: `1px solid #ef4444`,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#ef4444",
              fontSize: 13,
            }}
          >
            <AlertCircle size={18} />
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {success && (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              background: "#22c55e20",
              border: `1px solid #22c55e`,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#22c55e",
              fontSize: 13,
            }}
          >
            <Check size={18} />
            <p style={{ margin: 0 }}>{success}</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Timezone Section */}
          <div
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              padding: 20,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Timezone</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: colors.bg,
                  color: colors.text,
                  fontSize: 14,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Schedule Section */}
          <div
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: `1px solid ${colors.border}`,
                background: `${colors.accent}10`,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Clock size={18} color={colors.accent} />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>Weekly Hours</h2>
            </div>

            <div style={{ divideY: `1px solid ${colors.border}` }}>
              {DAYS.map((day, idx) => (
                <div
                  key={day}
                  style={{
                    padding: 16,
                    borderBottom: idx < 6 ? `1px solid ${colors.border}` : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button
                        onClick={() => toggleDay(idx)}
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: 12,
                          background: schedule[idx]?.enabled ? colors.accent : colors.border,
                          border: "none",
                          cursor: "pointer",
                          position: "relative",
                          padding: 0,
                          transition: "all 0.2s",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 2,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.2s",
                            left: schedule[idx]?.enabled ? 22 : 2,
                          }}
                        />
                      </button>
                      <span
                        style={{
                          fontWeight: 600,
                          color: schedule[idx]?.enabled ? colors.text : colors.textMuted,
                          fontSize: 14,
                        }}
                      >
                        {day}
                      </span>
                    </div>

                    {schedule[idx]?.enabled && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={() => addSlot(idx)}
                          style={{
                            padding: "6px 10px",
                            background: "transparent",
                            border: `1px solid ${colors.border}`,
                            borderRadius: 6,
                            color: colors.textMuted,
                            cursor: "pointer",
                            fontSize: 12,
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = colors.accent;
                            (e.currentTarget as HTMLElement).style.color = colors.accent;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = colors.border;
                            (e.currentTarget as HTMLElement).style.color = colors.textMuted;
                          }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => copyDaySchedule(idx)}
                          style={{
                            padding: "6px 10px",
                            background: "transparent",
                            border: `1px solid ${colors.border}`,
                            borderRadius: 6,
                            color: colors.textMuted,
                            cursor: "pointer",
                            fontSize: 12,
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = colors.accent;
                            (e.currentTarget as HTMLElement).style.color = colors.accent;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = colors.border;
                            (e.currentTarget as HTMLElement).style.color = colors.textMuted;
                          }}
                          title="Copy to all days"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => setExpandedDay(expandedDay === idx ? null : idx)}
                          style={{
                            padding: "6px 10px",
                            background: "transparent",
                            border: `1px solid ${colors.border}`,
                            borderRadius: 6,
                            color: colors.textMuted,
                            cursor: "pointer",
                            fontSize: 12,
                            transition: "all 0.2s",
                            display: "flex",
                            alignItems: "center",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = colors.accent;
                            (e.currentTarget as HTMLElement).style.color = colors.accent;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = colors.border;
                            (e.currentTarget as HTMLElement).style.color = colors.textMuted;
                          }}
                        >
                          <ChevronDown
                            size={14}
                            style={{
                              transform: expandedDay === idx ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s",
                            }}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {schedule[idx]?.enabled && (
                    <div
                      style={{
                        marginTop: 12,
                        display: expandedDay === idx ? "block" : "none",
                      }}
                    >
                      {schedule[idx].slots.map((slot) => (
                        <div
                          key={slot.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 8,
                            paddingLeft: 56,
                          }}
                        >
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => updateSlot(idx, slot.id, "startTime", e.target.value)}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: `1px solid ${colors.border}`,
                              background: colors.bg,
                              color: colors.text,
                              fontSize: 12,
                              outline: "none",
                            }}
                          />
                          <span style={{ color: colors.textMuted, fontSize: 12 }}>–</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => updateSlot(idx, slot.id, "endTime", e.target.value)}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: `1px solid ${colors.border}`,
                              background: colors.bg,
                              color: colors.text,
                              fontSize: 12,
                              outline: "none",
                            }}
                          />
                          <button
                            onClick={() => removeSlot(idx, slot.id)}
                            style={{
                              padding: "4px 8px",
                              background: "transparent",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              marginLeft: "auto",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.color = "#dc2626";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.color = "#ef4444";
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!schedule[idx]?.enabled && (
                    <div style={{ marginTop: 8, paddingLeft: 56, fontSize: 12, color: colors.textMuted }}>
                      Unavailable
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%",
              padding: 14,
              background: colors.accent,
              color: colors.accentText,
              border: "none",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: saving ? 0.7 : 1,
              transition: "all 0.2s",
            }}
          >
            {saving && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
            {saving ? "Saving..." : "Save Availability"}
          </button>

          {/* Footer Tip */}
          <div
            style={{
              background: `${colors.accent}10`,
              border: `1px solid ${colors.accent}30`,
              borderRadius: 10,
              padding: 14,
              fontSize: 12,
              color: colors.text,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: colors.accent }}>Pro Tip:</strong> You can add multiple time slots per day to account for breaks. Use the copy icon to quickly apply your schedule across the entire week.
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
