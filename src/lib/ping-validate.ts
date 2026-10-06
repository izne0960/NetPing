// Strict host validation + SSRF guard. Shared by server route.
const HOST_RE = /^(?=.{1,253}$)(?!-)([a-zA-Z0-9-]{1,63}(?<!-)\.)+[a-zA-Z]{2,63}$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_RE = /^[0-9a-fA-F:]{2,39}$/;

function privateV4(ip: string) {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  );
}

export function validateHost(raw: unknown): { ok: true; host: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Host is required." };
  const host = raw.trim().toLowerCase();
  if (!host) return { ok: false, error: "Host is required." };
  if (IPV4_RE.test(host)) {
    return privateV4(host) ? { ok: false, error: "Private, loopback and reserved addresses are blocked." } : { ok: true, host };
  }
  if (host.includes(":")) {
    if (!IPV6_RE.test(host)) return { ok: false, error: "Invalid IPv6 address." };
    if (host === "::1" || host === "::" || /^(fe8|fe9|fea|feb|fc|fd)/.test(host) || host.startsWith("::ffff:"))
      return { ok: false, error: "Private, loopback and reserved addresses are blocked." };
    return { ok: true, host };
  }
  if (!HOST_RE.test(host)) return { ok: false, error: "Enter a valid hostname or IP address." };
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal")
    return { ok: false, error: "Internal hostnames are blocked." };
  return { ok: true, host };
}
