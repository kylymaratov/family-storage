package main

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

type MediaRecord struct {
	Filename string `json:"filename"`
	Hash     string `json:"hash"`
	Type     string `json:"type"`
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
		type TEXT NOT NULL
	);`

	if _, err = db.Exec(queryMedia); err != nil {
		return err
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
	rows, err := db.Query("SELECT filename, hash, type FROM media")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []MediaRecord
	for rows.Next() {
		var rec MediaRecord
		if err := rows.Scan(&rec.Filename, &rec.Hash, &rec.Type); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, nil
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

func SaveMediaRecord(filename string, hash string, mediaType string) error {
	_, err := db.Exec("INSERT INTO media (filename, hash, type) VALUES (?, ?, ?)", filename, hash, mediaType)
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
