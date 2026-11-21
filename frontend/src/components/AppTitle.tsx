export function AppTitle({ className = '' }: { className?: string }) {
  return (
    <h1 className={`flex items-center gap-2.5 font-display font-bold tracking-[-0.03em] ${className}`}>
      <img src="/icons/app-192.png" width="28" height="28" className="shrink-0 rounded-[26%]" alt="" />
      Shared
    </h1>
  )
}
