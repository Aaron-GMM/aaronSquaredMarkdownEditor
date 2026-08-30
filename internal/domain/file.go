package domain

// FileNode representa um arquivo ou diretório na árvore de navegação
type FileNode struct {
	Name      string      `json:"name"`
	Path      string      `json:"path"`
	IsDir     bool        `json:"isDir"`
	Extension string      `json:"extension,omitempty"`
	Children  []*FileNode `json:"children,omitempty"`
}

// Note representa o conteúdo de um arquivo Markdown aberto
type Note struct {
	Path     string                 `json:"path"`
	Content  string                 `json:"content"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}
