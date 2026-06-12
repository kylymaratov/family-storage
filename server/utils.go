package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func validateStorageDir(dir string) error {
	info, err := os.Stat(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("directory does not exist: %s", dir)
		}
		return fmt.Errorf("failed to access directory: %w", err)
	}

	if !info.IsDir() {
		return fmt.Errorf("path exists but it is not a directory: %s", dir)
	}

	testFile := filepath.Join(dir, ".write_test")
	file, err := os.Create(testFile)
	if err != nil {
		return fmt.Errorf("directory is read-only or permission denied: %w", err)
	}
	file.Close()
	os.Remove(testFile)

	return nil
}

func syncStorageWithDB() error {
	fmt.Println("Starting bootstrap storage scan...")

	trackedFiles, err := GetExistingFilesMap()
	if err != nil {
		return fmt.Errorf("failed to get tracked files from DB: %w", err)
	}

	targets := []struct {
		dir       string
		mediaType string
	}{
		{StorageDirPhotos, "photo"},
		{StorageDirVideo, "video"},
	}

	var newFilesIndexed int

	for _, target := range targets {
		files, err := os.ReadDir(target.dir)
		if err != nil {
			return fmt.Errorf("failed to read directory %s: %w", target.dir, err)
		}

		for _, f := range files {
			if f.IsDir() || strings.HasPrefix(f.Name(), ".") {
				continue
			}

			filename := f.Name()

			if trackedFiles[filename] {
				continue
			}

			ext := strings.ToLower(filepath.Ext(filename))
			filePath := filepath.Join(target.dir, filename)

			fmt.Printf("Found untracked file: %s/%s. Calculating hash...\n", target.mediaType, filename)

			var incomingHash string
			if target.mediaType == "photo" && photoExts[ext] {
				incomingHash, err = CalculatePHash(filePath)
			} else if target.mediaType == "video" && videoExts[ext] {
				incomingHash, err = CalculateVideoHash(filePath)
			} else {
				fmt.Printf("Skipping untracked file with unknown extension: %s\n", filename)
				continue
			}

			if err != nil {
				fmt.Printf("WARNING: Failed to process untracked file %s: %v\n", filename, err)
				continue
			}

			createdAt := int64(0)
			if info, ierr := f.Info(); ierr == nil {
				createdAt = info.ModTime().Unix()
			}

			if err := SaveMediaRecord(filename, incomingHash, target.mediaType, createdAt); err != nil {
				return fmt.Errorf("failed to write recovered file %s to DB: %w", filename, err)
			}

			newFilesIndexed++
			fmt.Printf("Successfully indexed: %s\n", filename)
		}
	}

	fmt.Printf("Bootstrap scan completed. Newly indexed files: %d\n", newFilesIndexed)
	return nil
}

func getMediaHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	records, err := GetRecords()
	if err != nil {
		http.Error(w, "Database internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(records)
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
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		os.Remove(dst)
		return err
	}
	if err := out.Sync(); err != nil {
		os.Remove(dst)
		return err
	}
	in.Close()
	return os.Remove(src)
}
