type AvatarUser = {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
};

type AvatarProps = {
  user: AvatarUser;
  size?: number;
  className?: string;
  title?: string;
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export function Avatar({ user, size = 36, className, title }: AvatarProps) {
  const initials = getInitials(user.firstName, user.lastName);
  const baseStyle = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.35)) };
  const tooltip = title ?? `${user.firstName} ${user.lastName}`;

  if (user.avatarUrl) {
    return (
      <span
        aria-label={tooltip}
        className={`avatar avatar-image ${className ?? ""}`}
        style={{
          ...baseStyle,
          backgroundImage: `url("${user.avatarUrl}")`
        }}
        title={tooltip}
      />
    );
  }

  return (
    <span aria-label={tooltip} className={`avatar avatar-initials ${className ?? ""}`} style={baseStyle} title={tooltip}>
      {initials}
    </span>
  );
}
