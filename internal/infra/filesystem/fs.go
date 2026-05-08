package filesystem

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/domain"
)

// ListDirectory lê um diretório de forma rasa (não recursiva imediatamente para poupar memória)
// A recursividade total pode ser implementada sob demanda via frontend ou aprofundada aqui.
func ListDirectory(rootPath string) (*domain.FileNode, error) {
	info, err := os.Stat(rootPath)
	if err != nil {
		return nil, err
	}

	rootNode := &domain.FileNode{
		Name:  info.Name(),
		Path:  rootPath,
		IsDir: true,
	}

	entries, err := os.ReadDir(rootPath)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		childPath := filepath.Join(rootPath, entry.Name())
		childNode := &domain.FileNode{
			Name:      entry.Name(),
			Path:      childPath,
			IsDir:     entry.IsDir(),
			Extension: strings.ToLower(filepath.Ext(entry.Name())),
		}
		// Filtro simples: ignorar pastas ocultas como .git
		if !strings.HasPrefix(entry.Name(), ".") {
			rootNode.Children = append(rootNode.Children, childNode)
		}
	}

	return rootNode, nil
}

// ReadMarkdownFile lê o arquivo, garantindo que seja um .md
func ReadMarkdownFile(path string) (*domain.Note, error) {
	if strings.ToLower(filepath.Ext(path)) != ".md" {
		return nil, errors.New("formato de arquivo não suportado: apenas .md é permitido")
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	return &domain.Note{
		Path:    path,
		Content: string(content),
	}, nil
}

// SaveFile escreve o conteúdo em UTF-8 no disco
func SaveFile(path string, content string) error {
	// Permissão 0644: Leitura/Escrita pro dono, apenas leitura pros outros
	return os.WriteFile(path, []byte(content), 0644)
}
