export function BorderedContainer({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={`mx-auto max-w-332.5 border-x border-black/10 ${className}`}
    >
      {children}
    </div>
  )
}
