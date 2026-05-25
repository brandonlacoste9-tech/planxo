"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, Copy, Plus, Trash2, Clock, AlertCircle } from "lucide-react";

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
}

interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

// Brand colors
const colors = {
  bg: "#1a1008",
  bg2: "#241810",
  text: "#e8d5c4",
  textMuted: "#c4a882",
  accent: "#c47f3a",
  accentHover: "#d4944e",
  accentText: "#1a1008",
  border: "rgba(196,127,58,0.12)",
  cardBg: "#241810",
  success: "#c47f3a",
  gold: "#d4a853",
  dimText: "#6b5040",
  error: "#c47f3a",
};

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<Record<number, DaySchedule>>({});
  const [timezone, setTimezone] = useState("America/Toronto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const supabase = createClient();

  // Load existing availability
  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("availability")
          .select("*")
          .eq("user_id", user.id);

        const { data: userData } = await supabase
          .from("users")
          .select("timezone")
          .eq("id", user.id)
          .single();

        if (userData?.timezone) {
          setTimezone(userData.timezone);
        }

        if (data) {
          const weekly: Record<number, DaySchedule> = {};

          // Initialize all days
          for (let i = 0; i < 7; i++) {
            weekly[i] = { enabled: false, slots: [] };
          }

          // Group by day of week
          const dayMap: Record<number, TimeSlot[]> = {};
          data.forEach((row: any) => {
            if (row.day_of_week >= 0) {
              if (!dayMap[row.day_of_week]) dayMap[row.day_of_week] = [];
              dayMap[row.day_of_week].push({
                id: row.id,
                startTime: row.start_time,
                endTime: row.end_time,
              });
            }
          });

          // Populate schedule
          Object.keys(dayMap).forEach((day) => {
            const dayNum = parseInt(day);
            weekly[dayNum] = {
              enabled: true,
              slots: dayMap[dayNum],
            };
          });

          setSchedule(weekly);
        }
      } catch (err) {
        console.error("Error loading availability:", err);
        setError("Failed to load availability");
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, []);

  const toggleDay = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        slots: prev[day].enabled ? prev[day].slots : [{ id: `new-${Date.now()}`, startTime: "09:00", endTime: "10:00" }],
      },
    }));
  };

  const addSlot = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: [
          ...prev[day].slots,
          { id: `new-${Date.now()}`, startTime: "10:00", endTime: "11:00" },
        ],
      },
    }));
  };

  const removeSlot = (day: number, slotId: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.filter((s) => s.id !== slotId),
      },
    }));
  };

  const updateSlot = (day: number, slotId: string, field: "startTime" | "endTime", value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        slots: prev[day].slots.map((s) =>
          s.id === slotId ? { ...s, [field]: value } : s
        ),
      },
    }));
  };

  const copyDaySchedule = (fromDay: number, toDay: number) => {
    setSchedule((prev) => ({
      ...prev,
      [toDay]: {
        enabled: prev[fromDay].enabled,
        slots: prev[fromDay].slots.map((s) => ({
          ...s,
          id: `new-${Date.now()}-${Math.random()}`,
        })),
      },
    }));
  };

  const saveAvailability = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete old records
      await supabase.from("availability").delete().eq("user_id", user.id);

      // Insert new records
      const rows: any[] = [];
      Object.keys(schedule).forEach((day) => {
        const dayNum = parseInt(day);
        if (schedule[dayNum].enabled) {
          schedule[dayNum].slots.forEach((slot) => {
            rows.push({
              user_id: user.id,
              day_of_week: dayNum,
              start_time: slot.startTime,
              end_time: slot.endTime,
              timezone,
            });
          });
        }
      });

      if (rows.length > 0) {
        await supabase.from("availability").insert(rows);
      }

      // Update timezone
      await supabase.from("users").update({ timezone }).eq("id", user.id);

      setSuccess("Availability saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error saving availability:", err);
      setError("Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: `3px solid ${colors.border}`, borderTopColor: colors.accent, margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <p style={{ color: colors.textMuted, fontSize: "14px" }}>Loading your availability...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "32px 16px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "700", color: colors.text, marginBottom: "8px", fontFamily: "'Cal Sans', 'Inter', sans-serif" }}>Availability Settings</h1>
          <p style={{ fontSize: "16px", color: colors.textMuted }}>Set your working hours and availability for bookings</p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div style={{ marginBottom: "24px", padding: "16px", background: "rgba(196,127,58,0.1)", border: `1px solid ${colors.border}`, borderRadius: "8px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <AlertCircle style={{ width: "20px", height: "20px", color: colors.accent, flexShrink: 0, marginTop: "2px" }} />
            <p style={{ color: colors.text, fontSize: "14px", margin: 0 }}>{error}</p>
          </div>
        )}

        {success && (
          <div style={{ marginBottom: "24px", padding: "16px", background: "rgba(212,168,83,0.1)", border: `1px solid rgba(212,168,83,0.3)`, borderRadius: "8px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ width: "20px", height: "20px", color: colors.gold, flexShrink: 0, marginTop: "2px" }}>✓</div>
            <p style={{ color: colors.text, fontSize: "14px", margin: 0 }}>{success}</p>
          </div>
        )}

        {/* Timezone Selection */}
        <div style={{ background: colors.cardBg, borderRadius: "12px", border: `1px solid ${colors.border}`, padding: "24px", marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: colors.textMuted, marginBottom: "8px" }}>
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: "8px", background: colors.bg, color: colors.text, fontSize: "14px", fontFamily: "'Inter', sans-serif", outline: "none", cursor: "pointer" }}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} style={{ background: colors.bg, color: colors.text }}>
                {tz}
              </option>
            ))}
          </select>
          <p style={{ fontSize: "12px", color: colors.dimText, marginTop: "8px", margin: "8px 0 0" }}>
            All times will be displayed in this timezone
          </p>
        </div>

        {/* Weekly Schedule */}
        <div style={{ background: colors.cardBg, borderRadius: "12px", border: `1px solid ${colors.border}`, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.border}`, background: "rgba(196,127,58,0.08)" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: colors.text, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <Clock style={{ width: "20px", height: "20px" }} />
              Weekly Hours
            </h2>
          </div>

          <div>
            {DAYS.map((day, index) => (
              <div key={index} style={{ padding: "24px", borderBottom: index < DAYS.length - 1 ? `1px solid ${colors.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <input
                      type="checkbox"
                      id={`day-${index}`}
                      checked={schedule[index]?.enabled || false}
                      onChange={() => toggleDay(index)}
                      style={{ width: "20px", height: "20px", cursor: "pointer", accentColor: colors.accent }}
                    />
                    <label
                      htmlFor={`day-${index}`}
                      style={{ fontSize: "16px", fontWeight: "600", color: colors.text, cursor: "pointer", margin: 0 }}
                    >
                      {day}
                    </label>
                  </div>

                  {schedule[index]?.enabled && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        onClick={() => addSlot(index)}
                        style={{ padding: "8px", color: colors.accent, background: "transparent", border: "none", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.2s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(196,127,58,0.1)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        title="Add time slot"
                      >
                        <Plus style={{ width: "16px", height: "16px" }} />
                      </button>
                      {index < 5 && (
                        <button
                          onClick={() => copyDaySchedule(index, index + 1)}
                          style={{ padding: "8px", color: colors.textMuted, background: "transparent", border: "none", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.2s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(196,127,58,0.08)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Copy to next day"
                        >
                          <Copy style={{ width: "16px", height: "16px" }} />
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedDay(expandedDay === index ? null : index)}
                        style={{ padding: "8px", color: colors.textMuted, background: "transparent", border: "none", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.2s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(196,127,58,0.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <ChevronDown
                          style={{ width: "16px", height: "16px", transform: expandedDay === index ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                        />
                      </button>
                    </div>
                  )}
                </div>

                {schedule[index]?.enabled && expandedDay === index && (
                  <div style={{ marginTop: "16px", paddingLeft: "36px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {schedule[index].slots.map((slot) => (
                      <div key={slot.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) =>
                            updateSlot(index, slot.id, "startTime", e.target.value)
                          }
                          style={{ padding: "8px 12px", border: `1px solid ${colors.border}`, borderRadius: "8px", background: colors.bg, color: colors.text, fontSize: "14px", fontFamily: "'Inter', sans-serif", outline: "none", cursor: "pointer" }}
                        />
                        <span style={{ color: colors.dimText }}>–</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) =>
                            updateSlot(index, slot.id, "endTime", e.target.value)
                          }
                          style={{ padding: "8px 12px", border: `1px solid ${colors.border}`, borderRadius: "8px", background: colors.bg, color: colors.text, fontSize: "14px", fontFamily: "'Inter', sans-serif", outline: "none", cursor: "pointer" }}
                        />
                        <button
                          onClick={() => removeSlot(index, slot.id)}
                          style={{ padding: "8px", color: colors.accent, background: "transparent", border: "none", borderRadius: "8px", cursor: "pointer", marginLeft: "auto", display: "flex", alignItems: "center", transition: "background 0.2s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(196,127,58,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Remove slot"
                        >
                          <Trash2 style={{ width: "16px", height: "16px" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {schedule[index]?.enabled && expandedDay !== index && (
                  <div style={{ fontSize: "14px", color: colors.textMuted, paddingLeft: "36px" }}>
                    {schedule[index].slots.map((slot, i) => (
                      <div key={i}>
                        {slot.startTime} – {slot.endTime}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div style={{ marginTop: "32px", display: "flex", gap: "16px" }}>
          <button
            onClick={saveAvailability}
            disabled={saving}
            style={{ flex: 1, padding: "14px 24px", background: colors.accent, color: colors.accentText, fontWeight: "600", borderRadius: "10px", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: "15px", fontFamily: "'Inter', sans-serif", opacity: saving ? 0.7 : 1, transition: "all 0.2s" }}
            onMouseEnter={(e) => !saving && (e.currentTarget.style.background = colors.accentHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = colors.accent)}
          >
            {saving ? "Saving..." : "Save Availability"}
          </button>
        </div>

        {/* Info Box */}
        <div style={{ marginTop: "32px", padding: "16px", background: "rgba(212,168,83,0.08)", border: `1px solid rgba(212,168,83,0.2)`, borderRadius: "8px" }}>
          <p style={{ fontSize: "14px", color: colors.text, margin: 0 }}>
            <strong>Tip:</strong> You can add multiple time slots per day (e.g., morning and afternoon sessions). Use the copy button to quickly apply the same schedule to the next day.
          </p>
        </div>
      </div>
    </div>
  );
}
