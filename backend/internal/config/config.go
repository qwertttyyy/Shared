package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	DatabaseURL  string
	UploadDir    string
	PublicOrigin string
	CookieSecure bool
	TrustProxy   bool
	MaxFileBytes int64
}

func Load() (Config, error) {
	fileValues, err := readEnvFile()
	if err != nil {
		return Config{}, err
	}
	env := func(key, fallback string) string {
		if value := os.Getenv(key); value != "" {
			return value
		}
		if value := fileValues[key]; value != "" {
			return value
		}
		return fallback
	}

	secure, err := strconv.ParseBool(env("COOKIE_SECURE", "false"))
	if err != nil {
		return Config{}, fmt.Errorf("COOKIE_SECURE: %w", err)
	}
	trustProxy, err := strconv.ParseBool(env("TRUST_PROXY", "false"))
	if err != nil {
		return Config{}, fmt.Errorf("TRUST_PROXY: %w", err)
	}
	maxMiB, err := strconv.ParseInt(env("MAX_FILE_MIB", "25"), 10, 64)
	if err != nil || maxMiB < 1 || maxMiB > 1024 {
		return Config{}, fmt.Errorf("MAX_FILE_MIB must be between 1 and 1024")
	}
	cfg := Config{
		Port:         env("PORT", "8080"),
		DatabaseURL:  env("DATABASE_URL", ""),
		UploadDir:    env("UPLOAD_DIR", "./uploads"),
		PublicOrigin: strings.TrimSuffix(env("PUBLIC_ORIGIN", "http://localhost:5173"), "/"),
		CookieSecure: secure,
		TrustProxy:   trustProxy,
		MaxFileBytes: maxMiB * 1024 * 1024,
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required in .env or the process environment")
	}
	return cfg, nil
}

func readEnvFile() (map[string]string, error) {
	data, err := os.ReadFile(".env")
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	values, err := godotenv.Unmarshal(strings.TrimPrefix(string(data), "\uFEFF"))
	if err != nil {
		return nil, fmt.Errorf("invalid dotenv syntax in .env")
	}
	return values, nil
}
