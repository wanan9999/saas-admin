package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tabloy/keygate/internal/model"
)

func TestScopedProductFilter(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name      string
		apiKey    *model.APIKey
		requested string
		want      string
		wantOK    bool
		wantCode  int
	}{
		{name: "admin session keeps empty filter", requested: "", want: "", wantOK: true, wantCode: http.StatusOK},
		{name: "admin session keeps requested filter", requested: "product-b", want: "product-b", wantOK: true, wantCode: http.StatusOK},
		{name: "system key keeps empty filter", apiKey: &model.APIKey{}, requested: "", want: "", wantOK: true, wantCode: http.StatusOK},
		{name: "system key keeps requested filter", apiKey: &model.APIKey{}, requested: "product-b", want: "product-b", wantOK: true, wantCode: http.StatusOK},
		{name: "product key supplies omitted filter", apiKey: &model.APIKey{ProductID: "product-a"}, requested: "", want: "product-a", wantOK: true, wantCode: http.StatusOK},
		{name: "product key accepts matching filter", apiKey: &model.APIKey{ProductID: "product-a"}, requested: "product-a", want: "product-a", wantOK: true, wantCode: http.StatusOK},
		{name: "product key rejects different filter", apiKey: &model.APIKey{ProductID: "product-a"}, requested: "product-b", want: "", wantOK: false, wantCode: http.StatusForbidden},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			if tt.apiKey != nil {
				c.Set("api_key", tt.apiKey)
			}

			got, ok := scopedProductFilter(c, tt.requested)
			if got != tt.want || ok != tt.wantOK {
				t.Fatalf("scopedProductFilter() = (%q, %v), want (%q, %v)", got, ok, tt.want, tt.wantOK)
			}
			if w.Code != tt.wantCode {
				t.Fatalf("status = %d, want %d", w.Code, tt.wantCode)
			}
		})
	}
}
