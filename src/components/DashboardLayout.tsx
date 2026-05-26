"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Calendar, Settings, LogOut, Home } from "lucide-react";
import { useTheme } from "@/lib/theme";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const { colors } = useTheme();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/event-types", label: "Event Types", icon: Calendar },
    { href: "/availability", label: "Availability", icon: Calendar },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className="app-layout" style={{ display: "flex", minHeight: "100vh", background: colors.bg }}>
      <style>{`
        .sidebar-container {
          transition: all 0.3s ease;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
          z-index: 50;
          flex-shrink: 0;
        }
        .mobile-overlay {
          display: none;
        }
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        @media (max-width: 768px) {
          .sidebar-container {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            width: 260px !important;
            transform: translateX(${sidebarOpen ? '0' : '-100%'});
          }
          .mobile-overlay {
            display: ${sidebarOpen ? 'block' : 'none'};
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(2px);
            z-index: 40;
          }
        }
      `}</style>

      {/* Mobile Overlay Backdrop */}
      <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <div
        className="sidebar-container"
        style={{
          width: sidebarOpen ? 260 : 0,
          background: colors.cardBg,
          borderRight: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ padding: "24px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/" style={{ textDecoration: "none" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>Planxo</div>
            </Link>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Scheduling Platform</div>
          </div>
          {/* Mobile close button inside sidebar */}
          <button
            className="mobile-close-btn"
            onClick={() => setSidebarOpen(false)}
            style={{ background: "none", border: "none", color: colors.text, cursor: "pointer", display: "none" }}
          >
            <X size={20} />
          </button>
          <style>{`
            @media (max-width: 768px) {
              .mobile-close-btn { display: block !important; }
            }
          `}</style>
        </div>

        <nav style={{ flex: 1, padding: "16px 8px", overflow: "auto" }}>
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 10,
                marginBottom: 8,
                textDecoration: "none",
                color: isActive(href) ? colors.accent : colors.textMuted,
                background: isActive(href) ? `${colors.accent}15` : "transparent",
                border: isActive(href) ? `1px solid ${colors.accent}30` : "none",
                transition: "all 0.2s",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: isActive(href) ? 600 : 500,
              }}
              onMouseEnter={(e) => {
                if (!isActive(href)) {
                  (e.currentTarget as HTMLElement).style.background = `${colors.border}`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(href)) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
            >
              <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div style={{ padding: "16px 8px", borderTop: `1px solid ${colors.border}` }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              background: "transparent",
              border: "none",
              color: colors.textMuted,
              cursor: "pointer",
              fontSize: 14,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = colors.accent;
              (e.currentTarget as HTMLElement).style.background = `${colors.border}`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = colors.textMuted;
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <LogOut style={{ width: 18, height: 18 }} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: `1px solid ${colors.border}`,
            background: colors.cardBg,
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none",
              border: "none",
              color: colors.text,
              cursor: "pointer",
              padding: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Menu size={20} />
          </button>
          <div style={{ fontSize: 14, color: colors.textMuted }}>Welcome back!</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
