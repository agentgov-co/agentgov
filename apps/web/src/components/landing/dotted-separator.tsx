export function DottedSeparator(): React.JSX.Element {
  return (
    <div className="border-b border-black/10">
      <div
        className="h-12 sm:h-24 w-full"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
        }}
      />
    </div>
  )
}
