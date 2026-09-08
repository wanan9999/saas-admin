import { useQuery } from "@tanstack/react-query"
import { Eye, Search } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmpty,
  DataTableHead,
  DataTableHeader,
  DataTablePagination,
  DataTableRow,
} from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { FilterBar, Page, PageHeader } from "@/components/ui/page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/i18n"
import type { UserDetail } from "@/lib/api"
import { admin } from "@/lib/api"
import { formatDate, statusColor } from "@/lib/utils"

export default function CustomersPage() {
  const { t } = useI18n()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const limit = 30
  const [viewingUser, setViewingUser] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", search, page],
    queryFn: () => admin.listUsers({ search: search || undefined, offset: page * limit, limit }),
  })

  const customers = data?.users || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <Page>
      <PageHeader title={t("customers.title")} description={t("customers.subtitle", { count: total })} />

      <FilterBar>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="pl-9"
          />
        </div>
      </FilterBar>

      <Card variant="workspace">
        <CardContent>
          {isLoading ? (
            <div className="h-64 animate-pulse bg-muted rounded-lg" />
          ) : (
            <>
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>{t("customers.customer")}</DataTableHead>
                    <DataTableHead>{t("common.email")}</DataTableHead>
                    <DataTableHead>{t("customers.joined")}</DataTableHead>
                    <DataTableHead>{t("customers.lastUpdated")}</DataTableHead>
                    <DataTableHead className="w-16">{t("common.actions")}</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {customers.length === 0 && <DataTableEmpty colSpan={5} message={t("customers.empty")} />}
                  {customers.map((u) => (
                    <DataTableRow key={u.id}>
                      <DataTableCell>
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} className="h-8 w-8 rounded-full" alt="" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                              {u.name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium">{u.name || "-"}</span>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground">{u.email}</DataTableCell>
                      <DataTableCell className="text-muted-foreground text-xs">
                        {formatDate(u.created_at)}
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground text-xs">
                        {formatDate(u.updated_at)}
                      </DataTableCell>
                      <DataTableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingUser(u.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
              {total > 0 && (
                <DataTablePagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  pageSize={limit}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CustomerDetailDialog
        userId={viewingUser}
        open={!!viewingUser}
        onOpenChange={(open) => {
          if (!open) setViewingUser(null)
        }}
      />
    </Page>
  )
}

function CustomerDetailDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-detail", userId],
    queryFn: () => admin.getUserDetail(userId!),
    enabled: !!userId,
  })

  const detail: UserDetail | undefined = data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("customers.detail")}</DialogTitle>
          <DialogDescription>{detail?.user?.email || t("common.loading")}</DialogDescription>
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="space-y-4">
            <div className="h-24 bg-muted rounded-lg animate-pulse" />
            <div className="h-48 bg-muted rounded-lg animate-pulse" />
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">{t("customers.overview")}</TabsTrigger>
              <TabsTrigger value="licenses">{t("customers.licenses")}</TabsTrigger>
              <TabsTrigger value="subscriptions">{t("customers.subscriptions")}</TabsTrigger>
              <TabsTrigger value="activity">{t("customers.activity")}</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="space-y-4">
                {/* User info */}
                <div className="flex flex-col gap-4 border-b pb-4 min-[420px]:flex-row min-[420px]:items-center">
                  {detail.user.avatar_url ? (
                    <img src={detail.user.avatar_url} className="h-14 w-14 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold">
                      {detail.user.name?.charAt(0)?.toUpperCase() || detail.user.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{detail.user.name || "-"}</h3>
                    <p className="break-all text-sm text-muted-foreground">{detail.user.email}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {t("customers.joined")} {formatDate(detail.user.created_at)}
                      </span>
                      <span>
                        {t("customers.lastUpdated")} {formatDate(detail.user.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { label: t("analytics.totalLicenses"), value: detail.licenses?.length ?? 0 },
                    {
                      label: t("analytics.active"),
                      value: detail.licenses?.filter((l) => l.status === "active").length ?? 0,
                    },
                    { label: t("customers.totalUsage"), value: detail.total_usage ?? 0 },
                    { label: t("customers.activeSeats"), value: detail.active_seats ?? 0 },
                    { label: t("analytics.activations"), value: detail.activations ?? 0 },
                  ].map((s) => (
                    <Card key={s.label} variant="metric">
                      <CardContent className="pt-4 pb-3 text-center">
                        <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Licenses Tab */}
            <TabsContent value="licenses">
              {(detail.licenses || []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No licenses found.</p>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>{t("common.product")}</DataTableHead>
                      <DataTableHead>{t("common.plan")}</DataTableHead>
                      <DataTableHead>{t("common.status")}</DataTableHead>
                      <DataTableHead>{t("licenses.licenseKey")}</DataTableHead>
                      <DataTableHead>{t("licenses.validUntil")}</DataTableHead>
                      <DataTableHead>{t("common.created")}</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {detail.licenses.map((l) => (
                      <DataTableRow key={l.id}>
                        <DataTableCell className="font-medium">{l.product?.name || l.product_id}</DataTableCell>
                        <DataTableCell>{l.plan?.name || l.plan_id}</DataTableCell>
                        <DataTableCell>
                          <Badge className={statusColor(l.status)}>{t(`status.${l.status}` as any)}</Badge>
                        </DataTableCell>
                        <DataTableCell>
                          {/* Only the tail — the key itself is revealed
                              one at a time from the licenses page, and
                              each reveal is audited. */}
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {data?.license_key_hints?.[l.id] ? `KG-••••-${data.license_key_hints[l.id]}` : "••••"}
                          </code>
                        </DataTableCell>
                        <DataTableCell className="text-xs text-muted-foreground">
                          {l.valid_until ? formatDate(l.valid_until) : "-"}
                        </DataTableCell>
                        <DataTableCell className="text-xs text-muted-foreground">
                          {formatDate(l.created_at)}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </TabsContent>

            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions">
              {(detail.subscriptions || []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No subscriptions found.</p>
              ) : (
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>{t("common.plan")}</DataTableHead>
                      <DataTableHead>{t("common.status")}</DataTableHead>
                      <DataTableHead>{t("customers.provider")}</DataTableHead>
                      <DataTableHead>{t("customers.periodRange")}</DataTableHead>
                      <DataTableHead>{t("customers.cancelAtEnd")}</DataTableHead>
                      <DataTableHead>{t("common.created")}</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {detail.subscriptions.map((sub) => (
                      <DataTableRow key={sub.id}>
                        <DataTableCell className="font-medium">{sub.plan?.name || sub.plan_id}</DataTableCell>
                        <DataTableCell>
                          <Badge className={statusColor(sub.status)}>{t(`status.${sub.status}` as any)}</Badge>
                        </DataTableCell>
                        <DataTableCell className="text-muted-foreground">{sub.payment_provider || "-"}</DataTableCell>
                        <DataTableCell className="text-xs text-muted-foreground">
                          <div>
                            {sub.current_period_start ? formatDate(sub.current_period_start) : "-"}
                            {" - "}
                            {sub.current_period_end ? formatDate(sub.current_period_end) : "-"}
                          </div>
                          {sub.trial_start && (
                            <div className="text-violet-600 mt-0.5">
                              Trial: {formatDate(sub.trial_start)} - {formatDate(sub.trial_end)}
                            </div>
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          {sub.cancel_at_period_end ? (
                            <Badge variant="destructive">{t("common.yes")}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">{t("common.no")}</span>
                          )}
                        </DataTableCell>
                        <DataTableCell className="text-xs text-muted-foreground">
                          {formatDate(sub.created_at)}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
              {(detail.recent_audit_logs || []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No recent activity.</p>
              ) : (
                <div className="space-y-2">
                  {detail.recent_audit_logs.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center gap-2 border-b py-2 text-sm last:border-0 sm:flex-nowrap sm:gap-3"
                    >
                      <span className="w-full text-xs text-muted-foreground sm:w-36 sm:shrink-0">
                        {formatDate(a.created_at)}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {a.entity}
                      </Badge>
                      <Badge
                        className={
                          a.action.includes("create")
                            ? "bg-emerald-100 text-emerald-800"
                            : a.action.includes("delete") || a.action.includes("revoke")
                              ? "bg-red-100 text-red-800"
                              : a.action.includes("update")
                                ? "bg-blue-100 text-blue-800"
                                : a.action.includes("suspend")
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-gray-100 text-gray-800"
                        }
                      >
                        {a.action}
                      </Badge>
                      <span
                        className="font-mono text-xs text-muted-foreground truncate max-w-[180px]"
                        title={a.entity_id}
                      >
                        {a.entity_id.length > 12 ? `${a.entity_id.slice(0, 12)}...` : a.entity_id}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
