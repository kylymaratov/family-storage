package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type MediaRecord struct {
	Filename  string `json:"filename"`
	Hash      string `json:"hash"`
	Type      string `json:"type"`
	CreatedAt int64  `json:"createdAt"`
}

var db *sql.DB

func InitDB() error {
	var err error
	db, err = sql.Open("sqlite", "./storage.db")
	if err != nil {
		return err
	}

	queryMedia := `
	CREATE TABLE IF NOT EXISTS media (
		filename TEXT PRIMARY KEY,
		hash TEXT NOT NULL,
		type TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT 0
	);`

	if _, err = db.Exec(queryMedia); err != nil {
		return err
	}

	hasCreatedAt, err := columnExists("media", "created_at")
	if err != nil {
		return err
	}
	if !hasCreatedAt {
		if _, err = db.Exec("ALTER TABLE media ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0"); err != nil {
			return err
		}
	}

	queryTokens := `
	CREATE TABLE IF NOT EXISTS authorized_tokens (
		token TEXT PRIMARY KEY,
		device_name TEXT NOT NULL
	);`

	if _, err = db.Exec(queryTokens); err != nil {
		return err
	}

	return nil
}

func GetRecords() ([]MediaRecord, error) {
	rows, err := db.Query("SELECT filename, hash, type, created_at FROM media ORDER BY created_at DESC, rowid DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []MediaRecord
	for rows.Next() {
		var rec MediaRecord
		if err := rows.Scan(&rec.Filename, &rec.Hash, &rec.Type, &rec.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
}

func columnExists(table, column string) (bool, error) {
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			cid     int
			name    string
			ctype   string
			notnull int
			dflt    sql.NullString
			pk      int
		)
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false, err
		}
		if name == column {
			return true, nil
		}
	}
	return false, nil
}

func BackfillCreatedAt() error {
	rows, err := db.Query("SELECT filename, type FROM media WHERE created_at = 0")
	if err != nil {
		return err
	}

	type pending struct {
		filename  string
		mediaType string
	}
	var items []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.filename, &p.mediaType); err != nil {
			rows.Close()
			return err
		}
		items = append(items, p)
	}
	rows.Close()

	for _, p := range items {
		dir := StorageDirPhotos
		if p.mediaType == "video" {
			dir = StorageDirVideo
		}
		createdAt := time.Now().Unix()
		if info, ierr := os.Stat(filepath.Join(dir, p.filename)); ierr == nil {
			createdAt = info.ModTime().Unix()
		}
		if _, err := db.Exec("UPDATE media SET created_at = ? WHERE filename = ?", createdAt, p.filename); err != nil {
			return err
		}
	}
	return nil
}

func GetExistingFilesMap() (map[string]bool, error) {
	rows, err := db.Query("SELECT filename FROM media")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fileMap := make(map[string]bool)
	for rows.Next() {
		var filename string
		if err := rows.Scan(&filename); err != nil {
			return nil, err
		}
		fileMap[filename] = true
	}
	return fileMap, nil
}

func SaveMediaRecord(filename string, hash string, mediaType string, createdAt int64) error {
	_, err := db.Exec("INSERT INTO media (filename, hash, type, created_at) VALUES (?, ?, ?, ?)", filename, hash, mediaType, createdAt)
	return err
}

func IsTokenValid(token string) (bool, error) {
	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM authorized_tokens WHERE token = ?)", token).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func AddToken(token string, deviceName string) error {
	_, err := db.Exec("INSERT OR IGNORE INTO authorized_tokens (token, device_name) VALUES (?, ?)", token, deviceName)
	return err
}
