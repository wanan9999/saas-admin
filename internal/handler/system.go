package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wanan9999/saas-admin/internal/branding"
	"github.com/wanan9999/saas-admin/internal/store"
	"github.com/wanan9999/saas-admin/internal/version"
	"github.com/wanan9999/saas-admin/pkg/response"
)

type SystemHandler struct {
	Store     *store.Store
	RepoOwner string
	RepoName  string
}

type updateInfo struct {
	Available     bool   `json:"available"`
	Latest        string `json:"latest_version"`
	Current       string `json:"current_version"`
	ReleaseURL    string `json:"release_url,omitempty"`
	ReleaseDate   string `json:"release_date,omitempty"`
	Changelog     string `json:"changelog,omitempty"`
	UpdateCommand string `json:"update_command,omitempty"`
	CheckedAt     string `json:"checked_at"`
	Error         string `json:"error,omitempty"`
}

func NewSystemHandler(s *store.Store) *SystemHandler {
	return &SystemHandler{
		Store:     s,
		RepoOwner: "wanan9999",
		RepoName:  "saas-admin",
	}
}

func (h *SystemHandler) GetVersion(c *gin.Context) {
	response.OK(c, gin.H{
		"version":     version.Version,
		"project":     branding.Project,
		"project_url": branding.RepositoryURL,
	})
}

// CheckUpdate performs one explicit GitHub request. It is only wired to the
// authenticated admin action; no startup or periodic update request exists.
func (h *SystemHandler) CheckUpdate(c *gin.Context) {
	response.OK(c, h.fetchLatestRelease(c.Request.Context()))
}

func (h *SystemHandler) fetchLatestRelease(ctx context.Context) *updateInfo {
	info := &updateInfo{
		Current:   version.Version,
		CheckedAt: time.Now().UTC().Format(time.RFC3339),
	}

	client := &http.Client{Timeout: 10 * time.Second}
	url := "https://api.github.com/repos/" + h.RepoOwner + "/" + h.RepoName + "/releases/latest"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return info
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", branding.Project+"/"+version.Version)

	resp, err := client.Do(req)
	if err != nil {
		info.Error = "failed to reach GitHub: " + err.Error()
		return info
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		// No releases published yet — not an error
		info.Latest = info.Current
		return info
	}
	if resp.StatusCode != 200 {
		info.Error = "GitHub API returned " + resp.Status
		return info
	}

	var release struct {
		TagName     string `json:"tag_name"`
		HTMLURL     string `json:"html_url"`
		PublishedAt string `json:"published_at"`
		Body        string `json:"body"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		info.Error = "failed to parse GitHub response"
		return info
	}

	info.Latest = release.TagName
	info.ReleaseURL = release.HTMLURL
	info.ReleaseDate = release.PublishedAt
	info.Changelog = release.Body
	info.Available = semverNewer(stripV(release.TagName), stripV(version.Version))
	info.UpdateCommand = "docker pull ghcr.io/" + h.RepoOwner + "/" + h.RepoName + ":" + stripV(release.TagName)

	return info
}

// semverNewer returns true if latest > current using semantic versioning.
func semverNewer(latest, current string) bool {
	if latest == "" || current == "" || current == "dev" {
		return false
	}
	lp := parseSemver(latest)
	cp := parseSemver(current)
	if lp[0] != cp[0] {
		return lp[0] > cp[0]
	}
	if lp[1] != cp[1] {
		return lp[1] > cp[1]
	}
	return lp[2] > cp[2]
}

func parseSemver(v string) [3]int {
	parts := strings.SplitN(v, ".", 3)
	var result [3]int
	for i := 0; i < 3 && i < len(parts); i++ {
		// Strip pre-release suffix (e.g. "1-beta" → "1")
		num := strings.SplitN(parts[i], "-", 2)[0]
		result[i], _ = strconv.Atoi(num)
	}
	return result
}

func stripV(v string) string {
	if len(v) > 0 && v[0] == 'v' {
		return v[1:]
	}
	return v
}

func (h *SystemHandler) GetMigrationStatus(c *gin.Context) {
	migrations, err := h.Store.ListAppliedMigrations(c)
	if err != nil {
		response.Internal(c)
		return
	}
	response.OK(c, gin.H{"migrations": migrations})
}
