"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTheme } from "@/lib/theme";
import { Calendar, Users, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string;
  length: number;
  location: string;
  isActive: boolean;
}

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  eventTypeId?: string;
  eventType: { title: string; slug: string };
}

export default function DashboardPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userSlug, setUserSlug] = useState("");
  const { colors } = useTheme();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, bookingsRes] = await Promise.all([
        fetch("/api/v2/me"),
        fetch("/api/v2/bookings?timeFilter=upcoming"),
      ]);
      const user = await userRes.json();
      const bookingsData = await bookingsRes.json();

      if (user.username) setUserSlug(user.username);
      if (user.name) setUserName(user.name);
      setEventTypes(user.eventTypes || []);
      setBookings(bookingsData.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const upcomingBookings = bookings.filter(b => b.status === "confirmed").slice(0, 5);
  const confirmedCount = bookings.filter(b => b.status === "confirmed").length;

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: colors.textMuted }}>
          Loading...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: colors.text, margin: 0 }}>
            Welcome back, {userName || "User"}!
          </h1>
          <p style={{ fontSize: 14, color: colors.textMuted, margin: "8px 0 0" }}>
            Here's an overview of your scheduling activity
          </p>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16,
            marginBottom: 40,
          }}
        >
          {/* Event Types Card */}
          <div
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: colors.textMuted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>
                Event Types
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, color: colors.accent, marginTop: 12 }}>
                {eventTypes.length}
              </div>
              <p style={{ fontSize: 13, color: colors.textMuted, margin: "8px 0 0" }}>
                Active scheduling types
              </p>
            </div>
            <div style={{ width: 48, height: 48, background: `${colors.accent}20`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Calendar size={24} color={colors.accent} />
            </div>
          </div>

          {/* Bookings Card */}
          <div
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: colors.textMuted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>
                Total Bookings
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, color: colors.accent, marginTop: 12 }}>
                {bookings.length}
              </div>
              <p style={{ fontSize: 13, color: colors.textMuted, margin: "8px 0 0" }}>
                All time bookings
              </p>
            </div>
            <div style={{ width: 48, height: 48, background: `${colors.accent}20`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={24} color={colors.accent} />
            </div>
          </div>

          {/* Confirmed Card */}
          <div
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: colors.textMuted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>
                Confirmed
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, color: "#22c55e", marginTop: 12 }}>
                {confirmedCount}
              </div>
              <p style={{ fontSize: 13, color: colors.textMuted, margin: "8px 0 0" }}>
                Confirmed appointments
              </p>
            </div>
            <div style={{ width: 48, height: 48, background: "#22c55e20", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={24} color="#22c55e" />
            </div>
          </div>
        </div>

        {/* Upcoming Bookings */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0 }}>
              Upcoming Bookings
            </h2>
            <a
              href="/dashboard"
              style={{
                fontSize: 13,
                color: colors.accent,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View all <ArrowRight size={14} />
            </a>
          </div>

          {upcomingBookings.length === 0 ? (
            <div
              style={{
                background: colors.cardBg,
                border: `1px solid ${colors.border}`,
                borderRadius: 16,
                padding: 40,
                textAlign: "center",
                color: colors.textMuted,
              }}
            >
              <AlertCircle size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
              <p>No upcoming bookings</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  style={{
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: colors.text }}>
                      {booking.guestName}
                    </div>
                    <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                      {booking.eventType?.title} • {new Date(booking.startTime).toLocaleDateString()} at{" "}
                      {new Date(booking.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: colors.accent,
                        color: colors.accentText,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: "0 0 16px" }}>
            Quick Actions
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <a
              href="/event-types"
              style={{
                background: colors.cardBg,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: 16,
                textDecoration: "none",
                color: colors.text,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.accent;
                (e.currentTarget as HTMLElement).style.background = `${colors.accent}10`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.border;
                (e.currentTarget as HTMLElement).style.background = colors.cardBg;
              }}
            >
              <Calendar size={20} color={colors.accent} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Create Event Type</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Add a new scheduling type
                </div>
              </div>
            </a>

            <a
              href="/availability"
              style={{
                background: colors.cardBg,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: 16,
                textDecoration: "none",
                color: colors.text,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.accent;
                (e.currentTarget as HTMLElement).style.background = `${colors.accent}10`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = colors.border;
                (e.currentTarget as HTMLElement).style.background = colors.cardBg;
              }}
            >
              <AlertCircle size={20} color={colors.accent} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Set Availability</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Configure your working hours
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
