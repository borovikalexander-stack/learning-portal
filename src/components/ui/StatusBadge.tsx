type StatusBadgeProps = {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "PENDING" | "ACTIVE" | "BLOCKED";
};

const statusConfig: Record<StatusBadgeProps["status"], { className: string; label: string }> = {
  DRAFT: { className: "badge", label: "Черновик" },
  PUBLISHED: { className: "badge badge-accent", label: "Опубликован" },
  ARCHIVED: { className: "badge badge-warning", label: "Архив" },
  PENDING: { className: "badge badge-warning", label: "Ожидает" },
  ACTIVE: { className: "badge badge-accent", label: "Активен" },
  BLOCKED: { className: "badge badge-danger", label: "Заблокирован" }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return <span className={config.className}>{config.label}</span>;
}
