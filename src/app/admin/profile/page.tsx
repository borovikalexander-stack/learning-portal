import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function AdminProfilePage() {
  const session = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true
    }
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="stack">
      <PageHeader eyebrow="Управление" title="Мой профиль">
        <p className="text-muted">Имя, аватар, смена пароля</p>
      </PageHeader>
      <ProfileEditor user={user} />
    </div>
  );
}
