export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background" role="status" aria-label="正在加载">
      <div className="relative size-9">
        <div className="absolute inset-0 rounded-full border-[3px] border-primary/15" />
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary" />
      </div>
    </div>
  )
}
