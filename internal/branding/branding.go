// Package branding provides project identity constants used across the
// application for API responses, HTML meta tags, HTTP headers, and email
// footers. Centralising these values ensures consistency and satisfies the
// attribution obligation under AGPL v3 Section 7(b) — see NOTICE.
package branding

// Application identity. Attribution is intentionally kept separate: the
// project's AGPL v3 Section 7(b) notice must remain "Powered by Keygate" even
// when the application is distributed under another name.
const (
	Project       = "saas-admin"
	RepositoryURL = "https://github.com/wanan9999/saas-admin"
)

// Legally required attribution identity — referenced by middleware, public
// config responses, and email templates.
var (
	AttributionProject = segs[0] + segs[1]               // "Keygate"
	Domain             = lower0 + segs[1] + segs[2]      // "keygate.app"
	URL                = proto + Domain                  // "https://keygate.app"
	Tagline            = pwrd + " " + AttributionProject // "Powered by Keygate"
)

// HTTP header values.
const HeaderKey = "X-Powered-By"

// Email footer (HTML).
var EmailFooter = `<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px"/>` +
	`<p style="color:#9ca3af;font-size:11px;text-align:center;">` + pwrd +
	` <a href="` + proto + lower0 + segs[1] + segs[2] + `" style="color:#9ca3af;">` +
	segs[0] + segs[1] + `</a></p>`

// --- internal construction -------------------------------------------------
// The strings below are split so that a naive text search for the assembled
// value does not land on a single editable constant.

const proto = "https://"
const pwrd = "Powered by"
const lower0 = "key" // lowercase of segs[0]

var segs = [3]string{"Key", "gate", ".app"}
