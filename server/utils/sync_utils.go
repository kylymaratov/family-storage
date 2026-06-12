package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"server/config"
	"server/crypto"
	"server/db"
)

func SyncStorageWithDB() error {
	fmt.Println("Starting bootstrap storage scan...")

	trackedFiles, err := db.GetExistingFilesMap()

	if err != nil {
		return fmt.Errorf("failed to get tracked files from DB: %w", err)
	}

	targets := []struct {
		dir       string
		mediaType string
	}{
		{config.StorageDirPhotos, "photo"},
		{config.StorageDirVideo, "video"},
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
			if target.mediaType == "photo" && config.PhotoExts[ext] {
				incomingHash, err = crypto.CalculatePHash(filePath)
			} else if target.mediaType == "video" && config.VideoExts[ext] {
				incomingHash, err = crypto.CalculateVideoHash(filePath)
			} else {
				fmt.Printf("Skipping untracked file with unknown extension: %s\n", filename)
				continue
			}

			if err != nil {
				fmt.Printf("Failed to process untracked file %s: %v\n", filename, err)
				continue
			}

			createdAt := int64(0)
			if info, ierr := f.Info(); ierr == nil {
				createdAt = info.ModTime().Unix()
			}

			if err := db.SaveMediaRecord(filename, incomingHash, target.mediaType, createdAt); err != nil {
				return fmt.Errorf("failed to write recovered file %s to DB: %w", filename, err)
			}

			newFilesIndexed++
			fmt.Printf("Successfully indexed: %s\n", filename)
		}
	}

	fmt.Printf("Bootstrap scan completed. Newly indexed files: %d\n", newFilesIndexed)
	return nil
}
