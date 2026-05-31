import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function ProfilePage() {
  const session = await requireSession();

  if (session.role === "ADMIN") {
    redirect("/admin/profile");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      department: { select: { name: true } }
    }
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="stack">
      <PageHeader eyebrow="Личный кабинет" title="Профиль">
        <p className="text-muted">
          {user.department?.name ? `Отдел: ${user.department.name}` : "Без отдела"}
        </p>
      </PageHeader>
      <ProfileEditor user={user} />
    </div>
  );
}
