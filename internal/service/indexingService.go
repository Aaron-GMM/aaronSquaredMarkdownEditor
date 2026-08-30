package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/domain"
)

type IndexingService struct {
	workspace *WorkspaceService
}

func NewIndexingService(ws *WorkspaceService) *IndexingService {
	return &IndexingService{workspace: ws}
}

func (s *IndexingService) Search(query string) ([]domain.FileNode, error) {
	root := s.workspace.GetRootPath()
	if root == "" {
		return nil, fmt.Errorf("nenhum workspace aberto")
	}

	var results []domain.FileNode
	queryLower := strings.ToLower(query)

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		
		// Skip hidden folders and git
		if info.IsDir() && strings.HasPrefix(info.Name(), ".") {
			return filepath.SkipDir
		}

		if !info.IsDir() && filepath.Ext(info.Name()) == ".md" {
			if strings.Contains(strings.ToLower(info.Name()), queryLower) {
				results = append(results, domain.FileNode{
					Name:      info.Name(),
					Path:      path,
					IsDir:     false,
					Extension: ".md",
				})
			} else {
				// optionally search file content
				content, err := os.ReadFile(path)
				if err == nil && strings.Contains(strings.ToLower(string(content)), queryLower) {
					results = append(results, domain.FileNode{
						Name:      info.Name(),
						Path:      path,
						IsDir:     false,
						Extension: ".md",
					})
				}
			}
		}
		return nil
	})

	return results, err
}
