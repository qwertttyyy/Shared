package httpapi

import (
	"io"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"
)

const maxTextPreviewBytes = 512 * 1024

func (a *api) previewTextFile(w http.ResponseWriter, r *http.Request) {
	item, err := a.ownedItem(r)
	if err != nil || item.Type != "file" {
		fail(w, http.StatusNotFound, "Файл не найден")
		return
	}
	if item.Size > maxTextPreviewBytes {
		fail(w, http.StatusRequestEntityTooLarge, "Для предпросмотра файл должен быть не больше 512 КиБ. Скачайте его, чтобы открыть.")
		return
	}

	file, err := a.files.Open(item.StorageKey)
	if err != nil {
		fail(w, http.StatusNotFound, "Файл отсутствует в хранилище")
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxTextPreviewBytes+1))
	if err != nil {
		fail(w, http.StatusInternalServerError, "Не удалось прочитать файл. Попробуйте ещё раз.")
		return
	}
	if len(data) > maxTextPreviewBytes {
		fail(w, http.StatusRequestEntityTooLarge, "Для предпросмотра файл должен быть не больше 512 КиБ. Скачайте его, чтобы открыть.")
		return
	}
	if !isPreviewableText(data) {
		fail(w, http.StatusUnsupportedMediaType, "Предпросмотр доступен для текстовых файлов в UTF-8. Скачайте файл, чтобы открыть его.")
		return
	}

	w.Header().Set("X-Content-Type-Options", "nosniff")
	respond(w, http.StatusOK, struct {
		Text string `json:"text"`
	}{Text: strings.TrimPrefix(string(data), "\ufeff")})
}

func isPreviewableText(data []byte) bool {
	if !utf8.Valid(data) || !strings.HasPrefix(http.DetectContentType(data), "text/") {
		return false
	}
	for len(data) > 0 {
		char, size := utf8.DecodeRune(data)
		if unicode.IsControl(char) && char != '\n' && char != '\r' && char != '\t' && char != '\f' {
			return false
		}
		data = data[size:]
	}
	return true
}
