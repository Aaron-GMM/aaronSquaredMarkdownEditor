import { GetDirectory, OpenNote } from './services/wailsjs/go/app/App.js';

document.addEventListener('DOMContentLoaded', async () => {
    const fileTree = document.getElementById('file-tree');

    // Inicia carregando o diretório atual do projeto
    // No futuro, isso pode ser escolhido via um botão "Abrir Pasta"
    await loadDirectory("./", fileTree);
});

// Função que busca uma pasta no Go e renderiza no HTML
async function loadDirectory(path, container) {
    try {
        const dirNode = await GetDirectory(path);
        renderNodes(dirNode.children, container);
    } catch (error) {
        console.error("Erro ao carregar diretório:", error);
        container.innerHTML = `<li style="color: var(--text-muted);">Erro ao carregar</li>`;
    }
}

// Função recursiva visual para desenhar a árvore
function renderNodes(nodes, container) {
    container.innerHTML = ''; // Limpa o "Carregando..."

    if (!nodes || nodes.length === 0) {
        container.innerHTML = `<li style="color: var(--text-muted); font-style: italic;">Vazio</li>`;
        return;
    }

    // Ordena: Pastas primeiro (A-Z), depois arquivos (A-Z)
    nodes.sort((a, b) => {
        if (a.isDir === b.isDir) return a.name.localeCompare(b.name);
        return a.isDir ? -1 : 1;
    });

    nodes.forEach(node => {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.style.padding = '6px 0';
        li.style.userSelect = 'none';

        if (node.isDir) {
            // É uma pasta
            li.innerHTML = `<span>📁 ${node.name}</span>`;

            // Container para as subpastas (inicia oculto e vazio)
            const childrenContainer = document.createElement('ul');
            childrenContainer.style.display = 'none';
            childrenContainer.style.paddingLeft = '15px';
            childrenContainer.style.listStyle = 'none';

            li.onclick = async (e) => {
                e.stopPropagation(); // Evita que o clique vaze para as pastas pais
                const isClosed = childrenContainer.style.display === 'none';

                if (isClosed) {
                    // Se estiver abrindo pela primeira vez, busca no Go
                    if (childrenContainer.innerHTML === '') {
                        childrenContainer.innerHTML = '<li style="color: gray;">Carregando...</li>';
                        await loadDirectory(node.path, childrenContainer);
                    }
                    childrenContainer.style.display = 'block';
                    li.querySelector('span').textContent = `📂 ${node.name}`;
                } else {
                    // Se estiver fechando, apenas oculta
                    childrenContainer.style.display = 'none';
                    li.querySelector('span').textContent = `📁 ${node.name}`;
                }
            };

            li.appendChild(childrenContainer);
        } else {
            // É um arquivo
            const isMarkdown = node.name.endsWith('.md');
            li.innerHTML = `<span>📄 ${node.name}</span>`;

            // Destaca arquivos markdown visualmente
            li.style.color = isMarkdown ? 'var(--text-primary)' : 'var(--text-muted)';

            li.onclick = (e) => {
                e.stopPropagation();
                if (isMarkdown) {
                    openFile(node.path);
                } else {
                    alert("Apenas arquivos Markdown (.md) são suportados para edição.");
                }
            };
        }

        // Efeito de hover simples via JS (Pode ser passado pro CSS depois)
        li.addEventListener('mouseover', (e) => { e.stopPropagation(); li.style.opacity = '0.8'; });
        li.addEventListener('mouseout', (e) => { e.stopPropagation(); li.style.opacity = '1'; });

        container.appendChild(li);
    });
}

// Função para abrir o arquivo e jogar no editor
// Modifique a função openFile existente para isto:
async function openFile(path) {
    try {
        const note = await OpenNote(path);
        const editor = document.getElementById('markdown-editor');

        // Joga o texto no editor
        editor.value = note.content;

        // Dispara a renderização inicial do Preview
        updatePreview();

    } catch (error) {
        console.error("Erro ao abrir arquivo:", error);
        alert(`Não foi possível abrir o arquivo: ${error}`);
    }
}
// ==========================================
// LÓGICA DO EDITOR E MARKDOWN
// ==========================================

// Inicializa o conversor Markdown
const md = window.markdownit({
    html: true,       // Permite HTML dentro do Markdown
    breaks: true,     // Quebra de linhas automáticas
    linkify: true     // Transforma URLs em links automaticamente
});

let debounceTimer;

// Função para atualizar o preview com Debounce (Critério de Performance: < 50ms)
function updatePreview() {
    const editor = document.getElementById('markdown-editor');
    const preview = document.getElementById('markdown-preview');

    // Limpa o timer anterior se o usuário continuou digitando
    clearTimeout(debounceTimer);

    // Configura o novo timer de 50ms
    debounceTimer = setTimeout(() => {
        const rawText = editor.value;
        const htmlContent = md.render(rawText);
        preview.innerHTML = htmlContent;
    }, 50);
}

// Escuta tudo o que é digitado no Editor e dispara a atualização
document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('markdown-editor');
    editor.addEventListener('input', updatePreview);
});