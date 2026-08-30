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
	openFiles  []string
}

func NewWorkspaceService() *WorkspaceService {
	return &WorkspaceService{
		openFiles: make([]string, 0),
	}
}

func (service *WorkspaceService) SetRootPath(rootPath string) {
	service.rootPath = rootPath
	service.activeFile = ""
	service.openFiles = make([]string, 0)
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

func (service *WorkspaceService) OpenTab(path string) {
	// Add if not exists
	found := false
	for _, p := range service.openFiles {
		if p == path {
			found = true
			break
		}
	}
	if !found {
		service.openFiles = append(service.openFiles, path)
	}
	service.activeFile = path
}

func (service *WorkspaceService) CloseTab(path string) {
	for i, p := range service.openFiles {
		if p == path {
			service.openFiles = append(service.openFiles[:i], service.openFiles[i+1:]...)
			break
		}
	}
	// Adjust active file if closed
	if service.activeFile == path {
		if len(service.openFiles) > 0 {
			service.activeFile = service.openFiles[len(service.openFiles)-1]
		} else {
			service.activeFile = ""
		}
	}
}

func (service *WorkspaceService) GetOpenTabs() []string {
	return service.openFiles
}
