import { redirect } from "next/navigation";
import { ManagerDashboard } from "@/components/portal/ManagerDashboard";
import { requireSession } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/portal/dashboard";

export default async function Home() {
  const session = await requireSession();

  if (session.role === "ADMIN") {
    redirect("/admin");
  }

  if (session.role === "ROP") {
    redirect("/team");
  }

  const snapshot = await getDashboardSnapshot(session.userId);

  return <ManagerDashboard snapshot={snapshot} />;
}
