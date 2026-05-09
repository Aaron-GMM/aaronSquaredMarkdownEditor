package app

import (
	"context"

	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/domain"
	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/infra/filesystem"
	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/infra/terminal"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp cria uma nova instância da aplicação
func NewApp() *App {
	return &App{}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// GetDirectory expõe a listagem de arquivos para o JS
func (a *App) GetDirectory(path string) (*domain.FileNode, error) {
	return filesystem.ListDirectory(path)
}

// OpenNote expõe a leitura de um arquivo .md para o JS
func (a *App) OpenNote(path string) (*domain.Note, error) {
	return filesystem.ReadMarkdownFile(path)
}

// SaveNote expõe a função de salvar para o JS
func (a *App) SaveNote(path string, content string) error {
	return filesystem.SaveFile(path, content)
}

// CreateFile instrui o SO a criar um arquivo
func (a *App) CreateFile(path string) error {
	return filesystem.CreateFile(path)
}

// CreateDirectory instrui o SO a criar uma pasta
func (a *App) CreateDirectory(path string) error {
	return filesystem.CreateDirectory(path)
}

// DeleteNode remove um item do disco
func (a *App) DeleteNode(path string) error {
	return filesystem.DeleteNode(path)
}

// RenameNode altera o nome ou caminho de um item
func (a *App) RenameNode(oldPath, newPath string) error {
	return filesystem.RenameNode(oldPath, newPath)
}
func (a *App) ExecuteTerminalCommand(command string) (string, error) {
	shell := &terminal.ShellManager{Ctx: a.ctx}
	return shell.ExecuteCommand(command)
}
