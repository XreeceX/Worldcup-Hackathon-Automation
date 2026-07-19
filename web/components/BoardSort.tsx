'use client';

export type SortKey = 'total_lamports' | 'member_count' | 'created_at';

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'total_lamports', label: 'Most pledged' },
  { key: 'member_count', label: 'Most members' },
  { key: 'created_at', label: 'Newest' },
];

export function BoardSort({
  sort,
  onChange,
}: {
  sort: SortKey;
  onChange: (s: SortKey) => void;
}) {
  return (
    <select
      aria-label="Sort commitments"
      className="input w-auto"
      value={sort}
      onChange={(e) => onChange(e.target.value as SortKey)}
    >
      {OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>
          Sort: {o.label}
        </option>
      ))}
    </select>
  );
}
