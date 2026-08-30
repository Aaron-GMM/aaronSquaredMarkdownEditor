# Aaron² Markdown Editor

Um editor Markdown super rápido, minimalista e seguro, construído com **Go**, **Wails** e **Tailwind CSS**. Projetado para desenvolvedores e escritores que precisam de ferramentas modernas de Gestão do Conhecimento  conectadas ao sistema de arquivos local, com integração de IA.

##  Funcionalidades 

- **Arquitetura Híbrida Leve:** Motor backend em Go para operações de I/O em milissegundos e UI reativa via webview (Vanilla JS + Tailwind).
- **Gestão do Conhecimento Bidirecional:** Indexação local nativa de `[[Backlinks]]` e metadados via cabeçalhos YAML (Frontmatter) diretamente na barra lateral de contexto.
- **Integração IA Nativa:** Gere textos, resumos ou estruturas usando a API da Groq (Llama-3.1). Suas chaves de API são armazenadas nativamente no SO via `ConfigService`.
- **Modos de Visualização Flexíveis:** Editor Puro, Preview Puro ou Modo Split com renderização instantânea.
- **Inserção Binária de Imagens:** Não sofre com lentidão de Base64. Insira imagens, e o backend gerencia a cópia binária diretamente para a sua pasta de trabalho.
- **Command Palette (Ctrl+K):** Busque arquivos e contextos nativamente sem sair do teclado.
- **Exportação Nativa:** Gere PDFs diretamente das suas anotações com formatação limpa.
- **Multi-Tabs Simultâneas:** Controle dinâmico do Workspace permitindo múltiplos documentos abertos (com preservação de buffers).
- **Formatadores Rápidos:** Barra de ferramentas (Negrito, Itálico, Listas) interativa baseada em seleção de texto.

## 🛠️ Stack Tecnológico

- **Backend:** Go 1.21+ & Framework [Wails v2](https://wails.io/)
- **Frontend:** Vanilla JS, HTML5, Tailwind CSS
- **Markdown & Renderização:** `markdown-it`, PrismJS (Highlighting de Código), MermaidJS (Diagramas).
- **Ícones:** Phosphor Icons

##  Instalação & Compilação

Certifique-se de ter o Go e o Wails instalados na sua máquina.

```bash
# Clone o repositório
git clone https://github.com/Aaron-GMM/aaronSquaredMarkdownEditor.git
cd aaronSquaredMarkdownEditor

# Compile e rode em modo de desenvolvimento (Auto-reload)
wails dev

# Ou compile o binário final para o seu sistema operativo
wails build
```

## 🧠 Filosofia do Projeto

