import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Shared empty / no-results state: icon, short title, optional hint and action. */
export function EmptyState({ icon: Icon, title, children, action, compact }: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return <div className={`empty-state${compact ? " compact" : ""}`}>
    <span className="empty-icon"><Icon size={20} aria-hidden /></span>
    <p className="empty-title">{title}</p>
    {children && <p>{children}</p>}
    {action}
  </div>;
}
