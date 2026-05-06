import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import StatCard from "@/components/ops/StatCard";
import { api } from "@/lib/api";

type Bundle = {
  secrets: { name: string; configured: boolean; required: boolean; reason?: string }[];
  passkeys: { count: number; latest: { ts: number; label: string } | null };
  recentFailures: { ip: string; ts: number; via: string }[];
  integrationPermissions: { name: string; ok: boolean; reason?: string }[];
};

export default function SecurityCenter() {
  const [data, setData] = useState<Bundle | null>(null);
  useEffect(() => {
    api.get<Bundle>("/api/ops/security").then(setData).catch(() => setData(null));
  }, []);
  const missing = data?.secrets.filter((s) => s.required && !s.configured) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="security" title="Security center" description="Secrets, passkeys, failed logins, integration permissions." />
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Missing required secrets" value={missing.length} tone={missing.length ? "err" : "ok"} status={missing.length ? missing.map((m) => m.name).join(", ") : "All required secrets present"} />
        <StatCard label="Registered passkeys" value={data?.passkeys.count ?? "…"} tone={data && data.passkeys.count ? "ok" : "warn"} />
        <StatCard label="Recent failed logins" value={data?.recentFailures.length ?? "…"} tone={data && data.recentFailures.length ? "warn" : "ok"} />
      </section>
      <div className="panel p-5">
        <SectionTitle>Secret checklist</SectionTitle>
        <ul className="divide-y divide-ink-600/40 text-sm">
          {(data?.secrets ?? []).map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-3 py-2">
              <span className="font-mono text-xs">{s.name}</span>
              <span className={s.configured ? "pill-ok" : s.required ? "pill-err" : "pill"}>
                {s.configured ? "set" : s.required ? "missing" : "optional"}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="panel p-5">
        <SectionTitle>Integration permissions</SectionTitle>
        <ul className="divide-y divide-ink-600/40 text-sm">
          {(data?.integrationPermissions ?? []).map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-3 py-2">
              <span>{p.name}</span>
              <span className={p.ok ? "pill-ok" : "pill-err"}>{p.ok ? "ok" : (p.reason ?? "fail")}</span>
            </li>
          ))}
        </ul>
      </div>
      <PasskeysPanel />
    </div>
  );
}

type Passkey = { id: number; label: string | null; created_at: number; last_used_at: number | null };

function PasskeysPanel() {
  const [list, setList] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await api.post<{ passkeys: Passkey[] }>("/api/auth/passkeys", { action: "list" });
      setList(r.passkeys);
    } catch {
      setList(null);
    }
  }
  useEffect(() => { refresh(); }, []);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      type Begin = {
        challenge: string;
        rp: { id: string; name: string };
        user: { id: string; name: string; displayName: string };
        pubKeyCredParams: PublicKeyCredentialParameters[];
        timeout: number;
        attestation: AttestationConveyancePreference;
        excludeCredentials: { id: string; type: "public-key" }[];
        authenticatorSelection: AuthenticatorSelectionCriteria;
      };
      const begin = await api.post<Begin>("/api/auth/passkeys", { action: "register/begin" });
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: b64uToBytes(begin.challenge),
          rp: begin.rp,
          user: { id: new TextEncoder().encode(begin.user.id), name: begin.user.name, displayName: begin.user.displayName },
          pubKeyCredParams: begin.pubKeyCredParams,
          timeout: begin.timeout,
          attestation: begin.attestation,
          excludeCredentials: begin.excludeCredentials.map((c) => ({ id: b64uToBytes(c.id), type: c.type })),
          authenticatorSelection: begin.authenticatorSelection,
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("No credential created");
      const r = cred.response as AuthenticatorAttestationResponse;
      await api.post("/api/auth/passkeys", {
        action: "register/finish",
        label: prompt("Label this passkey (e.g. MacBook):") ?? null,
        credential: {
          id: cred.id,
          rawId: bytesToB64u(new Uint8Array(cred.rawId)),
          type: cred.type,
          response: {
            clientDataJSON: bytesToB64u(new Uint8Array(r.clientDataJSON)),
            attestationObject: bytesToB64u(new Uint8Array(r.attestationObject)),
          },
        },
      });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: number) {
    await api.post("/api/auth/passkeys", { action: "delete", id });
    refresh();
  }

  return (
    <div className="panel p-5">
      <SectionTitle action={<button className="btn-primary" onClick={register} disabled={busy}>Register passkey</button>}>
        Passkeys
      </SectionTitle>
      {error ? <p className="mb-2 text-xs text-red-300">{error}</p> : null}
      <ul className="divide-y divide-ink-600/40 text-sm">
        {(list ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2">
            <span>{p.label ?? `Passkey #${p.id}`}</span>
            <button className="btn-danger text-xs" onClick={() => remove(p.id)}>Revoke</button>
          </li>
        ))}
        {list && list.length === 0 ? <li className="py-2 text-ink-300">No passkeys registered yet.</li> : null}
      </ul>
    </div>
  );
}

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
