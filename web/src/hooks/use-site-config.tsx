import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { site } from "@/lib/api"

interface SiteConfig {
  site_name: string
  brand_color: string
  logo_url: string
  timezone: string
  language: string
  attribution_text: string
  attribution_url: string
  loading: boolean
}

const defaults: SiteConfig = {
  site_name: "saas-admin",
  brand_color: "",
  logo_url: "",
  timezone: "UTC",
  language: "",
  attribution_text: "Powered by Keygate",
  attribution_url: "https://keygate.app",
  loading: true,
}

const SiteConfigContext = createContext<SiteConfig>(defaults)

const THEME_PROPERTIES = [
  "--primary",
  "--primary-foreground",
  "--ring",
  "--accent",
  "--accent-foreground",
  "--sidebar-accent",
] as const

export function applyBrandColor(color: string) {
  const root = document.documentElement
  if (!color) {
    for (const property of THEME_PROPERTIES) root.style.removeProperty(property)
    return
  }
  root.style.setProperty("--primary", color)
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color)
  if (hex) {
    const [r, g, b] = hex.slice(1).map((value) => Number.parseInt(value, 16) / 255)
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    root.style.setProperty("--primary-foreground", luminance > 0.62 ? "#111827" : "#ffffff")
  } else {
    root.style.removeProperty("--primary-foreground")
  }
  root.style.setProperty("--ring", color)
  root.style.setProperty("--accent", `color-mix(in oklab, ${color} 12%, var(--background))`)
  root.style.setProperty("--accent-foreground", color)
  root.style.setProperty("--sidebar-accent", `color-mix(in oklab, ${color} 12%, var(--sidebar))`)
}

export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(defaults)

  useEffect(() => {
    site
      .config()
      .then((data) => {
        setConfig({
          site_name: data.site_name || "saas-admin",
          brand_color: data.brand_color || "",
          logo_url: data.logo_url || "",
          timezone: data.timezone || "UTC",
          language: data.language || "",
          attribution_text: data.attribution_text || "Powered by Keygate",
          attribution_url: data.attribution_url || "https://keygate.app",
          loading: false,
        })
        // Dynamic favicon from custom logo. index.html declares
        // multiple <link rel="icon"> variants and browsers pick their
        // favorite (often the sizes="32x32" one), so rewriting only
        // the first link never visibly changed the tab icon — update
        // them all.
        if (data.logo_url) {
          document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']").forEach((link) => {
            link.href = data.logo_url
          })
        }
        applyBrandColor(data.brand_color || "")
        if (data.site_name) {
          document.title = data.site_name
        }
        // Set default language if user hasn't explicitly chosen one
        if (data.language && !localStorage.getItem("saas-admin_locale")) {
          localStorage.setItem("saas-admin_locale", data.language)
          document.documentElement.lang = data.language
        }
      })
      .catch(() => setConfig({ ...defaults, loading: false }))
  }, [])

  return <SiteConfigContext.Provider value={config}>{children}</SiteConfigContext.Provider>
}

export function useSiteConfig() {
  return useContext(SiteConfigContext)
}
