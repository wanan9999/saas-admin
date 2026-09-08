import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
import { FilterBar, Page, PageHeader } from "@/components/ui/page"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/i18n"
import { admin } from "@/lib/api"
import { formatDate } from "@/lib/utils"

export default function AuditPage() {
  const { t } = useI18n()
  const [entityFilter, setEntityFilter] = useState("")
  const [entityIdFilter, setEntityIdFilter] = useState("")
  const [productFilter, setProductFilter] = useState("")
  const [page, setPage] = useState(0)
  const limit = 30

  const { data: productsData } = useQuery({
    queryKey: ["admin", "products", ""],
    queryFn: () => admin.listProducts(),
  })
  const products = productsData?.products || []
  // Grouped product list keeps the dropdown scannable as the product
  // count grows — admins can see at a glance which deployment surface
  // (desktop / saas / hybrid) an audit row belongs to.
  const groupedProducts = {
    desktop: products.filter((p) => p.type === "desktop"),
    saas: products.filter((p) => p.type === "saas"),
    hybrid: products.filter((p) => p.type === "hybrid"),
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", entityFilter, entityIdFilter, productFilter, page],
    queryFn: () =>
      admin.listAuditLogs({
        entity: entityFilter || undefined,
        entity_id: entityIdFilter || undefined,
        product_id: productFilter || undefined,
        offset: page * limit,
        limit,
      }),
  })

  const logs = data?.audit_logs || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  const actionColor = (action: string) => {
    if (action === "created") return "bg-emerald-100 text-emerald-800"
    if (action === "deleted" || action === "revoked") return "bg-red-100 text-red-800"
    if (action === "suspended") return "bg-orange-100 text-orange-800"
    return "bg-blue-100 text-blue-800"
  }

  return (
    <Page>
      <PageHeader title={t("audit.title")} description={t("audit.subtitle")} />

      <FilterBar>
        <Select
          value={entityFilter || "all"}
          onValueChange={(v) => {
            setEntityFilter(v === "all" ? "" : v)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("audit.filterEntity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("audit.allEntities")}</SelectItem>
            <SelectItem value="license">{t("audit.license")}</SelectItem>
            <SelectItem value="product">{t("audit.product")}</SelectItem>
            <SelectItem value="plan">{t("audit.plan")}</SelectItem>
            <SelectItem value="user">{t("audit.user")}</SelectItem>
            <SelectItem value="api_key">{t("audit.apiKey")}</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="addon">{t("audit.addon")}</SelectItem>
            <SelectItem value="seat">{t("audit.seat")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder={t("audit.filterEntityId")}
          value={entityIdFilter}
          onChange={(e) => {
            setEntityIdFilter(e.target.value)
            setPage(0)
          }}
          className="w-full sm:w-64"
        />
        <Select
          value={productFilter || "all"}
          onValueChange={(v) => {
            setProductFilter(v === "all" ? "" : v)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder={t("audit.filterProduct")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("audit.allProducts")}</SelectItem>
            {groupedProducts.desktop.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="text-muted-foreground text-xs mr-2">[{t("products.desktop")}]</span>
                {p.name}
              </SelectItem>
            ))}
            {groupedProducts.saas.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="text-muted-foreground text-xs mr-2">[{t("products.saas")}]</span>
                {p.name}
              </SelectItem>
            ))}
            {groupedProducts.hybrid.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="text-muted-foreground text-xs mr-2">[{t("products.hybrid")}]</span>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    <DataTableHead>{t("common.created")}</DataTableHead>
                    <DataTableHead>{t("audit.entity")}</DataTableHead>
                    <DataTableHead>{t("audit.action")}</DataTableHead>
                    <DataTableHead>{t("audit.actor")}</DataTableHead>
                    <DataTableHead>{t("audit.changes")}</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {logs.length === 0 && <DataTableEmpty colSpan={5} message={t("audit.empty")} />}
                  {logs.map((log) => (
                    <DataTableRow key={log.id}>
                      <DataTableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </DataTableCell>
                      <DataTableCell>
                        <span className="font-medium">{log.entity}</span>
                        <span className="text-muted-foreground text-xs ml-1 break-all">
                          #{log.entity_id.substring(0, 8)}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge className={actionColor(log.action)}>{log.action}</Badge>
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground text-xs">
                        {log.actor_type || "-"}
                        {log.ip_address && <span className="ml-1">({log.ip_address})</span>}
                      </DataTableCell>
                      <DataTableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {log.changes && Object.keys(log.changes).length > 0 ? JSON.stringify(log.changes) : "-"}
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
    </Page>
  )
}
