package app

import (
	"context"

	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/domain"
	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/infra/filesystem"
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
