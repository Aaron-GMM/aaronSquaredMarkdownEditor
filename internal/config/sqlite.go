package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// IndexNode representa o modelo de tabela no banco para os arquivos
type IndexNode struct {
	Path    string `gorm:"primaryKey"`
	Name    string
	Content string
}

func InitializeSQLite(workspaceRoot string) (*gorm.DB, error) {
	if workspaceRoot == "" {
		return nil, fmt.Errorf("caminho do workspace não pode ser vazio")
	}

	aaronDir := filepath.Join(workspaceRoot, ".aaron")
	dbPath := filepath.Join(aaronDir, "index.db")

	if _, err := os.Stat(aaronDir); os.IsNotExist(err) {
		fmt.Println("Pasta .aaron não existe, criando...")
		err = os.MkdirAll(aaronDir, 0755)
		if err != nil {
			return nil, err
		}
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// Automigrate table (não precisa de SQL manual)
	err = db.AutoMigrate(&IndexNode{})
	if err != nil {
		return nil, err
	}

	return db, nil
}
