import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { ErrorBoundary } from "@/components/error-boundary"
import { AdminLayout, PortalLayout } from "@/components/layout"
import { showToast, ToastBridge, ToastProvider } from "@/components/toast"
import { AuthProvider } from "@/hooks/use-auth"
import { SiteConfigProvider } from "@/hooks/use-site-config"
import { ThemeProvider } from "@/hooks/use-theme"
import { I18nProvider } from "@/i18n"
import "./index.css"

const AcceptInvitePage = lazy(() => import("@/pages/accept-invite"))
const AddonsPage = lazy(() => import("@/pages/admin/addons"))
const AnalyticsPage = lazy(() => import("@/pages/admin/analytics"))
const APIKeysPage = lazy(() => import("@/pages/admin/api-keys"))
const AuditPage = lazy(() => import("@/pages/admin/audit"))
const CustomersPage = lazy(() => import("@/pages/admin/customers"))
const DashboardPage = lazy(() => import("@/pages/admin/dashboard"))
const LicensesPage = lazy(() => import("@/pages/admin/licenses"))
const PlansPage = lazy(() => import("@/pages/admin/plans"))
const ProductsPage = lazy(() => import("@/pages/admin/products"))
const ReleasesPage = lazy(() => import("@/pages/admin/releases"))
const SettingsPage = lazy(() => import("@/pages/admin/settings"))
const WebhooksPage = lazy(() => import("@/pages/admin/webhooks"))
const CheckoutSuccessPage = lazy(() => import("@/pages/checkout-success"))
const LoginPage = lazy(() => import("@/pages/login"))
const PortalAccountPage = lazy(() => import("@/pages/portal/account"))
const PortalLicensesPage = lazy(() => import("@/pages/portal/licenses"))

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "An error occurred")
    },
  }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <ToastProvider>
            <ToastBridge />
            <I18nProvider>
              <SiteConfigProvider>
                <AuthProvider>
                  <ErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
                        <Route path="/accept-invite" element={<AcceptInvitePage />} />

                        {/* Admin */}
                        <Route path="/admin" element={<AdminLayout />}>
                          <Route index element={<DashboardPage />} />
                          <Route path="products" element={<ProductsPage />} />
                          <Route path="plans" element={<PlansPage />} />
                          <Route path="releases" element={<ReleasesPage />} />
                          <Route path="licenses" element={<LicensesPage />} />
                          <Route path="api-keys" element={<APIKeysPage />} />
                          <Route path="webhooks" element={<WebhooksPage />} />
                          <Route path="addons" element={<AddonsPage />} />
                          <Route path="analytics" element={<AnalyticsPage />} />
                          <Route path="audit" element={<AuditPage />} />
                          <Route path="customers" element={<CustomersPage />} />
                          <Route path="settings" element={<SettingsPage />} />
                        </Route>

                        {/* Portal */}
                        <Route path="/portal" element={<PortalLayout />}>
                          <Route index element={<PortalLicensesPage />} />
                          <Route path="account" element={<PortalAccountPage />} />
                        </Route>

                        <Route path="*" element={<Navigate to="/login" replace />} />
                      </Routes>
                    </Suspense>
                  </ErrorBoundary>
                </AuthProvider>
              </SiteConfigProvider>
            </I18nProvider>
          </ToastProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)

function RouteFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading page">
      <div className="size-7 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
    </div>
  )
}
