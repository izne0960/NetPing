import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ping — Network Diagnostic Tool" },
      { name: "description", content: "Run real ICMP pings to any public host or IP and inspect latency, packet loss and raw output." },
      { property: "og:title", content: "Ping — Network Diagnostic Tool" },
      { property: "og:description", content: "Real ICMP ping from your browser: latency, packet loss and raw output." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Result = {
  host: string; resolvedAddress: string | null; reachable: boolean;
  sent: number; received: number; loss: number;
  min: number | null; avg: number | null; max: number | null;
  replies: { rtt: number; ttl: number }[]; raw: string; probe: string | null;
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl ${tone === "ok" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Index() {
  const [host, setHost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function ping(e?: React.FormEvent) {
    e?.preventDefault();
    if (!host.trim() || loading) return;
    setLoading(true); setError(null); setRes(null);
    try {
      const r = await fetch("/api/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ host: host.trim() }) });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "Ping failed."); else setRes(j);
    } catch { setError("Network error."); }
    setLoading(false);
  }

  function clear() { setHost(""); setRes(null); setError(null); }
  async function copy() {
    if (!res) return;
    await navigator.clipboard.writeText(res.raw);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  const maxRtt = Math.max(1, ...(res?.replies.map((r) => r.rtt) ?? [1]));

  return (
    <main className="min-h-screen bg-grid px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-3">
          <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-success" /></span>
          <h1 className="font-display text-2xl font-semibold tracking-tight">ping<span className="text-muted-foreground">.tool</span></h1>
          <span className="ml-auto font-mono text-xs text-muted-foreground">ICMP · 4 packets</span>
        </header>

        <form onSubmit={ping} className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-panel">
          <label htmlFor="host" className="text-xs uppercase tracking-widest text-muted-foreground">Target host</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input id="host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="google.com or 1.1.1.1" autoComplete="off" spellCheck={false} maxLength={253}
              className="flex-1 rounded-lg border border-input bg-background px-4 py-3 font-mono text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            <button type="submit" disabled={loading || !host.trim()} className="rounded-lg bg-primary px-8 py-3 font-display text-base font-bold tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-50">
              {loading ? "PINGING…" : "PING"}
            </button>
            <button type="button" onClick={clear} className="rounded-lg border border-border px-5 py-3 text-sm font-semibold tracking-widest text-muted-foreground hover:text-foreground">CLEAR</button>
          </div>
          {error && <p className="mt-3 font-mono text-sm text-destructive">✕ {error}</p>}
        </form>

        {loading && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card p-5 font-mono text-sm text-muted-foreground">
            <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 150}ms` }} />)}</div>
            Sending ICMP echo requests to {host}…
          </div>
        )}

        {res && (
          <section className="mt-6 space-y-4">
            <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-5 ${res.reachable ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}>
              <span className={`h-3 w-3 rounded-full ${res.reachable ? "bg-success" : "bg-destructive"}`} />
              <span className={`font-display text-lg font-bold tracking-widest ${res.reachable ? "text-success" : "text-destructive"}`}>{res.reachable ? "REACHABLE" : "UNREACHABLE"}</span>
              <span className="font-mono text-sm text-foreground">{res.host}{res.resolvedAddress && res.resolvedAddress !== res.host ? ` → ${res.resolvedAddress}` : ""}</span>
              {res.probe && <span className="w-full font-mono text-xs text-muted-foreground sm:ml-auto sm:w-auto">from {res.probe}</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Sent" value={String(res.sent)} />
              <Stat label="Received" value={String(res.received)} tone={res.received > 0 ? "ok" : "bad"} />
              <Stat label="Loss" value={`${res.loss.toFixed(0)}%`} tone={res.loss === 0 ? "ok" : "bad"} />
              <Stat label="Avg latency" value={res.avg != null ? `${res.avg.toFixed(1)} ms` : "—"} />
            </div>
            {res.replies.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Replies</div>
                <ul className="space-y-2 font-mono text-sm">
                  {res.replies.map((r, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="w-10 text-muted-foreground">#{i + 1}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.rtt / maxRtt) * 100}%` }} /></div>
                      <span className="w-24 text-right">{r.rtt.toFixed(1)} ms</span>
                      <span className="hidden w-16 text-right text-muted-foreground sm:inline">ttl {r.ttl}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-border bg-terminal">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="font-mono text-xs text-muted-foreground">$ ping -c 4 {res.host}</span>
                <button onClick={copy} className="rounded border border-border px-3 py-1 font-mono text-xs text-muted-foreground hover:text-foreground">{copied ? "Copied ✓" : "Copy Output"}</button>
              </div>
              <pre className="max-h-80 overflow-auto p-4 font-mono text-xs leading-relaxed text-terminal-foreground sm:text-sm">{res.raw || "(no output)"}</pre>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
