import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Download,
  KeyRound,
  Package,
  Plus,
  Rocket,
  RotateCw,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { showToast } from "@/components/toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FilterBar, Page, PageHeader } from "@/components/ui/page"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  admin,
  RELEASE_CHANNELS,
  RELEASE_PLATFORMS,
  type Release,
  type ReleaseArtifact,
  type ReleaseSigningKey,
} from "@/lib/api"
import { formatDate } from "@/lib/utils"

const PAGE_SIZE = 20
const CHANNEL_LABELS: Record<string, string> = { stable: "稳定版", beta: "测试版", alpha: "预览版", dev: "开发版" }
const STATUS_LABELS: Record<string, string> = { draft: "草稿", published: "已发布", yanked: "已撤回" }

export default function ReleasesPage() {
  const qc = useQueryClient()
  const [productFilter, setProductFilter] = useState("")
  const [channelFilter, setChannelFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const [yanking, setYanking] = useState<Release | null>(null)
  const [unyanking, setUnyanking] = useState<Release | null>(null)
  const [deleting, setDeleting] = useState<Release | null>(null)
  const [showSigningKeys, setShowSigningKeys] = useState(false)
  const [openRelease, setOpenRelease] = useState<Release | null>(null)
  const [confirmPublish, setConfirmPublish] = useState<{ rel: Release; latest: string } | null>(null)

  const { data: productsData } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => admin.listProducts(),
  })
  // Only desktop + hybrid products can own releases. SaaS products
  // are filtered out everywhere release-ish: list filter, create
  // dialog, signing-key dialog. Mirrors the backend capability gate.
  const products = (productsData?.products || []).filter((p) => p.type !== "saas")

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "releases", productFilter, channelFilter, statusFilter, page],
    queryFn: () =>
      admin.listReleases({
        product_id: productFilter || undefined,
        channel: channelFilter || undefined,
        status: statusFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  })
  const releases = data?.releases || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const latestByBucket = computeLatestVersions(releases)

  const publishMut = useMutation({
    mutationFn: admin.publishRelease,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "releases"] })
      showToast("版本已发布", "success")
    },
    onError: (e: Error) => showToast(e.message, "error"),
  })
  const unyankMut = useMutation({
    mutationFn: admin.unyankRelease,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "releases"] })
      showToast("版本已恢复发布", "success")
      setUnyanking(null)
    },
    onError: (e: Error) => showToast(e.message, "error"),
  })
  const deleteMut = useMutation({
    mutationFn: admin.deleteRelease,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "releases"] })
      setDeleting(null)
      showToast("草稿已删除", "success")
    },
    onError: (e: Error) => showToast(e.message, "error"),
  })

  // No release-eligible products. Either no products at all, or the
  // admin has only saas products (which don't ship installable binaries).
  if (products.length === 0 && !isLoading) {
    const hasAnyProducts = (productsData?.products || []).length > 0
    return (
      <Page>
        <PageHeader title="发布管理" description="通过 Sparkle、Velopack 或 Tauri 向客户分发软件更新。" />
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            {hasAnyProducts ? (
              <>
                <p className="text-lg font-medium">没有可发布版本的产品</p>
                <p className="text-muted-foreground mt-1 mb-4">
                  版本更新仅支持桌面端和混合型产品。请修改现有产品类型，或创建新的桌面端/混合型产品。
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">暂无产品</p>
                <p className="text-muted-foreground mt-1 mb-4">请先创建产品，再发布软件版本。</p>
              </>
            )}
            <Button asChild>
              <Link to="/admin/products">
                <Plus className="h-4 w-4 mr-2" /> {hasAnyProducts ? "管理产品" : "创建产品"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        title="发布管理"
        description="通过 Sparkle、Velopack 或 Tauri 向客户分发软件更新。"
        actions={
          <>
            <Button variant="outline" onClick={() => setShowSigningKeys(true)}>
              <KeyRound /> 签名密钥
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus /> 新建版本
            </Button>
          </>
        }
      />

      <FilterBar>
        <Select value={productFilter || "all"} onValueChange={(v) => setProductFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="全部产品" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部产品</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channelFilter || "all"} onValueChange={(v) => setChannelFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="全部渠道" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部渠道</SelectItem>
            {RELEASE_CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                {CHANNEL_LABELS[c] || c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="published">已发布</SelectItem>
            <SelectItem value="yanked">已撤回</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable>
        <DataTableHeader>
          <DataTableRow>
            <DataTableHead>产品</DataTableHead>
            <DataTableHead>版本</DataTableHead>
            <DataTableHead>渠道</DataTableHead>
            <DataTableHead>平台</DataTableHead>
            <DataTableHead>状态</DataTableHead>
            <DataTableHead>创建时间</DataTableHead>
            <DataTableHead className="text-right">操作</DataTableHead>
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody>
          {isLoading ? (
            <DataTableEmpty colSpan={7} message="加载中..." />
          ) : releases.length === 0 ? (
            <DataTableEmpty colSpan={7} message="暂无发布版本，点击“新建版本”开始。" />
          ) : (
            releases.map((rel) => {
              const bucketKey = `${rel.product_id}|${rel.channel}`
              const latestInBucket = latestByBucket.get(bucketKey)
              const isBelowLatest =
                latestInBucket !== undefined &&
                rel.version !== latestInBucket &&
                compareSemver(rel.version, latestInBucket) < 0
              const artifacts = rel.artifacts || []
              const allReady = artifacts.length > 0 && artifacts.every((a) => a.sha256 && a.file_key)

              return (
                <DataTableRow key={rel.id}>
                  <DataTableCell>{rel.product?.name || rel.product_id}</DataTableCell>
                  <DataTableCell className="font-mono text-sm">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => setOpenRelease(rel)}
                      title="打开版本详情"
                    >
                      {rel.version}
                    </button>
                    {isBelowLatest && (
                      <Badge
                        variant="outline"
                        className="ml-1.5 text-[10px] py-0 px-1.5 border-amber-500 text-amber-700"
                        title={`低于当前最新版本（${latestInBucket}）`}
                      >
                        低于最新版
                      </Badge>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant="outline" className="capitalize">
                      {CHANNEL_LABELS[rel.channel] || rel.channel}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell className="text-sm">
                    {artifacts.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="font-mono text-xs">{artifacts.length} 个平台</span>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge status={rel.status} yankedReason={rel.yanked_reason} />
                  </DataTableCell>
                  <DataTableCell className="text-sm text-muted-foreground">{formatDate(rel.created_at)}</DataTableCell>
                  <DataTableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          操作
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setOpenRelease(rel)}>
                          <ChevronRight className="h-3.5 w-3.5 mr-2" /> 查看或管理安装包
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {rel.status === "draft" && allReady && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (isBelowLatest && latestInBucket) {
                                setConfirmPublish({ rel, latest: latestInBucket })
                              } else {
                                publishMut.mutate(rel.id)
                              }
                            }}
                          >
                            <Rocket className="h-3.5 w-3.5 mr-2" /> 发布
                          </DropdownMenuItem>
                        )}
                        {rel.status === "draft" && !allReady && (
                          <DropdownMenuItem disabled>
                            等待安装包（{artifacts.filter((a) => a.sha256).length}/{artifacts.length} 已就绪）
                          </DropdownMenuItem>
                        )}
                        {rel.status === "published" && (
                          <DropdownMenuItem onClick={() => setYanking(rel)} className="text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 mr-2" /> 撤回
                          </DropdownMenuItem>
                        )}
                        {rel.status === "yanked" && (
                          <DropdownMenuItem onClick={() => setUnyanking(rel)}>恢复发布</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {rel.status === "draft" ? (
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(rel)}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> 删除草稿
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem disabled>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> 不可删除（请改为撤回）
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </DataTableCell>
                </DataTableRow>
              )
            })
          )}
        </DataTableBody>
      </DataTable>

      <DataTablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {creating && (
        <CreateReleaseDialog
          products={products}
          onClose={() => setCreating(false)}
          onCreated={(r) => {
            setCreating(false)
            setOpenRelease(r)
          }}
        />
      )}
      {openRelease && <ReleaseDetailDialog release={openRelease} onClose={() => setOpenRelease(null)} />}
      {yanking && <YankDialog release={yanking} onClose={() => setYanking(null)} />}
      {unyanking && (
        <AlertDialog open onOpenChange={() => setUnyanking(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>恢复发布 v{unyanking.version}？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作会将该版本恢复到公开更新源，对应渠道的客户端将再次收到 v{unyanking.version} 更新。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={() => unyanking && unyankMut.mutate(unyanking.id)}>
                恢复发布
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {showSigningKeys && <SigningKeysDialog products={products} onClose={() => setShowSigningKeys(false)} />}
      {deleting && (
        <AlertDialog open onOpenChange={() => setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除草稿版本？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作会永久删除草稿及其已上传的安装包。已发布或已撤回的版本不能删除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMut.mutate(deleting.id)} disabled={deleteMut.isPending}>
                删除
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {confirmPublish && (
        <AlertDialog open onOpenChange={() => setConfirmPublish(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>发布低于当前最新版的版本？</AlertDialogTitle>
              <AlertDialogDescription>
                即将发布的 <strong>{confirmPublish.rel.version}</strong> 低于当前版本{" "}
                <strong>{confirmPublish.latest}</strong>。Velopack 和 Tauri
                默认拒绝降级；该版本会以非顺序方式出现在历史记录中，适合回移修复场景。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  publishMut.mutate(confirmPublish.rel.id)
                  setConfirmPublish(null)
                }}
              >
                仍然发布
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Page>
  )
}

function StatusBadge({ status, yankedReason }: { status: string; yankedReason?: string }) {
  const cls =
    status === "published"
      ? "bg-emerald-100 text-emerald-800"
      : status === "yanked"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800"
  return (
    <Badge className={cls} title={yankedReason}>
      {status === "yanked" && <AlertTriangle className="h-3 w-3 mr-1" />}
      {STATUS_LABELS[status] || status}
    </Badge>
  )
}

// ─── Create Release Dialog (release metadata only; no artifacts yet) ──────

function CreateReleaseDialog({
  products,
  onClose,
  onCreated,
}: {
  products: { id: string; name: string }[]
  onClose: () => void
  onCreated: (rel: Release) => void
}) {
  const qc = useQueryClient()
  const [productId, setProductId] = useState(products[0]?.id || "")
  const [version, setVersion] = useState("")
  const [channel, setChannel] = useState<(typeof RELEASE_CHANNELS)[number]>("stable")
  const [name, setName] = useState("")
  const [releaseNotes, setReleaseNotes] = useState("")
  const [error, setError] = useState("")

  const mut = useMutation({
    mutationFn: () =>
      admin.createRelease({
        product_id: productId,
        version,
        channel,
        name,
        release_notes: releaseNotes,
      }),
    onSuccess: (rel) => {
      qc.invalidateQueries({ queryKey: ["admin", "releases"] })
      showToast(`草稿 ${rel.version} 已创建，请添加安装包后发布。`, "success")
      onCreated(rel)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新建版本</DialogTitle>
          <DialogDescription>先创建版本记录，下一步再添加各平台对应的安装包。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>产品</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>版本号</Label>
              <Input placeholder="1.2.3" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>发布渠道</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELEASE_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHANNEL_LABELS[c] || c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>显示名称（可选）</Label>
            <Input placeholder="示例产品专业版" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>更新说明（可选，支持 Markdown）</Label>
            <Textarea
              rows={4}
              placeholder="请输入此版本的更新内容..."
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!productId || !version || mut.isPending}>
            {mut.isPending ? "创建中..." : "创建草稿"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Release Detail Dialog (manage artifacts) ─────────────────────────────

function ReleaseDetailDialog({ release, onClose }: { release: Release; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: latest } = useQuery({
    queryKey: ["admin", "release", release.id],
    queryFn: () => admin.getRelease(release.id),
    initialData: release,
    refetchInterval: false,
  })
  const rel = latest || release
  const [adding, setAdding] = useState(false)

  const deleteArtifactMut = useMutation({
    mutationFn: (artifactId: string) => admin.deleteArtifact(rel.id, artifactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "release", rel.id] })
      qc.invalidateQueries({ queryKey: ["admin", "releases"] })
    },
    onError: (e: Error) => showToast(e.message, "error"),
  })

  const artifacts = rel.artifacts || []
  const usedPlatforms = new Set(artifacts.map((a) => a.platform))
  const remainingPlatforms = RELEASE_PLATFORMS.filter((p) => !usedPlatforms.has(p))

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rel.product?.name || rel.product_id} {rel.version}
            <Badge variant="outline" className="ml-2 capitalize text-xs">
              {CHANNEL_LABELS[rel.channel] || rel.channel}
            </Badge>
            <StatusBadge status={rel.status} />
          </DialogTitle>
          <DialogDescription>
            {rel.status === "draft" ? (
              <>请添加各平台安装包，全部准备完成后即可发布。</>
            ) : (
              <>该版本状态为“{STATUS_LABELS[rel.status] || rel.status}”，安装包不可修改。</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium mb-2">安装包（{artifacts.length}）</p>
            {artifacts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center bg-muted/50 rounded">
                暂无安装包，发布前至少需要添加一个平台。
              </p>
            ) : (
              <div className="space-y-2">
                {artifacts.map((a) => (
                  <ArtifactRow
                    key={a.id}
                    artifact={a}
                    canEdit={rel.status === "draft"}
                    onDelete={() => deleteArtifactMut.mutate(a.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {rel.status === "draft" && remainingPlatforms.length > 0 && (
            <Button onClick={() => setAdding(true)} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" /> 添加安装包（剩余 {remainingPlatforms.length} 个平台）
            </Button>
          )}
        </div>

        {adding && (
          <AddArtifactDialog
            release={rel}
            availablePlatforms={remainingPlatforms}
            onClose={() => setAdding(false)}
            onAdded={() => {
              setAdding(false)
              qc.invalidateQueries({ queryKey: ["admin", "release", rel.id] })
              qc.invalidateQueries({ queryKey: ["admin", "releases"] })
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ArtifactRow({
  artifact,
  canEdit,
  onDelete,
}: {
  artifact: ReleaseArtifact
  canEdit: boolean
  onDelete: () => void
}) {
  const ready = !!artifact.sha256
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm sm:flex-nowrap sm:gap-3">
      <Badge variant="outline" className="font-mono text-[10px]">
        {artifact.platform}
      </Badge>
      <span className="min-w-28 flex-1 truncate text-xs text-muted-foreground">
        {ready ? `${formatBytes(artifact.file_size)} · sha256:${artifact.sha256.slice(0, 12)}…` : "尚未上传"}
      </span>
      {ready && artifact.ed25519_sig && (
        <Badge variant="outline" className="text-[10px]" title={artifact.signing_key_id}>
          已签名
        </Badge>
      )}
      {ready ? (
        <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">已就绪</Badge>
      ) : (
        <Badge className="bg-amber-100 text-amber-800 text-[10px]">等待中</Badge>
      )}
      {canEdit && (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

// ─── Add Artifact Dialog (browser direct upload) ───────────────────────────

function AddArtifactDialog({
  release,
  availablePlatforms,
  onClose,
  onAdded,
}: {
  release: Release
  availablePlatforms: readonly string[]
  onClose: () => void
  onAdded: () => void
}) {
  const qc = useQueryClient()
  const [platform, setPlatform] = useState(availablePlatforms[0] || "")
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<"idle" | "init" | "uploading" | "finalizing">("idle")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!availablePlatforms.includes(platform) && availablePlatforms.length > 0) {
      setPlatform(availablePlatforms[0])
    }
  }, [availablePlatforms, platform])

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const handleSubmit = async () => {
    setError("")
    if (!platform || !file) {
      setError("请选择平台和安装包文件")
      return
    }
    try {
      setProgress("init")
      const init = await admin.addArtifact(release.id, {
        platform,
        content_type: file.type || "application/octet-stream",
        expected_size: file.size,
        filename: file.name,
      })

      setProgress("uploading")
      const putResp = await fetch(init.upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      })
      if (!putResp.ok) {
        throw new Error(`上传失败：${putResp.status} ${putResp.statusText}`)
      }

      setProgress("finalizing")
      // The server hashes the object itself; the client hash is only a
      // cross-check, and reading a multi-GB installer into memory to
      // compute it fails in most browsers.
      const expected_sha256 = file.size <= CLIENT_HASH_MAX_BYTES ? await sha256Hex(file) : undefined
      await admin.finalizeArtifact(release.id, init.artifact.id, { expected_sha256 })

      showToast(`${platform} 平台安装包已上传`, "success")
      onAdded()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setProgress("idle")
      // The artifact row may already exist (pending) even though the
      // upload failed; refresh so it shows and a retry doesn't hit 409.
      qc.invalidateQueries({ queryKey: ["admin", "release", release.id] })
    }
  }

  const busy = progress !== "idle"

  return (
    <Dialog open onOpenChange={busy ? undefined : onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加安装包</DialogTitle>
          <DialogDescription>
            为 {release.version} 上传平台安装包。文件将直接上传至存储，并在发布时完成签名。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>平台</Label>
            <Select value={platform} onValueChange={setPlatform} disabled={busy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availablePlatforms.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>安装包文件</Label>
            <Input ref={fileInputRef} type="file" onChange={onFileChange} disabled={busy} />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {busy && (
            <div className="text-sm space-y-1 bg-muted rounded-md p-3">
              {progress === "init" && "正在创建上传任务..."}
              {progress === "uploading" && "正在上传到存储..."}
              {progress === "finalizing" && "正在计算 SHA-256 并完成处理..."}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={busy || !file || !platform}>
            <Upload className="h-4 w-4 mr-2" />
            {busy ? "处理中..." : "上传"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function YankDialog({ release, onClose }: { release: Release; onClose: () => void }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState("")
  const yankMut = useMutation({
    mutationFn: (r: string) => admin.yankRelease(release.id, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "releases"] })
      showToast("版本已撤回", "success")
      onClose()
    },
    onError: (e: Error) => showToast(e.message, "error"),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>撤回 {release.version}？</DialogTitle>
          <DialogDescription>
            撤回后，该版本及其全部安装包将从更新源移除，已有安装不受影响。撤回原因会记录到审计日志。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>撤回原因</Label>
          <Textarea
            rows={3}
            placeholder="例如：此版本存在影响 Windows 用户的严重问题，建议回退。"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() => yankMut.mutate(reason)}
            disabled={!reason.trim() || yankMut.isPending}
          >
            确认撤回
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Helpers ───

function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

const CLIENT_HASH_MAX_BYTES = 256 * 1024 * 1024

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest("SHA-256", buf)
  const bytes = new Uint8Array(hash)
  let hex = ""
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0")
  }
  return hex
}

function parseSemver(v: string): [number, number, number, string] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(v)
  if (!m) return null
  for (const part of [m[1], m[2], m[3]]) {
    if (part.length > 1 && part[0] === "0") return null
  }
  const pre = m[4] ?? ""
  if (pre) {
    for (const id of pre.split(".")) {
      if (id === "") return null
      if (/^\d+$/.test(id) && id.length > 1 && id[0] === "0") return null
    }
  }
  return [Number(m[1]), Number(m[2]), Number(m[3]), pre]
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa && !pb) return 0
  if (!pa) return -1
  if (!pb) return 1
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return (pa[i] as number) - (pb[i] as number)
  }
  const preA = pa[3] as string
  const preB = pb[3] as string
  if (preA === preB) return 0
  if (preA === "") return 1
  if (preB === "") return -1
  const partsA = preA.split(".")
  const partsB = preB.split(".")
  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const ai = partsA[i]
    const bi = partsB[i]
    if (ai === undefined) return -1
    if (bi === undefined) return 1
    const aNum = /^\d+$/.test(ai)
    const bNum = /^\d+$/.test(bi)
    if (aNum && bNum) {
      const diff = Number(ai) - Number(bi)
      if (diff !== 0) return diff
    } else if (aNum) {
      return -1
    } else if (bNum) {
      return 1
    } else if (ai !== bi) {
      return ai < bi ? -1 : 1
    }
  }
  return 0
}

// Channel fallback chain (mirrors server behavior).
const CHANNEL_FALLBACK: Record<string, string[]> = {
  stable: ["stable"],
  beta: ["beta", "stable"],
  alpha: ["alpha", "beta", "stable"],
  dev: ["dev", "alpha", "beta", "stable"],
}

function computeLatestVersions(releases: Release[]): Map<string, string> {
  const perChannelMax = new Map<string, string>()
  for (const r of releases) {
    if (r.status !== "published") continue
    const key = `${r.product_id}|${r.channel}`
    const cur = perChannelMax.get(key)
    if (!cur || compareSemver(r.version, cur) > 0) {
      perChannelMax.set(key, r.version)
    }
  }
  const out = new Map<string, string>()
  for (const [key] of perChannelMax) {
    const [productID, channel] = key.split("|")
    const chain = CHANNEL_FALLBACK[channel] ?? [channel]
    let max = ""
    for (const ch of chain) {
      const v = perChannelMax.get(`${productID}|${ch}`)
      if (v && (!max || compareSemver(v, max) > 0)) max = v
    }
    if (max) out.set(key, max)
  }
  return out
}

// ─── SigningKeysDialog (unchanged from before) ────────────────────────────

function SigningKeysDialog({ products, onClose }: { products: { id: string; name: string }[]; onClose: () => void }) {
  const [productId, setProductId] = useState(products[0]?.id || "")

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>发布签名密钥</DialogTitle>
          <DialogDescription>
            为每个产品生成独立的 Ed25519 密钥对。公钥嵌入客户端，服务端在发布时使用私钥签名每个安装包。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>产品</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {productId && <SigningKeysSection productId={productId} />}
      </DialogContent>
    </Dialog>
  )
}

function SigningKeysSection({ productId }: { productId: string }) {
  const qc = useQueryClient()
  const [rotateOpen, setRotateOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "signing-keys", productId],
    queryFn: () => admin.listSigningKeys(productId),
  })
  const keys = data?.keys || []
  const active = keys.find((k) => k.active)
  const history = keys.filter((k) => !k.active)

  const generateMut = useMutation({
    mutationFn: () => admin.generateSigningKey(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "signing-keys", productId] })
      showToast("签名密钥已生成", "success")
    },
    onError: (e: Error) => showToast(e.message, "error"),
  })

  if (isLoading) return <div className="h-32 animate-pulse bg-muted rounded-md mt-4" />

  return (
    <div className="space-y-4 mt-4">
      {!active ? (
        <Card>
          <CardContent className="py-8 text-center">
            <KeyRound className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">没有可用的签名密钥</p>
            <p className="text-sm text-muted-foreground mb-4">
              生成密钥前无法发布。也可以关闭产品的强制签名设置，以发布未签名版本。
            </p>
            <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              {generateMut.isPending ? "生成中..." : "生成签名密钥"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ActiveSigningKeyCard
          keyRow={active}
          productId={productId}
          onRotate={() => setRotateOpen(true)}
          onDeactivate={() => setDeactivateOpen(true)}
        />
      )}

      {history.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">历史密钥（{history.length}）</p>
          <div className="space-y-2">
            {history.map((k) => (
              <div key={k.id} className="bg-muted/50 rounded-md px-3 py-2 text-xs">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <code className="min-w-0 flex-1 truncate sm:mr-2">{k.public_key}</code>
                  <span className="text-muted-foreground shrink-0">
                    轮换于 {k.rotated_at ? formatDate(k.rotated_at) : "—"}
                  </span>
                </div>
                {k.note && <p className="text-muted-foreground mt-1">{k.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {rotateOpen && active && <RotateKeyDialog productId={productId} onClose={() => setRotateOpen(false)} />}
      {deactivateOpen && active && (
        <DeactivateKeyDialog productId={productId} onClose={() => setDeactivateOpen(false)} />
      )}
    </div>
  )
}

function ActiveSigningKeyCard({
  keyRow,
  productId,
  onRotate,
  onDeactivate,
}: {
  keyRow: ReleaseSigningKey
  productId: string
  onRotate: () => void
  onDeactivate: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(keyRow.public_key)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-sm">当前签名密钥</p>
            <p className="text-xs text-muted-foreground">创建于 {formatDate(keyRow.created_at)}</p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800">使用中</Badge>
        </div>
        <div>
          <Label className="text-xs">公钥（Ed25519，Base64）</Label>
          <div className="flex items-center gap-2 mt-1 bg-muted rounded-md px-3 py-2">
            <code className="text-xs flex-1 truncate font-mono">{keyRow.public_key}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copy}>
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            请将此公钥嵌入客户端更新验证器，例如 Sparkle 的 Info.plist <code>SUPublicEDKey</code> 或 Tauri 的{" "}
            <code>pubkey</code>。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={admin.publicKeyURL(productId)} download="public_key.pem">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              下载 .pem
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={onRotate}>
            <RotateCw className="h-3.5 w-3.5 mr-1.5" />
            轮换密钥
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={onDeactivate}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            停用
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RotateKeyDialog({ productId, onClose }: { productId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [note, setNote] = useState("")
  const mut = useMutation({
    mutationFn: (n: string) => admin.rotateSigningKey(productId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "signing-keys", productId] })
      showToast("签名密钥已轮换", "success")
      onClose()
    },
    onError: (e: Error) => showToast(e.message, "error"),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>轮换签名密钥？</DialogTitle>
          <DialogDescription>
            系统会生成新密钥对，旧密钥保留在历史记录中但不再使用。仅内置旧公钥的客户端将无法验证新版本。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>原因（写入审计日志）</Label>
          <Textarea
            rows={3}
            placeholder="例如：例行轮换，密钥未泄露。"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => mut.mutate(note)} disabled={mut.isPending}>
            {mut.isPending ? "轮换中..." : "确认轮换"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DeactivateKeyDialog({ productId, onClose }: { productId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [note, setNote] = useState("")
  const mut = useMutation({
    mutationFn: (n: string) => admin.deactivateSigningKey(productId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "signing-keys", productId] })
      showToast("签名密钥已停用", "success")
      onClose()
    },
    onError: (e: Error) => showToast(e.message, "error"),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>停用签名密钥？</DialogTitle>
          <DialogDescription>
            已发布版本的签名不受影响。停用后需要生成新密钥才能继续发布；如果产品关闭强制签名，新版本将不带签名，启用严格校验的客户端会拒绝该版本。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>原因（写入审计日志）</Label>
          <Textarea
            rows={3}
            placeholder="请输入停用原因"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button variant="destructive" onClick={() => mut.mutate(note)} disabled={mut.isPending}>
            {mut.isPending ? "停用中..." : "确认停用"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
