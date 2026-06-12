package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type InitialDevice struct {
	Token      string
	DeviceName string
}

var (
	StorageDir       string
	StorageDirVideo  string
	StorageDirPhotos string
)

var FamilyDevices = []InitialDevice{
	{Token: "SF13S2CTX6k1vK^nPGaNWcNslNT3D3aF4Qf1oj%Py$4=", DeviceName: "Me"},
	{Token: "V+9nl6M8f9Y5q^bsZT5ZhPl@4i%Q%QwwofcePL5Dzv4=", DeviceName: "Baiel"},
}

var PhotoExts = map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}
var VideoExts = map[string]bool{".mp4": true, ".mov": true, ".mkv": true, ".avi": true, ".3gp": true}

func Load() {
	loadDotEnv(".env")

	StorageDir = getEnv("STORAGE_DIR", "/media/andromeda/FamliyFiles")
	StorageDirPhotos = getEnv("STORAGE_PHOTOS_DIR", "/media/andromeda/FamliyFiles/Photos")
	StorageDirVideo = getEnv("STORAGE_VIDEOS_DIR", "/media/andromeda/FamliyFiles/Videos")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		if !os.IsNotExist(err) {
			fmt.Printf("Warning: failed to read %s: %v\n", path, err)
		}
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
}
