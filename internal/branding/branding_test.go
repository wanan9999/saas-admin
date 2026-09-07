package branding_test

import (
	"testing"

	"github.com/wanan9999/saas-admin/internal/branding"
)

func TestBrandingValues(t *testing.T) {
	if branding.Project != "saas-admin" {
		t.Errorf("Project = %q", branding.Project)
	}
	if branding.RepositoryURL != "https://github.com/wanan9999/saas-admin" {
		t.Errorf("RepositoryURL = %q", branding.RepositoryURL)
	}
	if branding.AttributionProject != "Keygate" {
		t.Errorf("AttributionProject = %q", branding.AttributionProject)
	}
	if branding.Domain != "keygate.app" {
		t.Errorf("Domain = %q", branding.Domain)
	}
	if branding.URL != "https://keygate.app" {
		t.Errorf("URL = %q", branding.URL)
	}
	if branding.Tagline != "Powered by Keygate" {
		t.Errorf("Tagline = %q", branding.Tagline)
	}
}
