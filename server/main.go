package main

import (
	"fmt"
	"log"
	"net/http"

	"time"
)

const StorageDir = "/media/andromeda/FamilyStorage"
const StorageDirVideo = "/media/andromeda/FamilyStorage/Video"
const StorageDirPhotos = "/media/andromeda/FamilyStorage/Photos"

var photoExts = map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}
var videoExts = map[string]bool{".mp4": true, ".mov": true, ".mkv": true, ".avi": true, ".3gp": true}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

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

	http.HandleFunc("/api/upload", enableCORS(uploadHandler))
	http.HandleFunc("/api/media", enableCORS(getMediaHandler))

	http.Handle("/content/photos/", http.StripPrefix("/content/photos/", http.FileServer(http.Dir(StorageDirPhotos))))
	http.Handle("/content/video/", http.StripPrefix("/content/video/", http.FileServer(http.Dir(StorageDirVideo))))

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
