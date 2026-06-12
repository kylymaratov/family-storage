package routes

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"server/config"
	"server/middleware"
)

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

func Handler() {
	http.HandleFunc("/api/upload", enableCORS(middleware.RequireAuth(uploadHandler)))
	http.HandleFunc("/api/media", enableCORS(middleware.RequireAuth(getMediaHandler)))

	http.Handle("/content/photos/", http.StripPrefix("/content/photos/", http.FileServer(http.Dir(config.StorageDirPhotos))))
	http.Handle("/content/video/", http.StripPrefix("/content/video/", http.FileServer(http.Dir(config.StorageDirVideo))))

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
		fmt.Printf("Sync server successfully started.\nStorage path: %s\nListening: https://0.0.0.0%s\n", config.StorageDir, addr)
		log.Fatal(server.ListenAndServeTLS(certFile, keyFile))
	}

	fmt.Printf("Sync server successfully started.\nStorage path: %s\nListening: http://0.0.0.0%s\n", config.StorageDir, addr)
	log.Fatal(server.ListenAndServe())
}
