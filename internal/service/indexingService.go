package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/config"
	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/domain"
)

type IndexingService struct {
	workspace *WorkspaceService
}

func NewIndexingService(ws *WorkspaceService) *IndexingService {
	return &IndexingService{workspace: ws}
}

// StartBackgroundIndexing varre os arquivos md do disco e os salva no SQLite silenciosamente
func (s *IndexingService) StartBackgroundIndexing() {
	root := s.workspace.GetRootPath()
	if root == "" {
		return
	}

	db := config.GetDB()
	if db == nil {
		return
	}

	go func() {
		filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			
			// Ignora pastas ocultas (como .git ou .aaron)
			if info.IsDir() && strings.HasPrefix(info.Name(), ".") {
				return filepath.SkipDir
			}

			if !info.IsDir() && filepath.Ext(info.Name()) == ".md" {
				content, err := os.ReadFile(path)
				if err == nil {
					// Salva ou atualiza a nota na tabela IndexNode
					node := config.IndexNode{
						Path:    path,
						Name:    info.Name(),
						Content: string(content),
					}
					db.Save(&node)
				}
			}
			return nil
		})
	}()
}

// Search agora usa consulta SQL ao invés de ler todo o HD!
func (s *IndexingService) Search(query string) ([]domain.FileNode, error) {
	db := config.GetDB()
	if db == nil {
		return nil, fmt.Errorf("banco de dados não inicializado")
	}

	var nodes []config.IndexNode
	searchQuery := "%" + query + "%"

	// Busca rápida usando LIKE nativo do SQLite
	db.Where("name LIKE ? OR content LIKE ?", searchQuery, searchQuery).Find(&nodes)

	var results []domain.FileNode
	for _, n := range nodes {
		results = append(results, domain.FileNode{
			Name:      n.Name,
			Path:      n.Path,
			IsDir:     false,
			Extension: ".md",
		})
	}
	return results, nil
}

// GetBacklinks também usa SQLite para achar referências na velocidade da luz
func (s *IndexingService) GetBacklinks(targetFilePath string) ([]domain.FileNode, error) {
	db := config.GetDB()
	if db == nil {
		return nil, fmt.Errorf("banco de dados não inicializado")
	}

	baseName := strings.TrimSuffix(filepath.Base(targetFilePath), ".md")
	linkPattern := "%[[" + baseName + "]]%"

	var nodes []config.IndexNode
	// Onde o conteúdo tiver o link, MAS não for ele mesmo referenciando a si mesmo
	db.Where("content LIKE ? AND path != ?", linkPattern, targetFilePath).Find(&nodes)

	var results []domain.FileNode
	for _, n := range nodes {
		results = append(results, domain.FileNode{
			Name:      n.Name,
			Path:      n.Path,
			IsDir:     false,
			Extension: ".md",
		})
	}
	return results, nil
}
