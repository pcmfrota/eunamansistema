import type { CSSProperties, ReactNode } from "react";

type Edge = "top" | "right" | "bottom" | "left";

const VAR_BY_EDGE: Record<Edge, string> = {
  top: "var(--safe-top)",
  right: "var(--safe-right)",
  bottom: "var(--safe-bottom)",
  left: "var(--safe-left)",
};

export function SafeArea({
  edges,
  children,
  className = "",
}: {
  edges: Edge[];
  children: ReactNode;
  className?: string;
}) {
  const style: CSSProperties = {};
  for (const edge of edges) {
    if (edge === "top") style.paddingTop = VAR_BY_EDGE.top;
    if (edge === "right") style.paddingRight = VAR_BY_EDGE.right;
    if (edge === "bottom") style.paddingBottom = VAR_BY_EDGE.bottom;
    if (edge === "left") style.paddingLeft = VAR_BY_EDGE.left;
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
