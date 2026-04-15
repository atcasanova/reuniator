"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ScheduleConfigurator() {
  const defaultTimeRangeStart = "09:00";
  const defaultTimeRangeEnd = "17:00";
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = searchParams.get("title");

  // Redirect back if missing params
  useEffect(() => {
    if (!title) {
      router.push("/");
    }
  }, [title, router]);

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [timeRangeStart, setTimeRangeStart] = useState(defaultTimeRangeStart);
  const [timeRangeEnd, setTimeRangeEnd] = useState(defaultTimeRangeEnd);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Generate monthly calendar
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = new Date(year, month, 1).getDay(); // 0 = Sunday

  const toggleDate = (dateStr: string) => {
    const newDates = new Set(selectedDates);
    if (newDates.has(dateStr)) {
      newDates.delete(dateStr);
    } else {
      newDates.add(dateStr);
    }
    setSelectedDates(newDates);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleCreate = async () => {
    if (selectedDates.size === 0) {
      setError("Please select at least one date.");
      return;
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          creatorName: "Anônimo", // Fixed to satisfy database constraint without needing migration
          dates: Array.from(selectedDates).sort(),
          timeRangeStart,
          timeRangeEnd,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create event");
      }

      const data = await response.json();
      
      localStorage.setItem(`reuniator_creator_${data.id}`, "true");
      
      router.push(`/event/${data.id}`);
    } catch {
      setError("Something went wrong while creating the event.");
      setIsSubmitting(false);
    }
  };

  // Generate 15-min time options
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hours = h.toString().padStart(2, "0");
      const mins = m.toString().padStart(2, "0");
      timeOptions.push(`${hours}:${mins}`);
    }
  }

  const startOptions = timeOptions.filter((t) => t <= timeRangeEnd);
  const endOptions = timeOptions.filter((t) => t >= timeRangeStart);
  const hasCustomTimeRange =
    timeRangeStart !== defaultTimeRangeStart || timeRangeEnd !== defaultTimeRangeEnd;

  useEffect(() => {
    if (timeRangeStart > timeRangeEnd) {
      setTimeRangeEnd(timeRangeStart);
    }
  }, [timeRangeStart, timeRangeEnd]);

  const resetTimeRange = () => {
    setTimeRangeStart(defaultTimeRangeStart);
    setTimeRangeEnd(defaultTimeRangeEnd);
  };

  if (!title) return null;

  return (
    <main className="layout-container" style={{ alignItems: "center" }}>
      <div className="glass-panel animate-in" style={{ width: "100%", maxWidth: "800px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Schedule Constraints</h2>
        <p style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: "2rem" }}>
          Select the possible dates and time range for <strong style={{ color: "var(--foreground)" }}>{title}</strong>.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", justifyContent: "space-between" }}>
          
          {/* Calendar Section */}
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <button onClick={prevMonth} className="btn-secondary" style={{ padding: "0.5rem 1rem" }}>&larr;</button>
              <h3 style={{ margin: 0 }}>
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={nextMonth} className="btn-secondary" style={{ padding: "0.5rem 1rem" }}>&rarr;</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", textAlign: "center" }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "0.5rem" }}>{d}</div>
              ))}
              
              {/* Blanks */}
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              
              {/* Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayStr = String(i + 1).padStart(2, '0');
                const monthStr = String(month + 1).padStart(2, '0');
                const dateStr = `${year}-${monthStr}-${dayStr}`;
                const isSelected = selectedDates.has(dateStr);
                
                return (
                  <div 
                    key={dateStr}
                    onClick={() => toggleDate(dateStr)}
                    style={{
                      aspectRatio: "1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      borderRadius: "8px",
                      background: isSelected ? "var(--primary)" : "rgba(255, 255, 255, 0.05)",
                      color: isSelected ? "white" : "inherit",
                      transition: "all 0.2s ease",
                      border: "1px solid var(--card-border)"
                    }}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
            <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center" }}>
              {selectedDates.size} date{selectedDates.size !== 1 && 's'} selected
            </p>
          </div>

          {/* Time Range Section */}
          <div style={{ flex: "1 1 250px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <label htmlFor="timeStart">No earlier than</label>
              <select 
                id="timeStart" 
                value={timeRangeStart} 
                onChange={(e) => setTimeRangeStart(e.target.value)}
              >
                {startOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="timeEnd">No later than</label>
              <select 
                id="timeEnd" 
                value={timeRangeEnd} 
                onChange={(e) => setTimeRangeEnd(e.target.value)}
              >
                {endOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <button
              type="button"
              onClick={resetTimeRange}
              className="btn-secondary"
              disabled={!hasCustomTimeRange}
            >
              Reset time range
            </button>

            <div style={{ flexGrow: 1 }} />
            
            {error && <p style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{error}</p>}
            
            <button 
              onClick={handleCreate} 
              className="btn-primary" 
              disabled={isSubmitting}
              style={{ width: "100%", padding: "1rem" }}
            >
              {isSubmitting ? "Creating..." : "Create Event"}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="layout-container">Loading...</div>}>
      <ScheduleConfigurator />
    </Suspense>
  );
}
