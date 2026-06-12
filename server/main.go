package main

import (
	"log"

	"server/config"
	"server/db"
	"server/routes"
	"server/utils"
)

func main() {
	config.Load()

	if err := utils.ValidateStorageDir(config.StorageDir); err != nil {
		log.Fatalf("Storage root initialization failed: %v", err)
	}
	if err := utils.ValidateStorageDir(config.StorageDirVideo); err != nil {
		log.Fatalf("Video storage initialization failed: %v", err)
	}
	if err := utils.ValidateStorageDir(config.StorageDirPhotos); err != nil {
		log.Fatalf("Photos storage initialization failed: %v", err)
	}

	if err := db.InitDB(); err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}
	defer db.Close()

	if err := db.BackfillCreatedAt(); err != nil {
		log.Fatalf("created_at backfill failed: %v", err)
	}

	for _, device := range config.FamilyDevices {
		if err := db.AddToken(device.Token, device.DeviceName); err != nil {
			log.Printf("Warning: failed to add token for %s: %v", device.DeviceName, err)
		}
	}

	if err := utils.SyncStorageWithDB(); err != nil {
		log.Fatalf("Storage recovery scan failed: %v", err)
	}

	routes.Handler()
}
