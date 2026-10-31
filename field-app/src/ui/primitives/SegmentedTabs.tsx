export type SegmentedTabItem = { key: string; label: string };

export function SegmentedTabs({
  items,
  value,
  onChange,
}: {
  items: SegmentedTabItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-1">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`flex-1 shrink-0 px-3 rounded-xl text-xs font-bold whitespace-nowrap ${
              active ? "bg-amber-600 text-white" : "text-zinc-400 active:bg-zinc-800"
            }`}
            style={{ minHeight: "40px" }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
