"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

type Participant = { id: string; name: string; availabilities: { date: string; time: string }[] };
type EventDay = { id: string; date: string };
type Event = { id: string; title: string; creatorName: string; timezone: string; timeRangeStart: string; timeRangeEnd: string; days: EventDay[]; participants: Participant[] };

export default function EventPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [eventData, setEventData] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [nameInput, setNameInput] = useState("");

  // Grid state for logged-in user's selections
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');
  const [saving, setSaving] = useState(false);
  const [hoverStatus, setHoverStatus] = useState<{ visible: boolean, x: number, y: number, details: any } | null>(null);
  const [activeTab, setActiveTab] = useState<'yours' | 'group'>('yours');
  const [isCreator, setIsCreator] = useState(false);
  const [isPaintMode, setIsPaintMode] = useState(false);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Polling data
  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("Event not found");
      const data = await res.json();
      setEventData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    setIsCreator(localStorage.getItem(`reuniator_creator_${eventId}`) === "true");
    
    const savedName = localStorage.getItem('reuniator_name');
    if (savedName && eventData) {
      const p = eventData.participants.find(p => p.name === savedName);
      if (p) {
        setCurrentUser({ id: p.id, name: p.name });
        const userCells = new Set<string>();
        p.availabilities.forEach(a => userCells.add(`${a.date}T${a.time}`));
        setSelectedCells(userCells);
      } else {
        setNameInput(savedName);
      }
    }
  }, [eventData]);

  const joinEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    try {
      const res = await fetch(`/api/events/${eventId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() })
      });
      const data = await res.json();
      if (data.participant) {
        localStorage.setItem(`reuniator_name`, data.participant.name);
        setCurrentUser({ id: data.participant.id, name: data.participant.name });
        fetchEvent();
      }
    } catch {
      alert("Failed to join.");
    }
  };

  // Generate times
  const timeOptions = [];
  if (eventData) {
    let [sh, sm] = eventData.timeRangeStart.split(":").map(Number);
    let [eh, em] = eventData.timeRangeEnd.split(":").map(Number);
    let currentMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    if (endMins < currentMins) endMins += 24 * 60;
    
    for (let m = currentMins; m <= endMins; m += 15) {
      let hh = Math.floor(m / 60) % 24;
      let mm = m % 60;
      timeOptions.push(`${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`);
    }
  }

  // --- Interaction Logic (Mouse + Touch) ---
  const handleStart = (dateStr: string, timeStr: string) => {
    if (!currentUser) return;
    const cellKey = `${dateStr}T${timeStr}`;
    const newMode = selectedCells.has(cellKey) ? 'remove' : 'add';
    setIsDragSelecting(true);
    setDragMode(newMode);
    updateCell(cellKey, newMode);
  };

  const handleMove = (dateStr: string, timeStr: string) => {
    if (!currentUser || !isDragSelecting) return;
    const cellKey = `${dateStr}T${timeStr}`;
    updateCell(cellKey, dragMode);
  };

  const handleEnd = () => {
    if (isDragSelecting) {
      setIsDragSelecting(false);
      saveAvailability();
    }
  };

  const updateCell = (cellKey: string, mode: 'add' | 'remove') => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (mode === 'add') next.add(cellKey);
      else next.delete(cellKey);
      return next;
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragSelecting || !isPaintMode) return;
    e.preventDefault(); 
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const dateAttr = el.getAttribute('data-date');
    const timeAttr = el.getAttribute('data-time');
    if (dateAttr && timeAttr) {
      handleMove(dateAttr, timeAttr);
    }
  };

  const saveAvailability = async () => {
    if (!currentUser) return;
    setSaving(true);
    const arr = Array.from(selectedCells).map(c => {
      const [d, t] = c.split("T");
      return { date: d, time: t };
    });
    
    await fetch(`/api/events/${eventId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: currentUser.id, availabilities: arr })
    });
    
    setSaving(false);
    fetchEvent();
  };

  if (loading) return <div className="layout-container">Loading...</div>;
  if (error || !eventData) return <div className="layout-container">Error: {error}</div>;

  // Heatmap Aggregation
  const heatmapCounts: Record<string, number> = {};
  const heatmapUsers: Record<string, string[]> = {};
  
  eventData.participants.forEach(p => {
    p.availabilities.forEach(a => {
      const key = `${a.date}T${a.time}`;
      heatmapCounts[key] = (heatmapCounts[key] || 0) + 1;
      if (!heatmapUsers[key]) heatmapUsers[key] = [];
      heatmapUsers[key].push(p.name);
    });
  });

  const maxParticipants = Math.max(1, eventData.participants.length);

  return (
    <main 
      className="layout-container" 
      onMouseUp={handleEnd} 
      onMouseLeave={handleEnd} 
      style={{ userSelect: "none" }}
    >
      <h1 style={{ textAlign: "center", marginBottom: "0.5rem" }}>{eventData.title}</h1>
      <p style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: "2rem" }}>
        Timezone: {eventData.timezone || "Local"}
      </p>

      {!currentUser && (
        <div className="glass-panel animate-in" style={{ maxWidth: "400px", margin: "0 auto", marginBottom: "2rem" }}>
          <h2>Who are you?</h2>
          <form onSubmit={joinEvent}>
            <input 
              value={nameInput} 
              onChange={e => setNameInput(e.target.value)} 
              placeholder="Enter your name to vote" 
              autoFocus
            />
            <button type="submit" className="btn-primary" style={{ marginTop: "1rem", width: "100%" }}>
              Sign In
            </button>
          </form>
        </div>
      )}

      {currentUser && (
        <>
          <div className="mobile-tabs animate-in">
            <button className={`btn-tab ${activeTab === 'yours' ? 'active' : ''}`} onClick={() => setActiveTab('yours')}>Your Availability</button>
            <button className={`btn-tab ${activeTab === 'group' ? 'active' : ''}`} onClick={() => setActiveTab('group')}>Group Availability</button>
          </div>

          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-start" }}>
            
            {/* Your Availability */}
            <div className={`glass-panel ${activeTab !== 'yours' ? 'hide-on-mobile' : ''}`} style={{ flex: "1 1 300px", maxWidth: "500px", width: "100%" }}>
            <h2 style={{ fontSize: "1.25rem", textAlign: "center", marginBottom: isCreator ? "0.5rem" : "1rem" }}>Your Availability</h2>
            {isCreator && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(window.location.href);
                    alert("Link copiado para a área de transferência!");
                  }}
                  className="btn-primary"
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", borderRadius: "8px", border: "none" }}
                >
                  📋 Copiar Link de Compartilhamento
                </button>
              </div>
            )}
            
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem", gap: "10px" }} className="hide-on-desktop">
              <button 
                onClick={(e) => { e.preventDefault(); setIsPaintMode(false); }}
                className={`btn-secondary`}
                style={{ padding: "0.25rem 0.75rem", fontSize: "0.80rem", borderRadius: "16px", border: "1px solid var(--primary)", background: !isPaintMode ? "var(--primary)" : "rgba(255,255,255,0.05)", color: !isPaintMode ? "white" : "var(--text-muted)" }}
              >
                👆 Tocar e Rolar
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); setIsPaintMode(true); }}
                className={`btn-secondary`}
                style={{ padding: "0.25rem 0.75rem", fontSize: "0.80rem", borderRadius: "16px", border: "1px dashed var(--primary)", background: isPaintMode ? "var(--primary)" : "rgba(255,255,255,0.05)", color: isPaintMode ? "white" : "var(--text-muted)" }}
              >
                🖌️ Pintar Rápido
              </button>
            </div>

            <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              {isPaintMode ? "Arraste o dedo para preencher os horários em série." : "Toque nos horários individuais. Role a tela livremente."}
            </p>
            
            <div 
              style={{ overflowX: "auto", paddingBottom: "10px", touchAction: isPaintMode ? "none" : "auto" }}
              onTouchMove={isPaintMode ? handleTouchMove : undefined}
            >
              <div style={{ display: "flex", gap: "2px", minWidth: "max-content" }}>
                <div style={{ width: "50px", flexShrink: 0 }} /> 
                {eventData.days.map(d => (
                  <div key={d.date} style={{ width: "60px", flexShrink: 0, textAlign: "center", fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: "600" }}>
                    {formatDate(d.date)}
                  </div>
                ))}
              </div>

              {timeOptions.map(t => (
                <div key={t} style={{ display: "flex", gap: "2px", marginBottom: "2px", minWidth: "max-content" }}>
                  <div style={{ width: "50px", flexShrink: 0, fontSize: "0.80rem", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "4px" }}>
                    {t.endsWith("00") ? t : ""}
                  </div>
                  {eventData.days.map(d => {
                    const key = `${d.date}T${t}`;
                    const isSelected = selectedCells.has(key);
                    return (
                      <div
                        key={key}
                        data-date={d.date}
                        data-time={t}
                        onMouseDown={() => handleStart(d.date, t)}
                        onMouseEnter={() => handleMove(d.date, t)}
                        onTouchStart={isPaintMode ? () => handleStart(d.date, t) : undefined}
                        style={{
                          width: "60px",
                          height: "36px", // Increased height for mobile!
                          flexShrink: 0,
                          cursor: "crosshair",
                          background: isSelected ? "var(--primary)" : "rgba(255, 255, 255, 0.05)",
                          border: "1px solid var(--card-border)",
                          borderRadius: "4px",
                          transition: "background-color 0.15s ease"
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            {saving && <p style={{ textAlign: "center", fontSize: "0.9rem", color: "var(--accent)", marginTop: "1rem" }}>Saving...</p>}
          </div>

          {/* Group Heatmap */}
          <div className={`glass-panel ${activeTab !== 'group' ? 'hide-on-mobile' : ''}`} style={{ flex: "1 1 600px", maxWidth: "800px", width: "100%" }}>
            <h2 style={{ fontSize: "1.25rem", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
              Group Availability
              <button onClick={(e) => { e.preventDefault(); fetchEvent(); }} className="btn-secondary" style={{ display: "flex", alignItems: "center", padding: "0.25rem 0.5rem", fontSize: "0.85rem", borderRadius: "12px", border: "1px solid var(--card-border)", background: "rgba(255,255,255,0.05)" }}>
                ↻ Atualizar
              </button>
            </h2>
            <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              {eventData.participants.length} Participant{eventData.participants.length !== 1 ? 's' : ''}
            </p>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ overflowX: "auto", paddingBottom: "10px", flex: "1 1 min-content", maxWidth: "100%" }}>
              <div style={{ display: "flex", gap: "2px", minWidth: "max-content" }}>
                <div style={{ width: "50px", flexShrink: 0 }} /> 
                {eventData.days.map(d => (
                  <div key={d.date} style={{ width: "60px", flexShrink: 0, textAlign: "center", fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: "600" }}>
                    {formatDate(d.date)}
                  </div>
                ))}
              </div>

              {timeOptions.map(t => (
                <div key={t} style={{ display: "flex", gap: "2px", marginBottom: "2px", minWidth: "max-content" }}>
                  <div style={{ width: "50px", flexShrink: 0, fontSize: "0.80rem", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "4px" }}>
                    {t.endsWith("00") ? t : ""}
                  </div>
                  {eventData.days.map(d => {
                    const key = `${d.date}T${t}`;
                    const count = heatmapCounts[key] || 0;
                    const ratio = count / maxParticipants;
                    
                    const availableNames = heatmapUsers[key] || [];
                    const unavailableNames = eventData.participants
                      .filter(p => !availableNames.includes(p.name))
                      .map(p => p.name);

                    const tooltipText = `${d.date} às ${t}\nDisponíveis: ${availableNames.length ? availableNames.join(", ") : "Ninguém"}\nIndisponíveis: ${unavailableNames.length ? unavailableNames.join(", ") : "Ninguém"}`;

                    return (
                      <div
                        key={key}
                        onClick={(e) => {
                          setHoverStatus({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            details: { time: t, date: d.date, available: availableNames, unavailable: unavailableNames }
                          });
                        }}
                        onMouseEnter={(e) => {
                          setHoverStatus({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            details: { time: t, date: d.date, available: availableNames, unavailable: unavailableNames }
                          });
                        }}
                        onMouseLeave={() => {
                          setHoverStatus(prev => prev ? { ...prev, visible: false } : null);
                        }}
                        style={{
                          width: "60px",
                          height: "36px",
                          flexShrink: 0,
                          background: count > 0 ? `rgba(16, 185, 129, ${Math.max(0.2, ratio)})` : "rgba(255, 255, 255, 0.05)",
                          border: "1px solid var(--card-border)",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.85rem",
                          fontWeight: "bold",
                          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                          color: count > 0 ? "#ffffff" : "transparent",
                          cursor: "pointer",
                          transition: "background-color 0.2s"
                        }}
                      >
                        {count > 0 ? count : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {hoverStatus && hoverStatus.visible && (
        <div style={{
          position: "fixed",
          left: Math.min(hoverStatus.x + 15, typeof window !== 'undefined' ? window.innerWidth - 260 : 0) + "px",
          top: Math.min(hoverStatus.y + 15, typeof window !== 'undefined' ? window.innerHeight - 200 : 0) + "px",
          zIndex: 9999,
          pointerEvents: "none",
          width: "250px",
          padding: "1rem", 
          backgroundColor: "rgba(10, 10, 15, 0.95)", 
          backdropFilter: "blur(8px)", 
          border: "1px solid var(--primary)", 
          borderRadius: "8px", 
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
          color: "white", 
          fontSize: "0.9rem"
        }}>
           <h3 style={{ marginBottom: "0.5rem", fontSize: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.5rem", marginTop: 0 }}>
              {formatDate(hoverStatus.details.date)} às {hoverStatus.details.time}
           </h3>
           <div style={{ marginBottom: "0.5rem" }}>
              <strong style={{ color: "var(--success)" }}>Disponíveis ({hoverStatus.details.available.length}):</strong><br/>
              <span style={{ color: "var(--foreground)", wordBreak: "break-word" }}>{hoverStatus.details.available.length ? hoverStatus.details.available.join(", ") : "Ninguém"}</span>
           </div>
           <div>
              <strong style={{ color: "var(--danger)" }}>Indisponíveis ({hoverStatus.details.unavailable.length}):</strong><br/>
              <span style={{ color: "var(--text-muted)", wordBreak: "break-word" }}>{hoverStatus.details.unavailable.length ? hoverStatus.details.unavailable.join(", ") : "Ninguém"}</span>
           </div>
        </div>
      )}
    </main>
  );
}
