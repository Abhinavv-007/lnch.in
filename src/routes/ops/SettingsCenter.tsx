import { useEffect, useState } from "react";
import PageHeader from "@/components/ops/PageHeader";
import SectionTitle from "@/components/ops/SectionTitle";
import StatCard from "@/components/ops/StatCard";
import { api } from "@/lib/api";
import { PROJECTS } from "@/lib/projects";

type Settings = {
  integrations: Record<"github" | "cloudflare" | "vercel" | "firebase", { configured: boolean; reason?: string }>;
  firebaseProjects: { slug: string; configured: boolean; projectId?: string }[];
  appUrl: string | null;
  rpId: string;
  origin: string;
};

export default function SettingsCenter() {
  const [data, setData] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get<Settings>("/api/ops/settings").then(setData).catch(() => setData(null));
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await api.post("/api/auth/logout", {});
      window.location.assign("/ops/login");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="settings" title="Settings" description="Integration health, identity, and the projects LaunchOps monitors." />
      <section className="poster-stagger grid gap-3 md:grid-cols-4">
        <StatCard label="GitHub" value={data?.integrations.github.configured ? "Linked" : "—"} tone={data?.integrations.github.configured ? "ok" : "neutral"} />
        <StatCard label="Cloudflare" value={data?.integrations.cloudflare.configured ? "Linked" : "—"} tone={data?.integrations.cloudflare.configured ? "ok" : "neutral"} />
        <StatCard label="Vercel" value={data?.integrations.vercel.configured ? "Linked" : "—"} tone={data?.integrations.vercel.configured ? "ok" : "neutral"} />
        <StatCard label="Firebase" value={data?.integrations.firebase.configured ? "Linked" : "—"} tone={data?.integrations.firebase.configured ? "ok" : "neutral"} />
      </section>
      <div className="panel p-5">
        <SectionTitle>Project registry</SectionTitle>
        <ul className="divide-rule text-sm">
          {PROJECTS.map((p) => {
            const fb = data?.firebaseProjects.find((f) => f.slug === p.slug);
            return (
              <li key={p.slug} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span className={p.accent}>{p.name}</span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span className="pill">{p.repo}</span>
                  {p.site ? <span className="pill">{new URL(p.site).host}</span> : null}
                  <span className={fb?.configured ? "pill-ok" : "pill"}>fb · {fb?.configured ? fb.projectId : "—"}</span>
                  <span className="pill">{p.adminSecretEnv}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="panel p-5">
        <SectionTitle>WebAuthn relying party</SectionTitle>
        <p className="text-sm text-fg-soft">
          rpId · <span className="font-mono">{data?.rpId ?? "…"}</span>
        </p>
        <p className="text-sm text-fg-soft">
          origin · <span className="font-mono">{data?.origin ?? "…"}</span>
        </p>
      </div>
      <div className="panel p-5">
        <SectionTitle>Session</SectionTitle>
        <button className="btn-danger" onClick={logout} disabled={busy}>Sign out</button>
      </div>
    </div>
  );
}
