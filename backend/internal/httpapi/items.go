package httpapi

import (
	"errors"
	"example.com/shared/backend/internal/auth"
	"example.com/shared/backend/internal/model"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"unicode/utf8"
)

const pageSize = 20

func (a *api) ownedItem(r *http.Request) (model.Item, error) {
	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		return model.Item{}, gorm.ErrRecordNotFound
	}
	var item model.Item
	identity := auth.FromContext(r.Context())
	err := a.db.WithContext(r.Context()).Where("id = ? AND user_id = ?", id, identity.User.ID).First(&item).Error
	return item, err
}

func (a *api) listItems(w http.ResponseWriter, r *http.Request) {
	page := 1
	if raw := r.URL.Query().Get("page"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 1000000 {
			fail(w, 400, "Неверный номер страницы")
			return
		}
		page = value
	}
	kind := r.URL.Query().Get("type")
	if kind != "" && kind != "text" && kind != "file" {
		fail(w, 400, "Неверный тип объектов")
		return
	}
	q := a.db.WithContext(r.Context()).Model(&model.Item{}).Where("user_id = ?", auth.FromContext(r.Context()).User.ID)
	if kind != "" {
		q = q.Where("type = ?", kind)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		fail(w, 500, "Не удалось загрузить записи")
		return
	}
	items := make([]model.Item, 0)
	if err := q.Order("created_at DESC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		fail(w, 500, "Не удалось загрузить записи")
		return
	}
	respond(w, 200, map[string]any{"items": items, "page": page, "page_size": pageSize, "total": total, "pages": (total + pageSize - 1) / pageSize})
}
func (a *api) itemStats(w http.ResponseWriter, r *http.Request) {
	var rows []struct {
		Type  string `gorm:"column:type"`
		Total int64  `gorm:"column:total"`
	}
	err := a.db.WithContext(r.Context()).Model(&model.Item{}).
		Select("type, COUNT(*) AS total").
		Where("user_id = ?", auth.FromContext(r.Context()).User.ID).
		Group("type").Scan(&rows).Error
	if err != nil {
		fail(w, 500, "Не удалось загрузить статистику")
		return
	}
	result := map[string]int64{"all": 0, "text": 0, "file": 0}
	for _, row := range rows {
		result[row.Type] = row.Total
		result["all"] += row.Total
	}
	respond(w, 200, result)
}

func (a *api) getItem(w http.ResponseWriter, r *http.Request) {
	item, err := a.ownedItem(r)
	if err != nil {
		fail(w, 404, "Объект не найден")
		return
	}
	respond(w, 200, item)
}
func readNoteText(w http.ResponseWriter, r *http.Request) (string, bool) {
	var data struct {
		Text string `json:"text"`
	}
	if err := decodeJSON(r, &data); err != nil {
		fail(w, 400, "Неверный формат данных")
		return "", false
	}
	data.Text = strings.TrimSpace(data.Text)
	if data.Text == "" || !utf8.ValidString(data.Text) || utf8.RuneCountInString(data.Text) > 10000 {
		fail(w, 400, "Введите текст до 10 000 символов")
		return "", false
	}
	return data.Text, true
}

func (a *api) createText(w http.ResponseWriter, r *http.Request) {
	text, ok := readNoteText(w, r)
	if !ok {
		return
	}
	identity := auth.FromContext(r.Context())
	item := model.Item{ID: uuid.NewString(), UserID: identity.User.ID, Type: "text", Text: text}
	if err := a.db.WithContext(r.Context()).Create(&item).Error; err != nil {
		fail(w, 500, "Не удалось сохранить запись")
		return
	}
	a.hub.NotifyCreated(identity.User.ID, item.ID)
	respond(w, 201, item)
}

func (a *api) ownedNotes(r *http.Request, item *model.Item) *gorm.DB {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		return nil
	}
	return a.db.WithContext(r.Context()).Model(item).
		Where("id = ? AND user_id = ? AND type = ?", id.String(), auth.FromContext(r.Context()).User.ID, "text")
}

func (a *api) updateText(w http.ResponseWriter, r *http.Request) {
	var item model.Item
	query := a.ownedNotes(r, &item)
	if query == nil {
		fail(w, 404, "Заметка не найдена")
		return
	}
	text, ok := readNoteText(w, r)
	if !ok {
		return
	}
	result := query.Clauses(clause.Returning{}).Update("text", text)
	if result.Error != nil {
		fail(w, 500, "Не удалось сохранить заметку")
		return
	}
	if result.RowsAffected == 0 {
		fail(w, 404, "Заметка не найдена")
		return
	}
	a.hub.NotifyItem(item.UserID, item.ID, "item.updated")
	respond(w, 200, item)
}

func (a *api) deleteText(w http.ResponseWriter, r *http.Request) {
	var item model.Item
	query := a.ownedNotes(r, &item)
	if query == nil {
		fail(w, 404, "Заметка не найдена")
		return
	}
	result := query.Clauses(clause.Returning{}).Delete(&item)
	if result.Error != nil {
		fail(w, 500, "Не удалось удалить заметку")
		return
	}
	if result.RowsAffected == 0 {
		fail(w, 404, "Заметка не найдена")
		return
	}
	a.hub.NotifyItem(item.UserID, item.ID, "item.deleted")
	respond(w, 200, map[string]bool{"ok": true})
}
func (a *api) createFile(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, a.cfg.MaxFileBytes+1024*1024)
	if err := r.ParseMultipartForm(4 << 20); err != nil {
		fail(w, 413, "Размер запроса превышен или файл повреждён")
		return
	}
	defer r.MultipartForm.RemoveAll()
	caption := strings.TrimSpace(r.FormValue("caption"))
	if !utf8.ValidString(caption) || utf8.RuneCountInString(caption) > 500 {
		fail(w, 400, "Подпись не должна превышать 500 символов")
		return
	}
	upload, header, err := r.FormFile("file")
	if err != nil {
		fail(w, 400, "Выберите файл")
		return
	}
	defer upload.Close()
	if header.Size <= 0 {
		fail(w, 400, "Пустые файлы не поддерживаются")
		return
	}
	if header.Size > a.cfg.MaxFileBytes {
		fail(w, 413, "Файл слишком большой")
		return
	}
	filename := filepath.Base(strings.ReplaceAll(header.Filename, "\\", "/"))
	if filename == "." || filename == "/" || filename == "" {
		filename = "file"
	}
	if utf8.RuneCountInString(filename) > 255 {
		fail(w, 400, "Слишком длинное имя файла")
		return
	}
	key, contentType, size, err := a.files.Save(upload)
	if err != nil {
		fail(w, 500, "Не удалось сохранить файл")
		return
	}
	identity := auth.FromContext(r.Context())
	item := model.Item{ID: uuid.NewString(), UserID: identity.User.ID, Type: "file", Caption: caption, OriginalFilename: filename, StorageKey: key, ContentType: contentType, Size: size}
	if err := a.db.WithContext(r.Context()).Create(&item).Error; err != nil {
		_ = a.files.Remove(key)
		fail(w, 500, "Не удалось сохранить файл")
		return
	}
	a.hub.NotifyCreated(identity.User.ID, item.ID)
	respond(w, 201, item)
}
func (a *api) serveFile(w http.ResponseWriter, r *http.Request, preview bool) {
	item, err := a.ownedItem(r)
	if err != nil || item.Type != "file" {
		fail(w, 404, "Файл не найден")
		return
	}
	if preview && item.ContentType != "image/jpeg" && item.ContentType != "image/png" && item.ContentType != "image/webp" {
		fail(w, 415, "Предпросмотр недоступен")
		return
	}
	file, err := a.files.Open(item.StorageKey)
	if err != nil {
		fail(w, 404, "Файл отсутствует в хранилище")
		return
	}
	defer file.Close()
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, no-store")
	if preview {
		w.Header().Set("Content-Disposition", "inline")
	} else {
		disposition := mime.FormatMediaType("attachment", map[string]string{"filename": item.OriginalFilename})
		if disposition == "" {
			disposition = "attachment"
		}
		w.Header().Set("Content-Disposition", disposition)
	}
	w.Header().Set("Content-Type", item.ContentType)
	w.Header().Set("Content-Length", fmt.Sprint(item.Size))
	if _, err := io.Copy(w, file); err != nil && !errors.Is(err, io.EOF) {
		return
	}
}
func (a *api) previewFile(w http.ResponseWriter, r *http.Request)  { a.serveFile(w, r, true) }
func (a *api) downloadFile(w http.ResponseWriter, r *http.Request) { a.serveFile(w, r, false) }
