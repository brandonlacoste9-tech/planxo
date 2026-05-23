"use client";
import { useState, useEffect } from "react";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

interface Interval { id: string; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean; }

export default function AvailabilityPage() {
  const [intervals, setIntervals] = useState<Interval[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scheduleName, setScheduleName] = useState("Heures de travail");

  useEffect(() => {
    fetch("/api/v2/me").then(r => r.json()).then(user => {
      const schedule = user.schedules?.[0];
      if (schedule) {
        setScheduleName(schedule.name);
        setIntervals(schedule.intervals || []);
      }
    }).finally(() => setLoading(false));
  }, []);

  const defaultIntervals: Interval[] = DAYS.map((_, i) => ({
    id: `avail-${i}`,
    dayOfWeek: i,
    startTime: "09:00",
    endTime: "17:00",
    isActive: true,
  }));

  const displayIntervals = intervals.length > 0 ? intervals : defaultIntervals;

  const toggleDay = (dayIndex: number) => {
    setIntervals(prev => {
      const source = prev.length > 0 ? prev : defaultIntervals;
      return source.map(d =>
        d.dayOfWeek === dayIndex ? { ...d, isActive: !d.isActive } : d
      );
    });
  };

  const updateTime = (dayIndex: number, field: "startTime" | "endTime", value: string) => {
    setIntervals(prev => {
      const source = prev.length > 0 ? prev : defaultIntervals;
      return source.map(d =>
        d.dayOfWeek === dayIndex ? { ...d, [field]: value } : d
      );
    });
  };

  const saveAvailability = async () => {
    setSaving(true);
    await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduleName,
        intervals: displayIntervals.filter(d => d.isActive).map(d => ({
          dayOfWeek: d.dayOfWeek,
          startTime: d.startTime,
          endTime: d.endTime,
          isActive: d.isActive,
        })),
      }),
    });
    setSaving(false);
  };

  if (loading) return <div style={s.page}><div style={s.content}><p style={{color:"#898989"}}>Chargement...</p></div></div>;

  return (
    <div style={s.page}>
      <div style={s.sidebar}>
        <a href="/" style={{ fontFamily:"'Cal Sans',sans-serif",fontSize:18,fontWeight:700,color:"#242424",textDecoration:"none",display:"block",marginBottom:24 }}>Planxo</a>
        <div style={{marginTop:"auto",paddingTop:20,borderTop:"1px solid rgba(0,0,0,0.04)"}}>
          <a href="/dashboard" style={{fontSize:13,color:"#898989",textDecoration:"none"}}>← Tableau de bord</a>
        </div>
      </div>
      <div style={s.content}>
        <h1 style={{ fontFamily:"'Cal Sans',sans-serif",fontSize:24,fontWeight:700,marginBottom:6 }}>Disponibilités</h1>
        <p style={{fontSize:14,color:"#898989",marginBottom:28}}>Définissez vos heures de disponibilité pour chaque jour de la semaine.</p>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:12,fontWeight:500,color:"#898989",display:"block",marginBottom:4}}>Nom de l'horaire</label>
          <input value={scheduleName} onChange={e => setScheduleName(e.target.value)} style={{padding:"10px 14px",borderRadius:8,border:"1px solid rgba(0,0,0,0.1)",fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none",width:240}} />
        </div>
        <div style={{borderRadius:12,border:"1px solid rgba(0,0,0,0.06)",overflow:"hidden"}}>
          {displayIntervals.map((d, i) => (
            <div key={d.dayOfWeek} style={{display:"flex",alignItems:"center",padding:"14px 20px",borderBottom:i<6?"1px solid rgba(0,0,0,0.04)":"none",opacity:d.isActive?1:0.4}}>
              <label style={{display:"flex",alignItems:"center",gap:10,flex:1,cursor:"pointer"}}>
                <input type="checkbox" checked={d.isActive} onChange={() => toggleDay(d.dayOfWeek)} style={{accentColor:"#242424",width:16,height:16}} />
                <span style={{fontSize:14,fontWeight:500,minWidth:100}}>{DAYS[d.dayOfWeek]}</span>
              </label>
              {d.isActive ? (
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <select value={d.startTime} onChange={e => updateTime(d.dayOfWeek,"startTime",e.target.value)} style={s.select}>
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span style={{fontSize:13,color:"#898989"}}>à</span>
                  <select value={d.endTime} onChange={e => updateTime(d.dayOfWeek,"endTime",e.target.value)} style={s.select}>
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ) : (
                <span style={{fontSize:13,color:"#898989"}}>Indisponible</span>
              )}
            </div>
          ))}
        </div>
        <button onClick={saveAvailability} disabled={saving}
          style={{marginTop:20,padding:"12px 28px",borderRadius:9999,background:saving?"#898989":"#242424",color:"#fff",border:"none",fontSize:14,fontWeight:600,cursor:saving?"default":"pointer",fontFamily:"'Inter',sans-serif"}}>
          {saving ? "⏳ Enregistrement..." : "💾 Enregistrer"}
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", minHeight: "100vh", fontFamily: "'Inter',system-ui,sans-serif",color:"#242424",background:"#fff",position:"relative",zIndex:1,flexWrap:"wrap" },
  sidebar: { width: 220, padding: "20px 16px", borderRight: "1px solid rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", flexShrink: 0 },
  content: { flex: 1, padding: "24px 16px 80px", maxWidth: 960 },
  select: { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, fontFamily: "'Inter',sans-serif", outline: "none", background: "#fff" },
};
