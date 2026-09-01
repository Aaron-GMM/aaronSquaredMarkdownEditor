package config

import (
	"gorm.io/gorm"
)

var (
	db *gorm.DB
)

func Init(workspaceRoot string) error {
	var err error
	db, err = InitializeSQLite(workspaceRoot)
	if err != nil {
		return err
	}
	return nil
}

func GetDB() *gorm.DB {
	return db
}
