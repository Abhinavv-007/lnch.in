/**
 * LaunchOps login.
 *
 * Two paths:
 *   1. Admin secret → POST /api/auth/login with { secret }
 *   2. Passkey → /api/auth/passkeys with { action: "login/begin" | "login/finish" }
 *
 * On success the server sets the HttpOnly admin_session cookie; we just bounce
 * back to ?next or /ops/dashboard.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";

type LoginStatus = { ok: boolean; passkeysAvailable?: boolean };

export default function OpsLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/ops/dashboard";
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<LoginStatus>({ ok: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .post<LoginStatus>("/api/auth/passkeys", { action: "available" })
      .then(setStatus)
      .catch(() => setStatus({ ok: false, passkeysAvailable: false }));
  }, []);

  async function submitSecret(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/login", { secret });
      navigate(next, { replace: true });
    } catch (err) {
      const e = err as ApiError;
      setError(e.message || "Invalid secret.");
    } finally {
      setBusy(false);
    }
  }

  async function loginPasskey() {
    setError(null);
    setBusy(true);
    try {
      const challenge = await api.post<{
        challenge: string;
        rpId: string;
        allowCredentials: { id: string; type: "public-key" }[];
        timeout: number;
      }>("/api/auth/passkeys", { action: "login/begin" });

      const cred = (await navigator.credentials.get({
        publicKey: {
          challenge: b64uToBytes(challenge.challenge),
          rpId: challenge.rpId,
          allowCredentials: challenge.allowCredentials.map((c) => ({
            id: b64uToBytes(c.id),
            type: c.type,
          })),
          userVerification: "preferred",
          timeout: challenge.timeout,
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("No credential returned.");
      const r = cred.response as AuthenticatorAssertionResponse;
      await api.post("/api/auth/passkeys", {
        action: "login/finish",
        credential: {
          id: cred.id,
          rawId: bytesToB64u(new Uint8Array(cred.rawId)),
          type: cred.type,
          response: {
            clientDataJSON: bytesToB64u(new Uint8Array(r.clientDataJSON)),
            authenticatorData: bytesToB64u(new Uint8Array(r.authenticatorData)),
            signature: bytesToB64u(new Uint8Array(r.signature)),
            userHandle: r.userHandle ? bytesToB64u(new Uint8Array(r.userHandle)) : null,
          },
        },
      });
      navigate(next, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Passkey login failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-stage flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-pulseGlow rounded-full bg-gilt-300" />
            </span>
            <span className="font-serif text-xl tracking-tight">
              Launch<span className="text-gilt-300">Ops</span>
            </span>
          </div>
          <h1 className="heading-display text-4xl">Operator console</h1>
          <p className="mt-2 text-sm text-ink-200">
            Restricted. Authenticate to run the command center.
          </p>
        </div>

        <div className="panel relative overflow-hidden">
          <form onSubmit={submitSecret} className="space-y-4 p-5">
            <label className="block text-xs uppercase tracking-[0.24em] text-ink-300">
              Admin secret
            </label>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-ink-300" />
              <input
                type="password"
                autoComplete="current-password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="LAUNCHOPS_ADMIN_SECRET"
                className="input-base"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy || !secret}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              Sign in with secret
            </button>

            {status.passkeysAvailable ? (
              <>
                <div className="relative my-2 text-center text-[11px] uppercase tracking-[0.28em] text-ink-300">
                  <span className="bg-ink-900 px-3">or</span>
                  <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-ink-600/60" />
                </div>
                <button
                  type="button"
                  onClick={loginPasskey}
                  disabled={busy}
                  className="btn-ghost w-full"
                >
                  <Fingerprint className="h-4 w-4" /> Use passkey
                </button>
              </>
            ) : null}

            {error ? (
              <p className="text-xs text-red-300" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-300">
          lnch.in · LaunchOps · all admin actions are audited.
        </p>
      </div>
    </main>
  );
}

// ── base64url helpers (small client-side copies of the server primitives) ──
function b64uToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const buffer = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(b: Uint8Array | ArrayBuffer): string {
  const v = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < v.length; i++) s += String.fromCharCode(v[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
