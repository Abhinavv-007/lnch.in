import PageHeader from "@/components/ops/PageHeader";
import MissingIntegration from "@/components/ops/MissingIntegration";

export default function LogsCenter() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="logs" title="Logs" description="Errors, warnings, info — filter by project & severity." />
      <MissingIntegration
        title="Live log streaming not yet wired"
        reason="Cloudflare Logpush, Vercel Logs and project-side log endpoints aren't connected yet. LaunchOps reserves this surface for them."
        hint="When ready, plug Logpush → R2/D1 or stream from worker tail; LaunchOps will read those tables."
        needs={["Logpush job", "Vercel log integration", "Per-project log forwarder"]}
      />
    </div>
  );
}
