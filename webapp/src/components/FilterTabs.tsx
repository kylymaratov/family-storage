export type MediaFilter = "all" | "photo" | "video";

const TABS: { value: MediaFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
];

interface FilterTabsProps {
  value: MediaFilter;
  onChange: (value: MediaFilter) => void;
}

export const FilterTabs = ({ value, onChange }: FilterTabsProps) => (
  <div className="px-4">
    <div className="bg-surface p-0.5 rounded-[var(--radius-control)] flex border border-white/8">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`flex-1 py-1.5 rounded-[7px] text-xs font-bold ${
            value === tab.value
              ? "bg-surface-3 text-content border border-white/10"
              : "text-faint"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);
