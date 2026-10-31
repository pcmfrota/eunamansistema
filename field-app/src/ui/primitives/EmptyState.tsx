import type { ComponentType, ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ size?: number }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-zinc-800 rounded-2xl">
      {Icon && (
        <div className="mb-3 p-3 rounded-2xl bg-zinc-800 text-zinc-500">
          <Icon size={24} />
        </div>
      )}
      <p className="text-sm font-bold text-zinc-300">{title}</p>
      {description && <p className="text-xs text-zinc-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
