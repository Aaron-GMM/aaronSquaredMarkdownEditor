package app

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/domain"
	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/infra/filesystem"
	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/infra/ia"
	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/infra/terminal"
	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/service"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx        context.Context
	shell      *terminal.ShellSession
	aiProvider domain.AIProvider
	workspace  *service.WorkspaceService
	config     *service.ConfigService
	indexer    *service.IndexingService
}

func NewApp() *App {
	ws := service.NewWorkspaceService()
	return &App{
		aiProvider: IA.NewGroqClient(), // FIXED IA capitalization
		workspace:  ws,
		config:     service.NewConfigService(),
		indexer:    service.NewIndexingService(ws),
	}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) OpenWorkspace() (*domain.FileNode, error) {
	folder, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Selecionar Pasta do Projeto",
	})
	if err != nil || folder == "" {
		return nil, err
	}
	a.workspace.SetRootPath(folder)
	return a.workspace.GetTree()
}

func (a *App) RefreshWorkspace() (*domain.FileNode, error) {
	return a.workspace.GetTree()
}

func (a *App) CreateFileInWorkspace(name string) (*domain.FileNode, error) {
	if err := a.workspace.CreateFile(name); err != nil {
		return nil, err
	}
	return a.workspace.GetTree()
}

func (a *App) CreateFolderInWorkspace(name string) (*domain.FileNode, error) {
	if err := a.workspace.CreateFolder(name); err != nil {
		return nil, err
	}
	return a.workspace.GetTree()
}

func (a *App) DeleteNode(path string) (*domain.FileNode, error) {
	if err := filesystem.DeleteNode(path); err != nil {
		return nil, err
	}
	return a.workspace.GetTree()
}

func (a *App) RenameNode(oldPath, newName string) (*domain.FileNode, error) {
	newPath := filepath.Join(filepath.Dir(oldPath), newName)
	if err := filesystem.RenameNode(oldPath, newPath); err != nil {
		return nil, err
	}
	return a.workspace.GetTree()
}

func (a *App) GetDirectory(path string) (*domain.FileNode, error) {
	return filesystem.ListDirectory(path)
}

func (a *App) OpenNote(path string) (*domain.Note, error) {
	a.workspace.SetActiveFile(path)
	return filesystem.ReadMarkdownFile(path)
}

func (a *App) SaveNote(content string) error {
	path := a.workspace.GetActiveFile()
	if path == "" {
		return fmt.Errorf("nenhum arquivo ativo no workspace")
	}
	return filesystem.SaveFile(path, content)
}

func (a *App) SelectFolder() (string, error) {
	folder, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Selecionar Pasta de Notas",
	})
	if err != nil {
		return "", err
	}
	a.workspace.SetRootPath(folder)
	return folder, nil
}

func (a *App) SaveImage(name string, base64Data string) (string, error) {
	path := a.workspace.GetRootPath()
	if path == "" {
		return "", fmt.Errorf("nenhum workspace aberto")
	}
	fullPath := filepath.Join(path, name)
	if err := filesystem.SaveImage(fullPath, base64Data); err != nil {
		return "", err
	}
	return fullPath, nil
}

func (a *App) ImportImage() (string, error) {
	workspacePath := a.workspace.GetRootPath()
	if workspacePath == "" {
		return "", fmt.Errorf("nenhum workspace aberto")
	}

	selectedFile, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Selecionar Imagem",
		Filters: []runtime.FileFilter{
			{DisplayName: "Imagens (*.png;*.jpg;*.jpeg;*.gif;*.svg)", Pattern: "*.png;*.jpg;*.jpeg;*.gif;*.svg"},
		},
	})
	if err != nil || selectedFile == "" {
		return "", err
	}

	return filesystem.CopyImageToWorkspace(selectedFile, workspacePath)
}

func (a *App) SaveImageWithPath(path string, base64Data string) error {
	return filesystem.SaveImage(path, base64Data)
}

func (a *App) ReadImageBase64(path string) (string, error) {
	return filesystem.ReadImageBase64(path)
}

func (a *App) StartTerminal() error {
	if a.shell != nil {
		a.shell.Close()
	}

	session, err := terminal.NewShellSession(a.ctx)
	if err != nil {
		return fmt.Errorf("falha ao iniciar terminal: %v", err)
	}

	a.shell = session
	return nil
}

func (a *App) WriteTerminal(input string) error {
	if a.shell == nil {
		return fmt.Errorf("terminal não está rodando")
	}
	return a.shell.Write(input)
}

func (a *App) StopTerminal() error {
	if a.shell != nil {
		return a.shell.Close()
	}
	return nil
}

func (a *App) GenerateAIContent(prompt string) (string, error) {
	apiKey := a.config.GetGroqAPIKey()
	if apiKey == "" {
		return "", fmt.Errorf("chave de API não configurada")
	}
	return a.aiProvider.GenerateMarkdown(a.ctx, apiKey, prompt)
}

func (a *App) GetGroqAPIKey() string {
	return a.config.GetGroqAPIKey()
}

func (a *App) SetGroqAPIKey(key string) error {
	return a.config.SetGroqAPIKey(key)
}

func (a *App) SearchVault(query string) ([]domain.FileNode, error) {
	return a.indexer.Search(query)
}

func (a *App) GetBacklinks(targetFilePath string) ([]domain.FileNode, error) {
	return a.indexer.GetBacklinks(targetFilePath)
}
