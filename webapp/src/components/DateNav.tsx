interface DateNavProps {
  dates: string[];
  onSelect: (date: string) => void;
}

export const DateNav = ({ dates, onSelect }: DateNavProps) => {
  if (dates.length === 0) return null;
  return (
    <div className="w-full flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none snap-x">
      {dates.map((date) => (
        <button
          key={date}
          onClick={() => onSelect(date)}
          className="shrink-0 snap-center px-4 py-1.5 bg-surface hover:bg-surface-2 border border-white/8 rounded-full text-[11px] font-bold tracking-wide text-muted hover:text-content transition-colors"
        >
          {date}
        </button>
      ))}
    </div>
  );
};
