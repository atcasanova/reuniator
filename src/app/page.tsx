"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide an event title to proceed.");
      return;
    }
    setError("");
    const params = new URLSearchParams();
    params.set("title", title);
    router.push(`/create/schedule?${params.toString()}`);
  };

  return (
    <main className="layout-container" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="glass-panel animate-in" style={{ width: "100%", maxWidth: "500px" }}>
        <h1 style={{ textAlign: "center", fontSize: "2.5rem" }}>Reuniator</h1>
        <p style={{ textAlign: "center", marginBottom: "2rem", color: "var(--text-muted)" }}>
          Find the best time for everyone to meet, effortlessly.
        </p>

        <form onSubmit={handleNext} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <label htmlFor="title">Event Title</label>
            <input
              id="title"
              type="text"
              placeholder="e.g., Project Kickoff, Board Game Night"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>


          {error && <p style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{error}</p>}

          <button type="submit" className="btn-primary" style={{ marginTop: "1rem" }}>
            Next Step
          </button>
        </form>
      </div>
    </main>
  );
}
