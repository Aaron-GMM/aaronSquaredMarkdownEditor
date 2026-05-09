package filesystem

import (
	"encoding/base64" // Adicione isto aos seus imports no topo do ficheiro, junto com "os", etc.
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/Aaron-GMM/aaronSquaredMarkdownEditor/internal/domain"
)

func SaveImage(path string, base64Data string) error {
	// Decodifica a string base64 para um array de bytes
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return err
	}

	// Salva o arquivo com permissões padrão
	return os.WriteFile(path, data, 0644)
}
func ReadImageBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	// Codifica os bytes puros para uma string base64
	return base64.StdEncoding.EncodeToString(data), nil
}

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

// CreateFile cria um novo arquivo em branco.
func CreateFile(path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	return nil
}

// CreateDirectory cria uma nova pasta.
func CreateDirectory(path string) error {
	// Permissão 0755: Leitura e execução para todos, escrita apenas para o dono
	return os.MkdirAll(path, 0755)
}

// DeleteNode apaga recursivamente um arquivo ou diretório.
func DeleteNode(path string) error {
	return os.RemoveAll(path)
}

// RenameNode renomeia ou move um arquivo/diretório de lugar.
func RenameNode(oldPath, newPath string) error {
	// O os.Rename usa chamadas de sistema nativas de altíssima performance para mover ponteiros de disco
	return os.Rename(oldPath, newPath)
}
