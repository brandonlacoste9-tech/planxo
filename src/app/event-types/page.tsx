"use client";
import { useState, useEffect } from "react";

const LOCATIONS = [
  { value: "google-meet", label: "Google Meet", icon: "📹" },
  { value: "zoom", label: "Zoom", icon: "🎥" },
  { value: "teams", label: "Microsoft Teams", icon: "💼" },
  { value: "phone", label: "Téléphone", icon: "📞" },
  { value: "in-person", label: "En personne", icon: "📍" },
];

const COLORS = ["#242424","#4f46e5","#059669","#d97706","#dc2626","#7c3aed","#0891b2","#be185d"];

function emptyForm() {
  return {
    title: "",
    slug: "",
    description: "",
    length: 30,
    location: "google-meet",
    color: "#242424",
    price: 0,
    currency: "cad",
    bufferBefore: 0,
    bufferAfter: 0,
    maxPerDay: "",
  };
}

export default function EventTypesPage() {
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchAll = () => {
    fetch("/api/v2/event-types")
      .then(r => r.json())
      .then(d => setEventTypes(d.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const openNew = () => {
    setForm(emptyForm());
    setModal({ open: true, editing: null });
  };

  const openEdit = (et: any) => {
    setForm({
      title: et.title || "",
      slug: et.slug || "",
      description: et.description || "",
      length: et.length || 30,
      location: et.location || "google-meet",
      color: et.color || "#242424",
      price: et.price || 0,
      currency: et.currency || "cad",
      bufferBefore: et.bufferBefore ?? 0,
      bufferAfter: et.bufferAfter ?? 0,
      maxPerDay: et.maxPerDay?.toString() || "",
    });
    setModal({ open: true, editing: et });
  };

  const closeModal = () => setModal({ open: false, editing: null });

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const isEdit = !!modal.editing;
    const url = isEdit ? `/api/v2/event-types/${modal.editing.id}` : "/api/v2/event-types";
    const method = isEdit ? "PATCH" : "POST";
    const body: any = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim(),
      length: form.length,
      location: form.location,
      color: form.color,
      price: form.price,
      currency: form.currency,
      bufferBefore: form.bufferBefore,
      bufferAfter: form.bufferAfter,
      maxPerDay: form.maxPerDay ? parseInt(form.maxPerDay) : null,
    };

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) { closeModal(); fetchAll(); }
  };

  const remove = async (et: any) => {
    if (!confirm(`Supprimer "${et.title}" ?`)) return;
    await fetch(`/api/v2/event-types/${et.id}`, { method: "DELETE" });
    fetchAll();
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

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
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div>
            <h1 style={{ fontFamily:"'Cal Sans',sans-serif",fontSize:24,fontWeight:700,margin:0 }}>Types de rendez-vous</h1>
            <p style={{fontSize:14,color:"#898989",margin:"4px 0 0"}}>Créez et gérez vos types de rendez-vous.</p>
          </div>
          <button onClick={openNew} style={s.primaryBtn}>+ Nouveau</button>
        </div>

        {eventTypes.length === 0 ? (
          <div style={{textAlign:"center",padding:"60px 20px",color:"#898989",fontSize:14}}>
            Aucun type de rendez-vous. Cliquez sur "+ Nouveau" pour en créer un.
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {eventTypes.map((et: any) => (
              <div key={et.id} onClick={() => openEdit(et)} style={{padding:"16px 20px",borderRadius:10,border:"1px solid rgba(0,0,0,0.04)",background:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",transition:"all .15s"}} className="card-hover">
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:36,height:36,borderRadius:8,background:et.color||"#242424",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:700,flexShrink:0}}>
                    {et.title[0]}
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:600}}>{et.title}</div>
                    <div style={{fontSize:12,color:"#898989"}}>
                      {et.length} min · {et.location} · /{et.slug}
                      {et.bufferBefore ? ` · tampon ${et.bufferBefore}min` : ""}
                      {et.maxPerDay ? ` · max ${et.maxPerDay}/jour` : ""}
                      {et.price > 0 ? ` · ${(et.price/100).toFixed(2)} ${et.currency?.toUpperCase()}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}} onClick={e => e.stopPropagation()}>
                  <button onClick={() => copyLink(et.slug)} style={s.chipBtn}>📋 Copier le lien</button>
                  <a href={`/${et.slug}`} target="_blank" style={{fontSize:12,color:"#0099ff",textDecoration:"none",padding:"6px 12px"}}>Aperçu →</a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Modal ── */}
        {modal.open && (
          <>
            <div style={s.backdrop} onClick={closeModal} />
            <div style={s.modal}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
                <h2 style={{ fontFamily:"'Cal Sans',sans-serif",fontSize:20,fontWeight:700,margin:0 }}>
                  {modal.editing ? "Modifier" : "Nouveau type"}
                </h2>
                <button onClick={closeModal} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#898989",padding:4}}>✕</button>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {/* Title */}
                <label style={s.label}>
                  Titre
                  <input className="modal-input" value={form.title} onChange={e => set("title", e.target.value)} placeholder="ex: Consultation 30 min" />
                </label>

                {/* Slug */}
                <label style={s.label}>
                  Slug (URL)
                  <input className="modal-input" value={form.slug} onChange={e => set("slug", e.target.value)} placeholder="ex: consultation-30min" />
                </label>

                {/* Description */}
                <label style={s.label}>
                  Description
                  <textarea className="modal-input" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Décrivez ce rendez-vous..." rows={2} style={{resize:"vertical"}} />
                </label>

                <div style={{display:"flex",gap:12}}>
                  {/* Length */}
                  <label style={{...s.label,flex:1}}>
                    Durée (min)
                    <select className="modal-input" value={form.length} onChange={e => set("length", parseInt(e.target.value))}>
                      {[15,30,45,60,90,120].map(v => <option key={v} value={v}>{v} min</option>)}
                    </select>
                  </label>

                  {/* Location */}
                  <label style={{...s.label,flex:1}}>
                    Lieu
                    <select className="modal-input" value={form.location} onChange={e => set("location", e.target.value)}>
                      {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.icon} {l.label}</option>)}
                    </select>
                  </label>
                </div>

                {/* Color */}
                <label style={s.label}>
                  Couleur
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => set("color", c)} style={{
                        width:32,height:32,borderRadius:8,background:c,
                        border: form.color === c ? "3px solid #242424" : "3px solid transparent",
                        cursor:"pointer", outline:"none", boxShadow: form.color === c ? "0 0 0 2px rgba(0,0,0,0.1)" : "none",
                        transition:"all 0.1s"
                      }} />
                    ))}
                  </div>
                </label>

                <div style={{borderTop:"1px solid rgba(0,0,0,0.06)",margin:"4px 0"}} />

                {/* ── Defensive scheduling ── */}
                <div style={{fontSize:13,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.5px"}}>Protection d'horaire</div>

                <div style={{display:"flex",gap:12}}>
                  <label style={{...s.label,flex:1}}>
                    Tampon avant (min)
                    <input className="modal-input" type="number" min={0} max={120} value={form.bufferBefore} onChange={e => set("bufferBefore", parseInt(e.target.value) || 0)} />
                    <span style={{fontSize:11,color:"#898989"}}>Temps bloqué avant le rdv</span>
                  </label>
                  <label style={{...s.label,flex:1}}>
                    Tampon après (min)
                    <input className="modal-input" type="number" min={0} max={120} value={form.bufferAfter} onChange={e => set("bufferAfter", parseInt(e.target.value) || 0)} />
                    <span style={{fontSize:11,color:"#898989"}}>Temps bloqué après le rdv</span>
                  </label>
                </div>

                <div style={{display:"flex",gap:12}}>
                  <label style={{...s.label,flex:1}}>
                    Maximum par jour
                    <input className="modal-input" type="number" min={1} max={50} value={form.maxPerDay} onChange={e => set("maxPerDay", e.target.value)} placeholder="Illimité" />
                    <span style={{fontSize:11,color:"#898989"}}>Laisser vide = illimité</span>
                  </label>
                  <label style={{...s.label,flex:1}}>
                    Prix ($ CAD)
                    <input className="modal-input" type="number" min={0} step={0.01} value={(form.price/100).toFixed(2)} onChange={e => set("price", Math.round(parseFloat(e.target.value || "0") * 100))} placeholder="0.00" />
                    <span style={{fontSize:11,color:"#898989"}}>0 = gratuit</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div style={{display:"flex",justifyContent:"space-between",marginTop:24,paddingTop:20,borderTop:"1px solid rgba(0,0,0,0.06)"}}>
                <div>
                  {modal.editing && (
                    <button onClick={() => { remove(modal.editing); closeModal(); }} style={{background:"none",border:"none",color:"#dc2626",fontSize:13,cursor:"pointer",padding:"8px 0"}}>
                      🗑 Supprimer
                    </button>
                  )}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={closeModal} style={s.secondaryBtn}>Annuler</button>
                  <button onClick={save} disabled={saving || !form.title.trim()} style={{...s.primaryBtn,opacity: saving||!form.title.trim() ? 0.5 : 1}}>
                    {saving ? "Enregistrement..." : modal.editing ? "Mettre à jour" : "Créer"}
                  </button>
                </div>
              </div>
            </div>

            <style href="event-type-modal">{`
              .modal-input {
                width: 100%; box-sizing: border-box;
                padding: 10px 12px; border-radius: 8px;
                border: 1px solid rgba(0,0,0,0.12);
                font-size: 14px; font-family: 'Inter', sans-serif;
                outline: none; margin-top: 4px;
                background: #fff; transition: border-color 0.15s;
              }
              .modal-input:focus { border-color: #242424; }
              textarea.modal-input { min-height: 60px; }
              select.modal-input { cursor: pointer; }
            `}</style>
          </>
        )}

        <style href="event-types-hover">{`
          .card-hover:hover { background: #f9fafb; border-color: rgba(0,0,0,0.08); }
        `}</style>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", minHeight: "100vh", fontFamily: "'Inter',system-ui,sans-serif",color:"#242424",background:"#fff" },
  sidebar: { width: 220, padding: "28px 20px", borderRight: "1px solid rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", flexShrink: 0 },
  content: { flex: 1, padding: "40px 48px", maxWidth: 800 },
  primaryBtn: { padding:"10px 20px",borderRadius:9999,background:"#242424",color:"#fff",border:"none",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" },
  secondaryBtn: { padding:"10px 20px",borderRadius:9999,background:"#fff",color:"#242424",border:"1px solid rgba(0,0,0,0.12)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" },
  chipBtn: { fontSize:12,color:"#242424",background:"#f9fafb",border:"1px solid rgba(0,0,0,0.08)",padding:"6px 12px",borderRadius:9999,cursor:"pointer",fontFamily:"'Inter',sans-serif" },
  label: { display:"flex",flexDirection:"column",fontSize:13,fontWeight:600,color:"#242424",gap:2 },
  backdrop: { position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:100,backdropFilter:"blur(2px)" },
  modal: { position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"#fff",borderRadius:16,padding:"28px 32px",width:560,maxHeight:"85vh",overflowY:"auto",zIndex:101,boxShadow:"0 20px 60px rgba(0,0,0,0.15)" },
};
