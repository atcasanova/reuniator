"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type AdminStats = {
  activeEventCount: number;
  archivedEventCount: number;
  totalEventsEver: number;
  activeParticipants: number;
  archivedParticipants: number;
  totalParticipantsEver: number;
  activeAvailabilities: number;
  archivedAvailabilities: number;
  totalAvailabilitiesEver: number;
};

type ActiveEvent = {
  id: string;
  title: string;
  creatorName: string;
  createdAt: string;
  timezone: string;
  firstDate: string | null;
  lastDate: string | null;
  participantCount: number;
  availabilityCount: number;
};

type ArchivedEvent = {
  id: string;
  originalEventId: string;
  title: string;
  creatorName: string;
  timezone: string;
  createdAt: string;
  lastScheduledDate: string | null;
  participantCount: number;
  availabilityCount: number;
  maintenanceDeletedAt: string;
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminPage() {
  const [statusLoading, setStatusLoading] = useState(true);
  const [adminUsername, setAdminUsername] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [submittingAuth, setSubmittingAuth] = useState(false);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<ArchivedEvent[]>([]);
  const [dataError, setDataError] = useState("");

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/admin/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Não foi possível carregar status.");
      }

      setAdminUsername(data.adminUsername ?? "");
      setUsername(data.adminUsername ?? "");
      setAuthenticated(Boolean(data.authenticated));
      setRequiresSetup(Boolean(data.requiresSetup));
    } catch (error: unknown) {
      setAuthError(toErrorMessage(error, "Erro ao validar administração."));
    } finally {
      setStatusLoading(false);
    }
  };

  const loadAdminData = async () => {
    setDataError("");
    try {
      const [statsRes, eventsRes] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/events", { cache: "no-store" }),
      ]);

      if (statsRes.status === 401 || eventsRes.status === 401) {
        setAuthenticated(false);
        return;
      }

      const statsJson = await statsRes.json();
      const eventsJson = await eventsRes.json();

      if (!statsRes.ok) {
        throw new Error(statsJson.error ?? "Falha ao carregar estatísticas.");
      }

      if (!eventsRes.ok) {
        throw new Error(eventsJson.error ?? "Falha ao carregar eventos.");
      }

      setStats(statsJson);
      setActiveEvents(eventsJson.activeEvents ?? []);
      setArchivedEvents(eventsJson.archivedEvents ?? []);
    } catch (error: unknown) {
      setDataError(toErrorMessage(error, "Erro ao carregar dados administrativos."));
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!statusLoading && authenticated) {
      loadAdminData();
    }
  }, [statusLoading, authenticated]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setSubmittingAuth(true);

    const endpoint = requiresSetup ? "/api/admin/setup" : "/api/admin/login";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Falha de autenticação");
      }

      setPassword("");
      setAuthenticated(true);
      if (requiresSetup) {
        setRequiresSetup(false);
      }
      await loadAdminData();
    } catch (error: unknown) {
      setAuthError(toErrorMessage(error, "Falha de autenticação"));
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setStats(null);
    setActiveEvents([]);
    setArchivedEvents([]);
  };

  const sortedActiveEvents = useMemo(
    () => [...activeEvents].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [activeEvents],
  );

  const sortedArchivedEvents = useMemo(
    () => [...archivedEvents].sort((a, b) => +new Date(b.maintenanceDeletedAt) - +new Date(a.maintenanceDeletedAt)),
    [archivedEvents],
  );

  if (statusLoading) {
    return <main className="layout-container">Carregando painel administrativo...</main>;
  }

  return (
    <main className="layout-container" style={{ alignItems: "center" }}>
      <div className="glass-panel animate-in" style={{ width: "100%", maxWidth: "1100px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ marginBottom: "0.25rem" }}>Painel Admin</h1>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              Usuário administrativo configurado no ambiente: <strong>{adminUsername || "(não configurado)"}</strong>
            </p>
          </div>
          {authenticated && (
            <button type="button" className="btn-secondary" onClick={handleLogout}>
              Sair
            </button>
          )}
        </div>

        {authError && <p style={{ color: "var(--danger)", margin: 0 }}>{authError}</p>}

        {!authenticated && (
          <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
            <h2 style={{ marginBottom: 0 }}>{requiresSetup ? "Primeiro acesso: defina a senha" : "Entrar como administrador"}</h2>
            <div>
              <label htmlFor="admin-username">Usuário</label>
              <input id="admin-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label htmlFor="admin-password">{requiresSetup ? "Nova senha" : "Senha"}</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={requiresSetup ? "new-password" : "current-password"}
                required
                minLength={8}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={submittingAuth}>
              {submittingAuth ? "Processando..." : requiresSetup ? "Criar senha" : "Entrar"}
            </button>
          </form>
        )}

        {authenticated && (
          <>
            {stats && (
              <section>
                <h2>Estatísticas de utilização</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  <StatCard label="Eventos ativos" value={stats.activeEventCount} />
                  <StatCard label="Eventos arquivados (manutenção)" value={stats.archivedEventCount} />
                  <StatCard label="Eventos totais (histórico)" value={stats.totalEventsEver} />
                  <StatCard label="Participantes totais (histórico)" value={stats.totalParticipantsEver} />
                  <StatCard label="Marcações de disponibilidade (histórico)" value={stats.totalAvailabilitiesEver} />
                </div>
              </section>
            )}

            {dataError && <p style={{ color: "var(--danger)", margin: 0 }}>{dataError}</p>}

            <section>
              <h2>Eventos ativos</h2>
              {sortedActiveEvents.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>Nenhum evento ativo no momento.</p>
              ) : (
                <EventTable
                  headers={["Título", "Criador", "Criado em", "Período", "Participantes", "Disponibilidades", "Ações"]}
                  rows={sortedActiveEvents.map((event) => [
                    event.title,
                    event.creatorName,
                    new Date(event.createdAt).toLocaleString(),
                    `${event.firstDate ?? "-"} → ${event.lastDate ?? "-"}`,
                    String(event.participantCount),
                    String(event.availabilityCount),
                    <a key={event.id} href={`/event/${event.id}?admin=1`} className="btn-secondary" style={{ display: "inline-block", padding: "0.35rem 0.6rem" }}>
                      Abrir como admin
                    </a>,
                  ])}
                />
              )}
            </section>

            <section>
              <h2>Eventos removidos pelo script de manutenção</h2>
              {sortedArchivedEvents.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>Nenhum evento arquivado ainda.</p>
              ) : (
                <EventTable
                  headers={["Título", "Criador", "Última data", "Criado em", "Removido em", "Participantes", "Disponibilidades"]}
                  rows={sortedArchivedEvents.map((event) => [
                    event.title,
                    event.creatorName,
                    event.lastScheduledDate ?? "-",
                    new Date(event.createdAt).toLocaleString(),
                    new Date(event.maintenanceDeletedAt).toLocaleString(),
                    String(event.participantCount),
                    String(event.availabilityCount),
                  ])}
                />
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid var(--card-border)", borderRadius: "12px", padding: "0.85rem", background: "rgba(255,255,255,0.03)" }}>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>{label}</p>
      <strong style={{ fontSize: "1.4rem" }}>{value}</strong>
    </div>
  );
}

function EventTable({ headers, rows }: { headers: string[]; rows: (string | ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--card-border)", color: "var(--text-muted)", fontWeight: 500 }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex}>
              {cells.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} style={{ padding: "0.55rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
