package routes

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"server/config"
	"server/crypto"
	"server/db"
	"server/utils"

	"github.com/google/uuid"
)

const (
	maxUploadSize   = 10 * 1024 * 1024 * 1024
	sessionTTL      = 24 * time.Hour
	janitorInterval = 30 * time.Minute
)

type uploadSession struct {
	mu          sync.Mutex
	id          string
	ext         string
	mediaType   string
	targetDir   string
	size        int64
	partPath    string
	fingerprint string
}

type sessionMeta struct {
	ID          string `json:"id"`
	Ext         string `json:"ext"`
	MediaType   string `json:"mediaType"`
	TargetDir   string `json:"targetDir"`
	Size        int64  `json:"size"`
	Fingerprint string `json:"fingerprint"`
}

var (
	sessionsMu   sync.Mutex
	sessions     = map[string]*uploadSession{}
	fingerprints = map[string]string{}
)

func uploadsDir() string {
	return filepath.Join(config.StorageDir, "uploads")
}

func metaPath(partPath string) string {
	return partPath + ".meta"
}

func writeMeta(s *uploadSession) {
	data, err := json.Marshal(sessionMeta{
		ID:          s.id,
		Ext:         s.ext,
		MediaType:   s.mediaType,
		TargetDir:   s.targetDir,
		Size:        s.size,
		Fingerprint: s.fingerprint,
	})
	if err != nil {
		return
	}
	os.WriteFile(metaPath(s.partPath), data, 0o644)
}

func LoadSessions() {
	entries, err := os.ReadDir(uploadsDir())
	if err != nil {
		return
	}
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".meta") {
			continue
		}
		mp := filepath.Join(uploadsDir(), e.Name())
		data, err := os.ReadFile(mp)
		if err != nil {
			continue
		}
		var m sessionMeta
		if json.Unmarshal(data, &m) != nil || m.ID == "" {
			os.Remove(mp)
			continue
		}
		partPath := strings.TrimSuffix(mp, ".meta")
		if _, err := os.Stat(partPath); err != nil {
			os.Remove(mp)
			continue
		}
		s := &uploadSession{
			id:          m.ID,
			ext:         m.Ext,
			mediaType:   m.MediaType,
			targetDir:   m.TargetDir,
			size:        m.Size,
			partPath:    partPath,
			fingerprint: m.Fingerprint,
		}
		sessions[m.ID] = s
		if m.Fingerprint != "" {
			fingerprints[m.Fingerprint] = m.ID
		}
	}
}

func StartJanitor() {
	go func() {
		ticker := time.NewTicker(janitorInterval)
		defer ticker.Stop()
		for range ticker.C {
			sweepStale()
		}
	}()
}

func sweepStale() {
	dir := uploadsDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	now := time.Now()
	for _, e := range entries {
		if e.IsDir() || strings.HasSuffix(e.Name(), ".meta") {
			continue
		}
		info, err := e.Info()
		if err != nil || now.Sub(info.ModTime()) <= sessionTTL {
			continue
		}
		path := filepath.Join(dir, e.Name())
		sessionsMu.Lock()
		var stale *uploadSession
		for _, s := range sessions {
			if s.partPath == path {
				stale = s
				break
			}
		}
		sessionsMu.Unlock()
		if stale != nil {
			cleanupSession(stale)
		} else {
			os.Remove(path)
			os.Remove(metaPath(path))
		}
	}
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".meta") {
			continue
		}
		mp := filepath.Join(dir, e.Name())
		if _, err := os.Stat(strings.TrimSuffix(mp, ".meta")); err != nil {
			os.Remove(mp)
		}
	}
}

func resolveMediaType(filename string) (mediaType, targetDir, ext string, ok bool) {
	ext = strings.ToLower(filepath.Ext(filename))
	if config.PhotoExts[ext] {
		return "photo", config.StorageDirPhotos, ext, true
	}
	if config.VideoExts[ext] {
		return "video", config.StorageDirVideo, ext, true
	}
	return "", "", ext, false
}

func currentSize(path string) int64 {
	info, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return info.Size()
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func dropSession(s *uploadSession) {
	sessionsMu.Lock()
	delete(sessions, s.id)
	if s.fingerprint != "" {
		delete(fingerprints, s.fingerprint)
	}
	sessionsMu.Unlock()
	os.Remove(metaPath(s.partPath))
}

func cleanupSession(s *uploadSession) {
	os.Remove(s.partPath)
	dropSession(s)
}

func moveFile(src, dst string) error {
	if err := os.Rename(src, dst); err == nil {
		return nil
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		os.Remove(dst)
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}
	os.Remove(src)
	return nil
}

func uploadInitHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Filename    string `json:"filename"`
		Size        int64  `json:"size"`
		Fingerprint string `json:"fingerprint"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Filename == "" || req.Size <= 0 {
		http.Error(w, "Invalid form", http.StatusBadRequest)
		return
	}
	if req.Size > maxUploadSize {
		http.Error(w, "File size exceeds limit or invalid form", http.StatusBadRequest)
		return
	}

	mediaType, targetDir, ext, ok := resolveMediaType(req.Filename)
	if !ok {
		http.Error(w, "Not allowed media format", http.StatusBadRequest)
		return
	}

	sessionsMu.Lock()
	if req.Fingerprint != "" {
		if id, exists := fingerprints[req.Fingerprint]; exists {
			if s, alive := sessions[id]; alive {
				sessionsMu.Unlock()
				writeJSON(w, http.StatusOK, map[string]any{
					"uploadId": s.id,
					"offset":   currentSize(s.partPath),
				})
				return
			}
		}
	}

	if err := os.MkdirAll(uploadsDir(), 0o755); err != nil {
		sessionsMu.Unlock()
		http.Error(w, "Error creating temporary file", http.StatusInternalServerError)
		return
	}

	id := uuid.New().String()
	partPath := filepath.Join(uploadsDir(), "part_"+id+ext)
	f, err := os.Create(partPath)
	if err != nil {
		sessionsMu.Unlock()
		http.Error(w, "Error creating temporary file", http.StatusInternalServerError)
		return
	}
	f.Close()

	s := &uploadSession{
		id:          id,
		ext:         ext,
		mediaType:   mediaType,
		targetDir:   targetDir,
		size:        req.Size,
		partPath:    partPath,
		fingerprint: req.Fingerprint,
	}
	sessions[id] = s
	if req.Fingerprint != "" {
		fingerprints[req.Fingerprint] = id
	}
	sessionsMu.Unlock()

	writeMeta(s)
	writeJSON(w, http.StatusOK, map[string]any{"uploadId": id, "offset": int64(0)})
}

func uploadSessionHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/cloud/upload/")
	if id == "" || strings.Contains(id, "/") {
		http.Error(w, "Invalid upload id", http.StatusBadRequest)
		return
	}

	sessionsMu.Lock()
	s := sessions[id]
	sessionsMu.Unlock()
	if s == nil {
		http.Error(w, "Upload session not found", http.StatusNotFound)
		return
	}

	switch r.Method {
	case http.MethodHead:
		w.Header().Set("Upload-Offset", strconv.FormatInt(currentSize(s.partPath), 10))
		w.Header().Set("Upload-Length", strconv.FormatInt(s.size, 10))
		w.WriteHeader(http.StatusOK)
	case http.MethodPatch:
		handleChunk(w, r, s)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleChunk(w http.ResponseWriter, r *http.Request, s *uploadSession) {
	s.mu.Lock()
	defer s.mu.Unlock()

	current := currentSize(s.partPath)
	offset, err := strconv.ParseInt(r.Header.Get("Upload-Offset"), 10, 64)
	if err != nil || offset < 0 {
		http.Error(w, "Invalid offset", http.StatusBadRequest)
		return
	}
	if offset != current {
		w.Header().Set("Upload-Offset", strconv.FormatInt(current, 10))
		http.Error(w, "Offset mismatch", http.StatusPreconditionFailed)
		return
	}

	if current >= s.size {
		finalizeChunkedUpload(w, s)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, s.size-current)
	f, err := os.OpenFile(s.partPath, os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		http.Error(w, "Error writing to hard drive", http.StatusInternalServerError)
		return
	}
	n, copyErr := io.Copy(f, r.Body)
	f.Close()
	if copyErr != nil && n == 0 {
		http.Error(w, "Error writing to hard drive", http.StatusInternalServerError)
		return
	}

	if current+n >= s.size {
		finalizeChunkedUpload(w, s)
		return
	}

	w.Header().Set("Upload-Offset", strconv.FormatInt(current+n, 10))
	w.WriteHeader(http.StatusNoContent)
}

func finalizeChunkedUpload(w http.ResponseWriter, s *uploadSession) {
	var hash string
	var err error
	if s.mediaType == "photo" {
		hash, err = crypto.CalculatePHash(s.partPath)
	} else {
		hash, err = crypto.CalculateVideoHash(s.partPath)
	}
	if err != nil {
		cleanupSession(s)
		http.Error(w, "Error processing file", http.StatusBadRequest)
		return
	}

	records, err := db.GetRecords()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	for _, rec := range records {
		if rec.Type != s.mediaType {
			continue
		}
		dup := false
		if s.mediaType == "photo" {
			dup = utils.IsPhotoDuplicate(hash, rec.Hash)
		} else {
			dup = hash == rec.Hash
		}
		if dup {
			cleanupSession(s)
			writeJSON(w, http.StatusConflict, map[string]string{
				"message":  "Duplicate detected",
				"type":     s.mediaType,
				"existing": rec.Filename,
			})
			return
		}
	}

	finalName := uuid.New().String() + s.ext
	finalPath := filepath.Join(s.targetDir, finalName)
	if err := moveFile(s.partPath, finalPath); err != nil {
		http.Error(w, "File save error", http.StatusInternalServerError)
		return
	}
	if err := db.SaveMediaRecord(finalName, hash, s.mediaType, time.Now().Unix()); err != nil {
		os.Remove(finalPath)
		http.Error(w, "Error writing to database", http.StatusInternalServerError)
		return
	}

	dropSession(s)
	writeJSON(w, http.StatusCreated, map[string]string{
		"message":  "Successfully synced",
		"type":     s.mediaType,
		"filename": finalName,
	})
}
