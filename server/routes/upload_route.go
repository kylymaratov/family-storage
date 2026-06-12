package routes

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"server/config"
	"server/crypto"
	"server/db"
	"server/utils"

	"github.com/google/uuid"
)

func getMediaHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	records, err := db.GetRecords()
	if err != nil {
		http.Error(w, "Database internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(records)
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 10*1024*1024*1024)
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, "File size exceeds limit or invalid form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("media")
	if err != nil {
		http.Error(w, "Error reading file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	var mediaType string
	var targetDir string

	if config.PhotoExts[ext] {
		mediaType = "photo"
		targetDir = config.StorageDirPhotos
	} else if config.VideoExts[ext] {
		mediaType = "video"
		targetDir = config.StorageDirVideo
	} else {
		http.Error(w, "Not allowed media format", http.StatusBadRequest)
		return
	}

	tempName := fmt.Sprintf("temp_%s%s", uuid.New().String(), ext)
	tempPath := filepath.Join(targetDir, tempName)

	tempFile, err := os.Create(tempPath)
	if err != nil {
		http.Error(w, "Error creating temporary file", http.StatusInternalServerError)
		return
	}

	if _, err := io.Copy(tempFile, file); err != nil {
		tempFile.Close()
		os.Remove(tempPath)
		http.Error(w, "Error writing to hard drive", http.StatusInternalServerError)
		return
	}
	tempFile.Close()

	var incomingHash string
	if mediaType == "photo" {
		incomingHash, err = crypto.CalculatePHash(tempPath)
	} else {
		incomingHash, err = crypto.CalculateVideoHash(tempPath)
	}
	if err != nil {
		os.Remove(tempPath)
		http.Error(w, "Error processing file", http.StatusBadRequest)
		return
	}

	records, err := db.GetRecords()
	if err != nil {
		os.Remove(tempPath)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	for _, rec := range records {
		if rec.Type == mediaType {
			isDup := false
			if mediaType == "photo" {
				isDup = utils.IsPhotoDuplicate(incomingHash, rec.Hash)
			} else {
				isDup = (incomingHash == rec.Hash)
			}
			if isDup {
				os.Remove(tempPath)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusConflict)
				json.NewEncoder(w).Encode(map[string]string{
					"message":  "Duplicate detected",
					"type":     mediaType,
					"existing": rec.Filename,
				})
				return
			}
		}
	}

	finalName := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	finalPath := filepath.Join(targetDir, finalName)

	if err := os.Rename(tempPath, finalPath); err != nil {
		os.Remove(tempPath)
		http.Error(w, "File save error", http.StatusInternalServerError)
		return
	}

	if err := db.SaveMediaRecord(finalName, incomingHash, mediaType, time.Now().Unix()); err != nil {
		os.Remove(finalPath)
		http.Error(w, "Error writing to database", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message":  "Successfully synced",
		"type":     mediaType,
		"filename": finalName,
	})
}
