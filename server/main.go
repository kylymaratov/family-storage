package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

const StorageDir = "/media/andromeda/FamliyFiles"
const StorageDirVideo = "/media/andromeda/FamliyFiles/Videos"
const StorageDirPhotos = "/media/andromeda/FamliyFiles/Photos"

var photoExts = map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}
var videoExts = map[string]bool{".mp4": true, ".mov": true, ".mkv": true, ".avi": true, ".3gp": true}

func main() {
	if err := validateStorageDir(StorageDir); err != nil {
		log.Fatalf("Storage root initialization failed: %v", err)
	}
	if err := validateStorageDir(StorageDirVideo); err != nil {
		log.Fatalf("Video storage initialization failed: %v", err)
	}
	if err := validateStorageDir(StorageDirPhotos); err != nil {
		log.Fatalf("Photos storage initialization failed: %v", err)
	}

	if err := InitDB(); err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}
	defer db.Close()

	if err := syncStorageWithDB(); err != nil {
		log.Fatalf("Storage recovery scan failed: %v", err)
	}

	http.HandleFunc("/upload", uploadHandler)

	server := &http.Server{
		Addr:           ":8080",
		Handler:        http.DefaultServeMux,
		ReadTimeout:    60 * time.Minute,
		WriteTimeout:   60 * time.Minute,
		MaxHeaderBytes: 1 << 20,
	}

	fmt.Printf("Sync server successfully started.\nStorage path: %s\nPort: :8080\n", StorageDir)
	log.Fatal(server.ListenAndServe())
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 10*1024*1024*1024)

	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, "File size exceeds limit or invalid multipart form", http.StatusBadRequest)
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

	if photoExts[ext] {
		mediaType = "photo"
		targetDir = StorageDirPhotos
	} else if videoExts[ext] {
		mediaType = "video"
		targetDir = StorageDirVideo
	} else {
		http.Error(w, "Not allowed media format", http.StatusBadRequest)
		return
	}

	tempName := fmt.Sprintf("temp_%s%s", uuid.New().String(), ext)
	tempPath := filepath.Join(StorageDir, tempName)

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
		incomingHash, err = CalculatePHash(tempPath)
	} else {
		incomingHash, err = CalculateVideoHash(tempPath)
	}

	if err != nil {
		os.Remove(tempPath)
		http.Error(w, "Error processing file", http.StatusBadRequest)
		return
	}

	records, err := GetRecords()
	if err != nil {
		os.Remove(tempPath)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	for _, rec := range records {
		if rec.Type == mediaType {
			isDup := false
			if mediaType == "photo" {
				isDup = IsPhotoDuplicate(incomingHash, rec.Hash)
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

	if err := SaveMediaRecord(finalName, incomingHash, mediaType); err != nil {
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
