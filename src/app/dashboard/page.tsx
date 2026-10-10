import LegacyWorkspace from '@/components/legacy-workspace';

// In the Expo delivery profile Next rewrites this URL to the exported app.
// Standard Next keeps the existing workspace available at the same entry URL.
export default function Dashboard() { return <LegacyWorkspace />; }
