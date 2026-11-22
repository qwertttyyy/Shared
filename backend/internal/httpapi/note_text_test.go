package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReadNoteTextPreservesSource(t *testing.T) {
	const text = "\r\n    def пример():\r\n\treturn '📌'  \r\n"
	body, err := json.Marshal(map[string]string{"text": text})
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodPost, "/api/items/text", strings.NewReader(string(body)))
	got, ok := readNoteText(httptest.NewRecorder(), r)
	if !ok || got != text {
		t.Fatalf("readNoteText = %q, %v; want original text", got, ok)
	}
}

func TestReadNoteTextRejectsInvalidSource(t *testing.T) {
	for name, text := range map[string]string{
		"blank":     " \t\r\n",
		"null byte": "before\x00after",
		"too long":  strings.Repeat(" ", 10000) + "a",
	} {
		t.Run(name, func(t *testing.T) {
			body, err := json.Marshal(map[string]string{"text": text})
			if err != nil {
				t.Fatal(err)
			}
			r := httptest.NewRequest(http.MethodPost, "/api/items/text", strings.NewReader(string(body)))
			w := httptest.NewRecorder()
			if _, ok := readNoteText(w, r); ok || w.Code != http.StatusBadRequest {
				t.Fatalf("readNoteText accepted invalid source with status %d", w.Code)
			}
		})
	}
}
