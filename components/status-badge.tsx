export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/_/g, "-").replace(/\s/g, "-");
  const label = status.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return <span className={`status ${normalized}`}>{label}</span>;
}
