export function SectionLabel({
  number,
  label,
}: {
  number: string
  label: string
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-sm text-black/40 font-mono">[{number}]</span>
      <span className="text-sm text-black/40 uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}
