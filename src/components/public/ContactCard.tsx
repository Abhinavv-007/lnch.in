import { useState, type FormEvent } from "react";
import { Mail, ArrowUpRight } from "lucide-react";

/**
 * Public contact card on the landing page. Posts to
 * `/api/public/support` (Resend-backed, KV rate-limited 5/IP/day).
 *
 * Visual is a poster-card to match the rest of the landing — eyebrow +
 * serif italic headline, mono labels, gilt-accented submit pill.
 *
 * Failure / rate-limit feedback is rendered inline; the form itself
 * never exposes the upstream Resend API key.
 */
type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok" }
  | { kind: "rate"; retryInSec: number }
  | { kind: "error"; message: string };

const FROM_HINT = "Direct line to 67 · usually <24h";

export default function ContactCard() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending") return;
    if (
      name.trim().length < 2 ||
      !email.includes("@") ||
      message.trim().length < 8
    ) {
      setState({
        kind: "error",
        message: "Need a name, a real email, and at least one full sentence.",
      });
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/public/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          source: "landing",
        }),
      });
      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as {
          retryAfterSec?: number;
        } | null;
        setState({
          kind: "rate",
          retryInSec: body?.retryAfterSec ?? 60 * 60,
        });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        setState({
          kind: "error",
          message: body?.message ?? `delivery failed (${res.status})`,
        });
        return;
      }
      setState({ kind: "ok" });
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setState({
        kind: "error",
        message: "delivery failed — check your connection and retry",
      });
    }
  }

  return (
    <div className="poster-card">
      <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
        <div className="min-w-0">
          <p className="poster-eyebrow">say hi</p>
          <h3 className="poster-headline poster-headline--md mt-2">
            Direct <span className="accent">line.</span>
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-soft">
            Issue with one of the projects? Want to swap notes? Hiring?
            Send a message and it lands in my inbox via Resend.
          </p>
          <div className="mt-6 space-y-3 text-xs text-fg-soft">
            <p className="flex items-center gap-2">
              <Mail className="h-3 w-3 text-accent" />
              <code className="text-accent">67@abhnv.in</code>
            </p>
            <p>{FROM_HINT}</p>
            <p className="text-muted">
              5 messages / IP / 24h · spam goes nowhere
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="grid gap-3 text-sm"
          aria-describedby="contact-status"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Name"
              value={name}
              onChange={setName}
              placeholder="Ada Lovelace"
              autoComplete="name"
              required
            />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@domain.com"
              autoComplete="email"
              required
            />
          </div>
          <Field
            label="Subject"
            value={subject}
            onChange={setSubject}
            placeholder="API rate-limit on /api/public/probes"
          />
          <label className="flex flex-col gap-1.5">
            <span className="poster-eyebrow text-muted">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's up?"
              required
              minLength={8}
              maxLength={4000}
              className="min-h-[7rem] resize-vertical rounded-xl border border-rule bg-paper-elev px-3 py-2 text-sm text-fg outline-none transition focus:border-accent"
            />
          </label>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              disabled={state.kind === "sending"}
              className="poster-button poster-button--primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.kind === "sending" ? "Sending…" : "Send message"}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <p
              id="contact-status"
              role="status"
              aria-live="polite"
              className="text-xs"
            >
              {state.kind === "ok" ? (
                <span className="text-accent">
                  Sent. I'll reply from <code>67@abhnv.in</code>.
                </span>
              ) : state.kind === "rate" ? (
                <span className="text-muted">
                  Rate-limited — try again in{" "}
                  {Math.max(1, Math.round(state.retryInSec / 60))} min.
                </span>
              ) : state.kind === "error" ? (
                <span className="text-[color:var(--signal-err)]">
                  {state.message}
                </span>
              ) : (
                <span className="text-muted">Encrypted in transit · TLS</span>
              )}
            </p>
          </div>
        </form>
      </div>
      <div className="poster-footer-strip mt-8">
        <span className="poster-footer-strip__brand">
          <span className="poster-bullet" />
          LNCH.IN · contact
        </span>
        <span>Resend · KV rate-limited</span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email";
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="poster-eyebrow text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="rounded-xl border border-rule bg-paper-elev px-3 py-2 text-sm text-fg outline-none transition focus:border-accent"
      />
    </label>
  );
}
