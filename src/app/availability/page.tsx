"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<any>({});
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // Load existing availability
  useEffect(() => {
    const loadAvailability = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("availability")
        .select("*")
        .eq("user_id", user.id);

      if (data) {
        const weekly: any = {};
        const ov: any[] = [];

        data.forEach((row: any) => {
          if (row.day_of_week >= 0) {
            weekly[row.day_of_week] = {
              enabled: true,
              start: row.start_time,
              end: row.end_time,
            };
          } else if (row.specific_date) {
            ov.push({
              date: row.specific_date,
              label: `${row.start_time} - ${row.end_time}`,
            });
          }
        });

        // Fill missing days
        for (let i = 0; i < 7; i++) {
          if (!weekly[i]) weekly[i] = { enabled: false, start: "09:00", end: "17:00" };
        }

        setSchedule(weekly);
        setOverrides(ov);
      }
      setLoading(false);
    };

    loadAvailability();
  }, []);

  const toggleDay = (day: number) => {
    setSchedule((prev: any) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const saveAvailability = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Delete old records
    await supabase.from("availability").delete().eq("user_id", user.id);

    // Insert weekly
    const rows: any[] = [];
    Object.keys(schedule).forEach((day) => {
      const d = parseInt(day);
      if (schedule[d].enabled) {
        rows.push({
          user_id: user.id,
          day_of_week: d,
          start_time: schedule[d].start,
          end_time: schedule[d].end,
          timezone: "America/Toronto",
        });
      }
    });

    if (rows.length > 0) {
      await supabase.from("availability").insert(rows);
    }

    alert("Availability saved!");
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 30 }}>Availability</h1>

      <div style={{ marginBottom: 40 }}>
        <h3>Weekly Hours</h3>
        {DAYS.map((day, index) => (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={schedule[index]?.enabled}
              onChange={() => toggleDay(index)}
            />
            <span style={{ width: 100 }}>{day}</span>

            {schedule[index]?.enabled && (
              <>
                <input
                  type="time"
                  value={schedule[index].start}
                  onChange={(e) => {
                    const newS = { ...schedule };
                    newS[index].start = e.target.value;
                    setSchedule(newS);
                  }}
                />
                <span>-</span>
                <input
                  type="time"
                  value={schedule[index].end}
                  onChange={(e) => {
                    const newS = { ...schedule };
                    newS[index].end = e.target.value;
                    setSchedule(newS);
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={saveAvailability}
        disabled={saving}
        style={{
          background: "#c47f3a",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 8,
          border: "none",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {saving ? "Saving..." : "Save Availability"}
      </button>
    </div>
  );
}
