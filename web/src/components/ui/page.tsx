import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

function Page({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("ui-page space-y-5 sm:space-y-6", className)}>{children}</div>
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
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-[1.75rem]">{title}</h1>
        {description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && (
        <div className="grid shrink-0 grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:flex md:flex-wrap md:items-center [&>*]:min-w-0">
          {actions}
        </div>
      )}
    </div>
  )
}

function FilterBar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "ui-filter-bar flex flex-col gap-3 border-y bg-card/35 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:py-3.5 max-sm:[&>button]:w-full max-sm:[&>div]:w-full max-sm:[&>input]:w-full max-sm:[&>div_input]:w-full sm:[&_.w-40]:w-44 sm:[&_.w-48]:w-52",
        className,
      )}
    >
      {children}
    </div>
  )
}

export { FilterBar, Page, PageHeader }
