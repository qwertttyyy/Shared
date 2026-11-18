package migrations

import (
	"database/sql"
	"embed"
	"github.com/pressly/goose/v3"
)

//go:embed *.sql
var files embed.FS

func Apply(db *sql.DB) error {
	goose.SetBaseFS(files)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.Up(db, ".")
}
