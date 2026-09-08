import { ArrowRight, CheckCircle2, Mail, ShieldCheck, Terminal } from "lucide-react"
import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"
import { useSiteConfig } from "@/hooks/use-site-config"
import { useI18n } from "@/i18n"
import { auth } from "@/lib/api"

export default function LoginPage() {
  const { t } = useI18n()
  const { site_name, logo_url, attribution_text, attribution_url } = useSiteConfig()
  const { user, loading, refetch } = useAuth()
  const [devLogin, setDevLogin] = useState(false)
  const [devEmail, setDevEmail] = useState("admin@saas-admin.local")
  const [devName, setDevName] = useState("Admin")
  const [devLoading, setDevLoading] = useState(false)
  const [devError, setDevError] = useState("")

  // OTP state
  const [otpStep, setOtpStep] = useState<"email" | "code">("email")
  const [otpEmail, setOtpEmail] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState("")
  const [otpCooldown, setOtpCooldown] = useState(0)

  useEffect(() => {
    auth
      .providers()
      .then((r) => {
        setDevLogin(r.dev_login)
      })
      .catch(() => {})
  }, [])

  // Cooldown timer for resend
  useEffect(() => {
    if (otpCooldown <= 0) return
    const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [otpCooldown])

  const handleOtpSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setOtpLoading(true)
    setOtpError("")
    try {
      await auth.otpSend(otpEmail)
      setOtpStep("code")
      setOtpCooldown(60)
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : t("login.failed"))
    } finally {
      setOtpLoading(false)
    }
  }

  const handleOtpResend = async () => {
    if (otpCooldown > 0) return
    setOtpLoading(true)
    setOtpError("")
    try {
      await auth.otpSend(otpEmail)
      setOtpCooldown(60)
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : t("login.failed"))
    } finally {
      setOtpLoading(false)
    }
  }

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setOtpLoading(true)
    setOtpError("")
    try {
      await auth.otpVerify(otpEmail, otpCode)
      await refetch()
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : t("login.failed"))
    } finally {
      setOtpLoading(false)
    }
  }

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setDevLoading(true)
    setDevError("")
    try {
      await auth.devLogin(devEmail, devName)
      await refetch()
    } catch (err) {
      setDevError(err instanceof Error ? err.message : t("login.failed"))
    } finally {
      setDevLoading(false)
    }
  }

  if (loading) return null
  if (user) return <Navigate to={user.is_admin ? "/admin" : "/portal"} replace />

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_32%),radial-gradient(circle_at_88%_92%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.025] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px]" />

      <main className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border/70 bg-card/88 shadow-[0_32px_90px_-42px_rgb(15_23_42/0.48)] backdrop-blur-xl lg:min-h-[620px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-foreground p-10 text-background lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-primary/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-background/10 ring-1 ring-background/15">
              <img src={logo_url || "/logo.svg"} alt="" className="h-7 w-7" />
            </div>
            <span className="text-lg font-semibold tracking-tight">{site_name}</span>
          </div>
          <div className="relative max-w-md">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-background/10 px-3 py-1.5 text-xs text-background/80 ring-1 ring-background/10">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("login.secureAccess")}
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-[-0.035em]">{t("login.welcomeTitle")}</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-background/60">{t("login.welcomeDesc")}</p>
          </div>
          <div className="relative flex items-center gap-2 text-xs text-background/50">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {t("login.passwordless")}
          </div>
        </section>

        <section className="flex items-center justify-center p-5 sm:p-10 lg:p-12">
          <Card variant="workspace" className="w-full max-w-sm">
            <CardHeader className="px-0 pb-7 text-left">
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
                  <img src={logo_url || "/logo.svg"} alt="" className="h-7 w-7" />
                </div>
                <span className="font-semibold tracking-tight">{site_name}</span>
              </div>
              <CardTitle className="text-2xl tracking-tight">{t("login.subtitle")}</CardTitle>
              <CardDescription className="mt-1.5">{t("login.passwordless")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-0">
              {/* OTP Email Step */}
              {otpStep === "email" && (
                <form onSubmit={handleOtpSend} className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t("common.email")}</Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  {otpError && <p className="text-sm text-destructive">{otpError}</p>}
                  <Button type="submit" className="h-10 w-full" disabled={otpLoading}>
                    <Mail className="mr-2 h-4 w-4" />
                    {otpLoading ? t("login.sendingCode") : t("login.sendCode")}
                    {!otpLoading && <ArrowRight className="ml-auto h-4 w-4" />}
                  </Button>
                </form>
              )}

              {/* OTP Code Step */}
              {otpStep === "code" && (
                <form onSubmit={handleOtpVerify} className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    {t("login.codeSentTo", { email: otpEmail })}
                  </p>
                  <div className="space-y-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                      className="h-12 text-center font-mono text-2xl tracking-[0.45em]"
                    />
                  </div>
                  {otpError && <p className="text-sm text-destructive">{otpError}</p>}
                  <Button type="submit" className="h-10 w-full" disabled={otpLoading || otpCode.length !== 6}>
                    {otpLoading ? t("login.verifying") : t("login.verify")}
                  </Button>
                  <div className="flex justify-between text-xs">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setOtpStep("email")
                        setOtpCode("")
                        setOtpError("")
                      }}
                    >
                      {t("login.changeEmail")}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                      disabled={otpCooldown > 0}
                      onClick={handleOtpResend}
                    >
                      {otpCooldown > 0 ? t("login.resendIn", { seconds: String(otpCooldown) }) : t("login.resendCode")}
                    </button>
                  </div>
                </form>
              )}

              {/* Dev Login (development only) */}
              {devLogin && otpStep === "email" && (
                <>
                  <div className="relative my-4">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                      {t("login.devMode")}
                    </span>
                  </div>
                  <form onSubmit={handleDevLogin} className="space-y-3">
                    <div className="space-y-2">
                      <Label>{t("common.email")}</Label>
                      <Input type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("common.name")}</Label>
                      <Input value={devName} onChange={(e) => setDevName(e.target.value)} />
                    </div>
                    {devError && <p className="text-sm text-destructive">{devError}</p>}
                    <Button type="submit" className="w-full" disabled={devLoading}>
                      <Terminal className="h-4 w-4 mr-2" />
                      {devLoading ? t("login.signingIn") : t("login.devLogin")}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">{t("login.devNote")}</p>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
      {/* Attribution required by AGPL v3 Section 7(b) — see NOTICE */}
      <a
        href={attribution_url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground sm:bottom-3"
      >
        {attribution_text}
      </a>
    </div>
  )
}
