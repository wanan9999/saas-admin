import * as React from "react"
import { cn } from "@/lib/utils"

type CardVariant = "default" | "metric" | "workspace" | "elevated"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

const cardVariants: Record<CardVariant, string> = {
  default: "rounded-2xl border bg-card/70 shadow-none",
  metric:
    "rounded-2xl border bg-card shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-slate-950/5",
  workspace: "rounded-none border-0 bg-transparent shadow-none",
  elevated: "rounded-2xl border bg-card shadow-2xl shadow-slate-950/8",
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    data-variant={variant}
    className={cn("ui-card text-card-foreground", cardVariants[variant], className)}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("ui-card-header flex flex-col space-y-1.5 p-4 sm:p-5", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("font-semibold leading-none tracking-[-0.01em]", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("ui-card-content p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />
  ),
)
CardContent.displayName = "CardContent"

export { Card, CardContent, CardDescription, CardHeader, CardTitle }
