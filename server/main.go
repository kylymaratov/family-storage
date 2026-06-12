package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type InitialDevice struct {
	Token      string
	DeviceName string
}

const StorageDir = "/media/andromeda/FamliyFiles"
const StorageDirVideo = "/media/andromeda/FamliyFiles/Videos"
const StorageDirPhotos = "/media/andromeda/FamliyFiles/Photos"

var familyDevices = []InitialDevice{
	{Token: "SF13S2CTX6k1vK^nPGaNWcNslNT3D3aF4Qf1oj%Py$4=", DeviceName: "Me"},
	{Token: "V+9nl6M8f9Y5q^bsZT5ZhPl@4i%Q%QwwofcePL5Dzv4=", DeviceName: "Baiel"},
}

var photoExts = map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}
var videoExts = map[string]bool{".mp4": true, ".mov": true, ".mkv": true, ".avi": true, ".3gp": true}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

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

	if err := BackfillCreatedAt(); err != nil {
		log.Fatalf("created_at backfill failed: %v", err)
	}

	for _, device := range familyDevices {
		if err := AddToken(device.Token, device.DeviceName); err != nil {
			log.Printf("Warning: failed to add token for %s: %v", device.DeviceName, err)
		}
	}

	if err := syncStorageWithDB(); err != nil {
		log.Fatalf("Storage recovery scan failed: %v", err)
	}

	http.HandleFunc("/api/upload", enableCORS(requireAuth(uploadHandler)))
	http.HandleFunc("/api/media", enableCORS(requireAuth(getMediaHandler)))

	http.Handle("/content/photos/", http.StripPrefix("/content/photos/", http.FileServer(http.Dir(StorageDirPhotos))))
	http.Handle("/content/video/", http.StripPrefix("/content/video/", http.FileServer(http.Dir(StorageDirVideo))))

	serveCA := func(filename string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/x-x509-ca-cert")
			w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
			http.ServeFile(w, r, "certs/ca.pem")
		}
	}
	http.HandleFunc("/ca.pem", serveCA("family-cloud-ca.pem"))
	http.HandleFunc("/ca.crt", serveCA("family-cloud-ca.crt"))

	webAppDir := os.Getenv("WEBAPP_DIR")
	if webAppDir == "" {
		webAppDir = "../webapp/dist"
	}
	indexPath := filepath.Join(webAppDir, "index.html")
	webFiles := http.FileServer(http.Dir(webAppDir))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		requested := filepath.Join(webAppDir, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(requested); err == nil && !info.IsDir() {
			webFiles.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, indexPath)
	})

	port := os.Getenv("FC_PORT")
	if port == "" {
		port = "48080"
	}
	addr := ":" + port

	server := &http.Server{
		Addr:           addr,
		Handler:        http.DefaultServeMux,
		ReadTimeout:    60 * time.Minute,
		WriteTimeout:   60 * time.Minute,
		MaxHeaderBytes: 1 << 20,
	}

	certFile := os.Getenv("FC_TLS_CERT")
	keyFile := os.Getenv("FC_TLS_KEY")
	if certFile == "" && keyFile == "" {
		if _, err := os.Stat("certs/server-cert.pem"); err == nil {
			certFile = "certs/server-cert.pem"
			keyFile = "certs/server-key.pem"
		}
	}

	if certFile != "" && keyFile != "" {
		fmt.Printf("Sync server successfully started.\nStorage path: %s\nListening: https://0.0.0.0%s\n", StorageDir, addr)
		log.Fatal(server.ListenAndServeTLS(certFile, keyFile))
	}

	fmt.Printf("Sync server successfully started.\nStorage path: %s\nListening: http://0.0.0.0%s\n", StorageDir, addr)
	log.Fatal(server.ListenAndServe())
}
