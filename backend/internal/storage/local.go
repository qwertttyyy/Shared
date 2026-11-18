package storage

import (
	"fmt"
	"github.com/google/uuid"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

type Local struct {
	root     string
	maxBytes int64
}

func NewLocal(root string, maxBytes int64) (*Local, error) {
	if err := os.MkdirAll(root, 0700); err != nil {
		return nil, err
	}
	return &Local{root: root, maxBytes: maxBytes}, nil
}

// Save streams an uploaded file to a temporary path before atomically renaming it.
func (s *Local) Save(file multipart.File) (key, contentType string, size int64, err error) {
	temp, err := os.CreateTemp(s.root, ".upload-*")
	if err != nil {
		return "", "", 0, err
	}
	tempName := temp.Name()
	defer os.Remove(tempName)
	defer temp.Close()
	header := make([]byte, 512)
	n, readErr := io.ReadFull(file, header)
	if readErr != nil && readErr != io.EOF && readErr != io.ErrUnexpectedEOF {
		return "", "", 0, readErr
	}
	contentType = http.DetectContentType(header[:n])
	if _, err := temp.Write(header[:n]); err != nil {
		return "", "", 0, err
	}
	copied, err := io.Copy(temp, io.LimitReader(file, s.maxBytes-int64(n)+1))
	if err != nil {
		return "", "", 0, err
	}
	size = copied + int64(n)
	if size > s.maxBytes {
		return "", "", 0, fmt.Errorf("file exceeds size limit")
	}
	if err := temp.Close(); err != nil {
		return "", "", 0, err
	}
	key = uuid.NewString()
	if err := os.Rename(tempName, filepath.Join(s.root, key)); err != nil {
		return "", "", 0, err
	}
	return key, contentType, size, nil
}

func (s *Local) Open(key string) (*os.File, error) {
	if _, err := uuid.Parse(key); err != nil {
		return nil, fmt.Errorf("invalid storage key")
	}
	return os.Open(filepath.Join(s.root, key))
}
func (s *Local) Remove(key string) error {
	if _, err := uuid.Parse(key); err != nil {
		return fmt.Errorf("invalid storage key")
	}
	return os.Remove(filepath.Join(s.root, key))
}
