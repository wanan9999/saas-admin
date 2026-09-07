import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

function Page({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("space-y-6", className)}>{children}</div>
}

function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-[1.75rem]">{title}</h1>
        {description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 [&>button]:max-sm:flex-1">{actions}</div>}
    </div>
  )
}

function FilterBar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs sm:flex-row sm:flex-wrap sm:items-end max-sm:[&>button]:w-full max-sm:[&>div]:w-full max-sm:[&>div_input]:w-full",
        className,
      )}
    >
      {children}
    </div>
  )
}

export { FilterBar, Page, PageHeader }
