import { createFileRoute } from "@tanstack/react-router";
import { validateHost } from "@/lib/ping-validate";

// Basic per-IP rate limit (per worker instance): 10 requests / minute.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 10;
}

const API = "https://api.globalping.io/v1/measurements";

export const Route = createFileRoute("/api/ping")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "anon";
        if (limited(ip)) return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });

        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
        const v = validateHost((body as { host?: unknown })?.host);
        if (!v.ok) return Response.json({ error: v.error }, { status: 400 });

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const token = process.env["GLOBALPING_TOKEN"];
        if (token) headers["Authorization"] = `Bearer ${token}`;

        try {
          const create = await fetch(API, {
            method: "POST", headers,
            body: JSON.stringify({ type: "ping", target: v.host, limit: 1, measurementOptions: { packets: 4 } }),
          });
          const created = await create.json();
          if (!create.ok) {
            return Response.json({ error: created?.error?.message ?? "Ping could not be started." }, { status: 400 });
          }
          const deadline = Date.now() + 20_000;
          let m: any;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 700));
            m = await (await fetch(`${API}/${created.id}`)).json();
            if (m.status !== "in-progress") break;
          }
          const probe = m?.results?.[0];
          const r = probe?.result;
          if (!r || r.status === "in-progress") return Response.json({ error: "Ping timed out." }, { status: 504 });
          const stats = r.stats ?? {};
          const sent = stats.total ?? 4;
          const received = stats.rcv ?? 0;
          return Response.json({
            host: v.host,
            resolvedAddress: r.resolvedAddress ?? null,
            reachable: received > 0,
            sent, received,
            loss: stats.loss ?? (sent ? ((sent - received) / sent) * 100 : 100),
            min: stats.min ?? null, avg: stats.avg ?? null, max: stats.max ?? null,
            replies: (r.timings ?? []).map((t: { rtt: number; ttl: number }) => ({ rtt: t.rtt, ttl: t.ttl })),
            raw: r.rawOutput ?? "",
            probe: probe.probe ? `${probe.probe.city}, ${probe.probe.country} (${probe.probe.network})` : null,
          });
        } catch (e) {
          console.error(e);
          return Response.json({ error: "Ping service unavailable." }, { status: 502 });
        }
      },
    },
  },
});
