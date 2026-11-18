package model

import "time"

type User struct {
	ID           string    `gorm:"primaryKey;type:uuid" json:"id"`
	Login        string    `gorm:"uniqueIndex;size:64;not null" json:"login"`
	PasswordHash string    `gorm:"not null" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

func (User) TableName() string { return "users" }

type Session struct {
	TokenHash string    `gorm:"primaryKey;size:64"`
	UserID    string    `gorm:"type:uuid;not null;index"`
	CSRFToken string    `gorm:"not null"`
	ExpiresAt time.Time `gorm:"not null;index"`
	CreatedAt time.Time
}

func (Session) TableName() string { return "sessions" }

type Item struct {
	ID               string    `gorm:"primaryKey;type:uuid" json:"id"`
	UserID           string    `gorm:"type:uuid;not null;index" json:"-"`
	Type             string    `gorm:"size:16;not null" json:"type"`
	Text             string    `json:"text,omitempty"`
	Caption          string    `json:"caption,omitempty"`
	OriginalFilename string    `json:"original_filename,omitempty"`
	StorageKey       string    `json:"-"`
	ContentType      string    `json:"content_type,omitempty"`
	Size             int64     `json:"size,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

func (Item) TableName() string { return "items" }
