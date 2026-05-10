/**
 * POST /api/public/support
 *
 * Public contact endpoint. Validates payload server-side, KV rate-limits
 * to 5 messages per IP per 24h, then ships the message via Resend to
 * abhnv@abhnv.in. The Resend API key never leaves the Worker.
 *
 * Request body (application/json):
 *   { name: string, email: string, subject?: string, message: string, source?: string }
 *
 * Responses:
 *   200 { ok: true, id: string }
 *   400 { ok: false, message: string }
 *   429 { ok: false, message: "rate-limited", retryAfterSec: number }
 *   502 { ok: false, message: "upstream delivery failed" }
 *
 * Configuration:
 *   - RESEND_API_KEY      (required) — Resend API key
 *   - RESEND_FROM_ADDR    (optional) — defaults to "lnch.in <hello@lnch.in>"
 *   - SUPPORT_INBOX       (optional) — defaults to "abhnv@abhnv.in"
 */
import { type Env, json, nowSec } from "../../_lib/env";

type Body = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  source?: string;
};

const MAX_PER_DAY = 5;
const KV_PREFIX = "support:rl:";

function clientIP(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anon"
  );
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, message: "invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const subject = (body.subject ?? "").trim().slice(0, 200);
  const message = (body.message ?? "").trim();
  const source = (body.source ?? "landing").trim().slice(0, 60);

  if (name.length < 2 || name.length > 120) {
    return json({ ok: false, message: "name must be 2–120 chars" }, { status: 400 });
  }
  if (!isEmail(email) || email.length > 200) {
    return json({ ok: false, message: "valid email required" }, { status: 400 });
  }
  if (message.length < 8 || message.length > 4000) {
    return json(
      { ok: false, message: "message must be 8–4000 chars" },
      { status: 400 },
    );
  }

  // KV-backed rate limit: 5 deliveries / IP / 24h. We use a fixed-window
  // counter keyed by the UTC day so the bucket resets at midnight UTC and
  // the TTL handles any drift after a restart.
  const ip = clientIP(request);
  const day = Math.floor(nowSec() / 86400);
  const rlKey = `${KV_PREFIX}${day}:${ip}`;
  const kv = (env as unknown as { LAUNCHOPS_KV?: KVNamespace }).LAUNCHOPS_KV;
  if (kv) {
    try {
      const cur = parseInt((await kv.get(rlKey)) ?? "0", 10) || 0;
      if (cur >= MAX_PER_DAY) {
        const remainingDay = 86400 - (nowSec() % 86400);
        return json(
          {
            ok: false,
            message: "rate-limited",
            retryAfterSec: remainingDay,
          },
          { status: 429, headers: { "retry-after": String(remainingDay) } },
        );
      }
      // Increment first; if delivery fails we still count the attempt to
      // keep abusers honest. TTL = 36h to overlap the day window safely.
      await kv.put(rlKey, String(cur + 1), { expirationTtl: 60 * 60 * 36 });
    } catch {
      /* KV outage shouldn't block real users — fail-open on the limiter */
    }
  }

  const apiKey = (env as unknown as { RESEND_API_KEY?: string }).RESEND_API_KEY;
  const fromAddr =
    (env as unknown as { RESEND_FROM_ADDR?: string }).RESEND_FROM_ADDR ??
    "lnch.in <hello@lnch.in>";
  const inbox =
    (env as unknown as { SUPPORT_INBOX?: string }).SUPPORT_INBOX ?? "abhnv@abhnv.in";

  if (!apiKey) {
    // Surface a clear configuration error rather than silently dropping.
    return json(
      { ok: false, message: "support endpoint not configured" },
      { status: 503 },
    );
  }

  // Build the email. Use both text and HTML parts so it threads cleanly
  // in the inbox client and the IP/day audit footer survives even if HTML
  // is stripped.
  const subjectLine = subject ? `[lnch.in] ${subject}` : `[lnch.in] message from ${name}`;
  const text = [
    `From: ${name} <${email}>`,
    `Source: ${source}`,
    `IP: ${ip}`,
    `Sent: ${new Date(nowSec() * 1000).toISOString()}`,
    "",
    message,
  ].join("\n");
  const html = `
<div style="font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:14px;color:#1a1a1a">
  <p><strong>From:</strong> ${htmlEscape(name)} &lt;<a href="mailto:${htmlEscape(email)}">${htmlEscape(email)}</a>&gt;</p>
  <p><strong>Source:</strong> ${htmlEscape(source)}</p>
  ${subject ? `<p><strong>Subject:</strong> ${htmlEscape(subject)}</p>` : ""}
  <hr style="border:none;border-top:1px solid #ddd;margin:14px 0" />
  <pre style="font-family:inherit;white-space:pre-wrap;line-height:1.55">${htmlEscape(message)}</pre>
  <hr style="border:none;border-top:1px solid #eee;margin:14px 0" />
  <p style="color:#888;font-size:11px">IP ${htmlEscape(ip)} · ${new Date(nowSec() * 1000).toISOString()}</p>
</div>`;

  const upstream = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddr,
      to: [inbox],
      reply_to: email,
      subject: subjectLine,
      text,
      html,
    }),
  });

  if (!upstream.ok) {
    return json(
      {
        ok: false,
        message: "upstream delivery failed",
      },
      { status: 502 },
    );
  }
  const sent = (await upstream.json().catch(() => ({}))) as { id?: string };

  // Public audit is captured automatically by `_middleware.ts` for every
  // /api/public/** call (status, IP, latency, rl bucket), so no extra
  // bookkeeping is needed here.

  return json({ ok: true, id: sent.id ?? null }, { status: 200 });
};
