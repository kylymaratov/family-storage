package routes

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"server/config"
	"server/middleware"
)

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, HEAD, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Upload-Offset, Upload-Length")
		w.Header().Set("Access-Control-Expose-Headers", "Upload-Offset, Upload-Length")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func Handler() {
	LoadSessions()
	StartJanitor()

	http.HandleFunc("/cloud/upload", enableCORS(middleware.RequireAuth(uploadHandler)))
	http.HandleFunc("/cloud/upload/init", enableCORS(middleware.RequireAuth(uploadInitHandler)))
	http.HandleFunc("/cloud/upload/", enableCORS(middleware.RequireAuth(uploadSessionHandler)))
	http.HandleFunc("/cloud/media", enableCORS(middleware.RequireAuth(getMediaHandler)))

	http.Handle("/cloud/photos/", http.StripPrefix("/cloud/photos/", http.FileServer(http.Dir(config.StorageDirPhotos))))
	http.Handle("/cloud/video/", http.StripPrefix("/cloud/video/", http.FileServer(http.Dir(config.StorageDirVideo))))

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
	addr := os.Getenv("FC_BIND") + ":" + port

	server := &http.Server{
		Addr:           addr,
		Handler:        http.DefaultServeMux,
		ReadTimeout:    60 * time.Minute,
		WriteTimeout:   60 * time.Minute,
		MaxHeaderBytes: 1 << 20,
	}

	displayAddr := addr
	if strings.HasPrefix(displayAddr, ":") {
		displayAddr = "0.0.0.0" + displayAddr
	}

	fmt.Printf("Sync server successfully started.\nStorage path: %s\nListening: http://%s\n", config.StorageDir, displayAddr)
	log.Fatal(server.ListenAndServe())
}
