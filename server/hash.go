package main

import (
	"crypto/md5"
	"encoding/hex"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"strconv"

	"github.com/corona10/goimagehash"
)

func CalculatePHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return "", err
	}

	hash, err := goimagehash.PerceptionHash(img)
	if err != nil {
		return "", err
	}

	return strconv.FormatUint(hash.GetHash(), 10), nil
}

func CalculateVideoHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := md5.New()

	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
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
