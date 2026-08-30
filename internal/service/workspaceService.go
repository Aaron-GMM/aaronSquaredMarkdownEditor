package service

import (
	"fmt"
	"path/filepath"

	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/domain"
	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/infra/filesystem"
)

type WorkspaceService struct {
	rootPath   string
	activeFile string
}

func NewWorkspaceService() *WorkspaceService {
	return &WorkspaceService{}
}

func (service *WorkspaceService) SetRootPath(rootPath string) {
	service.rootPath = rootPath
	service.activeFile = "" // reset active file when changing workspace
}

func (service *WorkspaceService) GetRootPath() string {
	return service.rootPath
}

func (service *WorkspaceService) SetActiveFile(path string) {
	service.activeFile = path
}

func (service *WorkspaceService) GetActiveFile() string {
	return service.activeFile
}

func (service *WorkspaceService) GetTree() (*domain.FileNode, error) {
	if service.rootPath == "" {
		return nil, fmt.Errorf("rootPath is empty")
	}
	return filesystem.ListDirectory(service.rootPath)
}

func (service *WorkspaceService) CreateFile(name string) error {
	if service.rootPath == "" {
		return fmt.Errorf("rootPath is empty")
	}
	fullPath := filepath.Join(service.rootPath, name)
	return filesystem.CreateFile(fullPath)
}

func (service *WorkspaceService) GetFile(name string) (*domain.FileNode, error) {
	if service.rootPath == "" {
		return nil, fmt.Errorf("rootPath is empty")
	}
	fullPath := filepath.Join(service.rootPath, name)
	return filesystem.ListDirectory(fullPath)
}

func (service *WorkspaceService) CreateFolder(name string) error {
	if service.rootPath == "" {
		return fmt.Errorf("rootPath is empty")
	}
	fullPath := filepath.Join(service.rootPath, name)
	return filesystem.CreateDirectory(fullPath)
}
