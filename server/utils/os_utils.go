package utils

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"

	"github.com/corona10/goimagehash"
)

func ValidateStorageDir(dir string) error {
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

func MoveFile(src, dst string) error {
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

func IsPhotoDuplicate(hashStr1, hashStr2 string) bool {
	h1Uint, _ := strconv.ParseUint(hashStr1, 10, 64)
	h2Uint, _ := strconv.ParseUint(hashStr2, 10, 64)

	h1 := goimagehash.NewImageHash(h1Uint, goimagehash.PHash)
	h2 := goimagehash.NewImageHash(h2Uint, goimagehash.PHash)

	distance, err := h1.Distance(h2)
	if err != nil {
		return false
	}
	return distance <= 5
}
