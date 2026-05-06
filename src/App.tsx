import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./routes/public/Landing";
import PublicProject from "./routes/public/PublicProject";
import OpsLayout from "./routes/ops/OpsLayout";
import OpsLogin from "./routes/ops/Login";
import Dashboard from "./routes/ops/Dashboard";
import ProjectsIndex from "./routes/ops/ProjectsIndex";
import ProjectDetail from "./routes/ops/ProjectDetail";
import GithubCenter from "./routes/ops/GithubCenter";
import DeploymentsCenter from "./routes/ops/DeploymentsCenter";
import CloudflareCenter from "./routes/ops/CloudflareCenter";
import VercelCenter from "./routes/ops/VercelCenter";
import ApiCenter from "./routes/ops/ApiCenter";
import LogsCenter from "./routes/ops/LogsCenter";
import AnalyticsCenter from "./routes/ops/AnalyticsCenter";
import ChangelogCenter from "./routes/ops/ChangelogCenter";
import NotesCenter from "./routes/ops/NotesCenter";
import TasksCenter from "./routes/ops/TasksCenter";
import SecurityCenter from "./routes/ops/SecurityCenter";
import AuditCenter from "./routes/ops/AuditCenter";
import SettingsCenter from "./routes/ops/SettingsCenter";
import IncidentsCenter from "./routes/ops/IncidentsCenter";
import NotFound from "./routes/public/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/projects/:slug" element={<PublicProject />} />

      <Route path="/ops/login" element={<OpsLogin />} />

      <Route path="/ops" element={<OpsLayout />}>
        <Route index element={<Navigate to="/ops/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="projects" element={<ProjectsIndex />} />
        <Route path="projects/:slug" element={<ProjectDetail />} />
        <Route path="projects/:slug/:section" element={<ProjectDetail />} />
        <Route path="github" element={<GithubCenter />} />
        <Route path="deployments" element={<DeploymentsCenter />} />
        <Route path="cloudflare" element={<CloudflareCenter />} />
        <Route path="vercel" element={<VercelCenter />} />
        <Route path="apis" element={<ApiCenter />} />
        <Route path="logs" element={<LogsCenter />} />
        <Route path="analytics" element={<AnalyticsCenter />} />
        <Route path="changelogs" element={<ChangelogCenter />} />
        <Route path="notes" element={<NotesCenter />} />
        <Route path="tasks" element={<TasksCenter />} />
        <Route path="incidents" element={<IncidentsCenter />} />
        <Route path="security" element={<SecurityCenter />} />
        <Route path="audit" element={<AuditCenter />} />
        <Route path="settings" element={<SettingsCenter />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
