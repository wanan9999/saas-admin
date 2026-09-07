import {
  BarChart3,
  Blocks,
  ChevronDown,
  ChevronRight,
  FileKey2,
  Key,
  Layers,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  ScrollText,
  Settings,
  Sun,
  User,
  Users,
  X,
} from "lucide-react"
import { type ComponentType, useEffect, useState } from "react"
import { Link, Navigate, Outlet, useLocation } from "react-router-dom"
import { ErrorBoundary } from "@/components/error-boundary"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useSiteConfig } from "@/hooks/use-site-config"
import { useTheme } from "@/hooks/use-theme"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/utils"

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> }
type NavGroup = { label: string; items: NavItem[] }

function sidebarCollapsed() {
  try {
    return localStorage.getItem("saas-admin-sidebar-collapsed") === "true"
  } catch {
    return false
  }
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      title={dark ? "Use light theme" : "Use dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

export function AdminLayout() {
  const { user, loading, logout } = useAuth()
  const { site_name, logo_url, attribution_text, attribution_url } = useSiteConfig()
  const { t } = useI18n()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(sidebarCollapsed)

  const adminNav: (NavItem | NavGroup)[] = [
    { to: "/admin", label: t("nav.dashboard"), icon: LayoutDashboard },
    {
      label: t("nav.catalog"),
      items: [
        { to: "/admin/products", label: t("nav.products"), icon: Package },
        { to: "/admin/plans", label: t("nav.plans"), icon: Layers },
        { to: "/admin/addons", label: t("nav.addons"), icon: Blocks },
        { to: "/admin/releases", label: t("nav.releases"), icon: Rocket },
      ],
    },
    {
      label: t("nav.licensing"),
      items: [
        { to: "/admin/licenses", label: t("nav.licenses"), icon: Key },
        { to: "/admin/customers", label: t("nav.customers"), icon: Users },
      ],
    },
    {
      label: t("nav.developer"),
      items: [
        { to: "/admin/api-keys", label: t("nav.apiKeys"), icon: FileKey2 },
        { to: "/admin/webhooks", label: t("nav.webhooks"), icon: Link2 },
      ],
    },
    {
      label: t("nav.insights"),
      items: [
        { to: "/admin/analytics", label: t("nav.analytics"), icon: BarChart3 },
        { to: "/admin/audit", label: t("nav.audit"), icon: ScrollText },
      ],
    },
  ]
  const settingsItem: NavItem = { to: "/admin/settings", label: t("nav.settings"), icon: Settings }
  const flatNav = adminNav.flatMap((entry) => ("to" in entry ? [entry] : entry.items)).concat(settingsItem)
  const currentItem = [...flatNav]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.to === "/admin" ? location.pathname === item.to : location.pathname.startsWith(item.to)))

  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
    }
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [mobileOpen])

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/portal" replace />

  const toggleCollapsed = () => {
    const next = !collapsed
    try {
      localStorage.setItem("saas-admin-sidebar-collapsed", String(next))
    } catch {
      // Sidebar remains interactive when storage is unavailable.
    }
    setCollapsed(next)
  }

  const navItem = (item: NavItem) => {
    const active = item.to === "/admin" ? location.pathname === item.to : location.pathname.startsWith(item.to)
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active && "bg-sidebar-accent text-accent-foreground shadow-xs",
          collapsed && "lg:justify-center lg:px-0",
        )}
      >
        <item.icon className="size-4 shrink-0" />
        <span className={cn("truncate", collapsed && "lg:sr-only")}>{item.label}</span>
      </Link>
    )
  }

  const sidebar = (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200",
        "w-64",
        collapsed && "lg:w-[4.5rem]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
      aria-label="Admin navigation"
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-4",
          collapsed && "lg:justify-center lg:px-2",
        )}
      >
        <Link
          to="/admin"
          onClick={() => setMobileOpen(false)}
          className="flex min-w-0 items-center gap-2.5"
          aria-label={site_name}
        >
          <img src={logo_url || "/logo.svg"} alt="" className="size-8 shrink-0 rounded-lg" />
          <div className={cn("min-w-0", collapsed && "lg:hidden")}>
            <div className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">{site_name}</div>
            <div className="text-[11px] font-medium text-muted-foreground">Admin workspace</div>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2.5">
        {adminNav.map((entry, index) => {
          if ("to" in entry) return navItem(entry)
          return (
            <div key={entry.label} className={cn(index > 0 && "pt-3")}>
              <div className={cn("mx-2 mb-2 hidden border-t border-sidebar-border", collapsed && "lg:block")} />
              <div
                className={cn(
                  "px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70",
                  collapsed && "lg:hidden",
                )}
              >
                {entry.label}
              </div>
              <div className="space-y-1">{entry.items.map(navItem)}</div>
            </div>
          )
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-2.5">{navItem(settingsItem)}</div>

      <div className="border-t border-sidebar-border p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn("h-11 w-full justify-start px-2", collapsed && "lg:justify-center")}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-left text-sm", collapsed && "lg:hidden")}>
                {user.name || user.email}
              </span>
              <ChevronDown className={cn("size-4 opacity-50", collapsed && "lg:hidden")} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <div className="px-2 py-1.5 text-xs text-muted-foreground break-all">{user.email}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/portal">
                <User />
                {t("nav.portal")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut />
              {t("nav.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="border-t border-sidebar-border px-3 py-2 text-center">
        <a
          href={attribution_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "block text-[10px] leading-tight text-muted-foreground/70 transition-colors hover:text-foreground",
            collapsed && "lg:text-[8px]",
          )}
        >
          {attribution_text}
        </a>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-background">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px] lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {sidebar}
      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{t("nav.dashboard")}</span>
            {currentItem?.to !== "/admin" && (
              <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" />
            )}
            <span className="truncate font-medium">{currentItem?.label || site_name}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/portal">{t("nav.portal")}</Link>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

export function PortalLayout() {
  const { user, loading, logout } = useAuth()
  const { site_name, logo_url, attribution_text, attribution_url } = useSiteConfig()
  const { t } = useI18n()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  const portalNav = [
    { to: "/portal", label: t("nav.licenses"), icon: Key },
    { to: "/portal/account", label: t("nav.settings"), icon: User },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/portal" className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight">
            <img src={logo_url || "/logo.svg"} alt="" className="size-8 rounded-lg" />
            <span className="truncate">{site_name}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {user.is_admin && (
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/admin">Admin</Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="max-w-48">
                  <User />
                  <span className="truncate">{user.name || user.email}</span>
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="break-all px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
                {user.is_admin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <Settings />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Portal navigation">
          {portalNav.map((item) => {
            const active = item.to === "/portal" ? location.pathname === item.to : location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t py-4 text-center">
        <a
          href={attribution_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {attribution_text}
        </a>
      </footer>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
      <div className="size-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
    </div>
  )
}
