import {
    GetDirectory,
    OpenNote,
    SaveNote,
    CreateFile,
    DeleteNode,
    StartTerminal, // NOVO
    WriteTerminal  // NOVO
} from './services/wailsjs/go/app/App.js';
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

let currentFilePath = ""; // Variável global para saber qual arquivo está aberto

// Função para salvar o arquivo atual via Go
async function handleSave() {
    if (!currentFilePath) return;

    const content = document.getElementById('markdown-editor').value;
    try {
        await SaveNote(currentFilePath, content);
        console.log("Arquivo salvo com sucesso pelo Go!");
        // Aqui você pode adicionar um pequeno feedback visual no UI
    } catch (err) {
        alert("Erro ao salvar: " + err);
    }
}

// Atalho Ctrl+S (ou Cmd+S no Mac)
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
    }
});
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
        currentFilePath = path; // Armazena o caminho para o SaveNote usar depois

        const editor = document.getElementById('markdown-editor');
        editor.value = note.content;
        updatePreview();
    } catch (error) {
        console.error("Erro ao abrir arquivo:", error);
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

async function runTerminal(command) {
    try {
        console.log(`Enviando comando para o Go: ${command}`);
        const output = await ExecuteTerminalCommand(command);
        console.log("Saída do Terminal Nativo:", output);
        return output;
    } catch (err) {
        console.error("Erro no Terminal:", err);
    }
}
// Escuta tudo o que é digitado no Editor e dispara a atualização
document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('markdown-editor');
    editor.addEventListener('input', updatePreview);
    document.getElementById('btn-refresh').addEventListener('click', async () => {
        const fileTree = document.getElementById('file-tree');
        fileTree.innerHTML = '<li style="color: gray;">Atualizando...</li>';
        await loadDirectory("./", fileTree);
    });

    // Lógica para o botão "Novo Arquivo"
    document.getElementById('btn-new-file').addEventListener('click', async () => {
        // Pede o nome do arquivo pro usuário (forma nativa e leve)
        const fileName = prompt("Nome do novo arquivo (ex: nota.md):");

        if (fileName) {
            // Garante que tenha a extensão .md
            const safeName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
            const filePath = `./${safeName}`; // Cria na raiz do projeto para simplificar por enquanto

            try {
                // Chama a função nativa em Go que criamos!
                await CreateFile(filePath);

                // Atualiza a árvore visualmente
                const fileTree = document.getElementById('file-tree');
                await loadDirectory("./", fileTree);

                // Já abre o arquivo novo no editor
                openFile(filePath);
            } catch (err) {
                alert(`Erro ao criar arquivo: ${err}`);
            }
        }
    });
});

// Instancia o Xterm.js
const term = new Terminal({
    theme: {
        background: '#000000',
        foreground: '#e2e8f0',
        cursor: '#3b82f6'
    },
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    cursorBlink: true
});

// Anexa o terminal à div no HTML
term.open(document.getElementById('terminal-container'));
term.writeln('\x1b[1;34m⚡ Aaron² Terminal Iniciado (Sessão Persistente)\x1b[0m');

// Inicia o processo nativo no Go
try {
    await StartTerminal();
} catch (e) {
    term.writeln(`\r\n\x1b[1;31mErro ao iniciar bash/powershell:\x1b[0m ${e}`);
}

// Escuta tudo o que o terminal do Go "cospe" e joga na tela
window.runtime.EventsOn("terminal:output", (data) => {
    // Formata as quebras de linha para o Xterm entender
    term.write(data.replace(/\n/g, '\r\n'));
});

let currentInput = '';

// Escuta a digitação do usuário
term.onKey(async ({ key, domEvent }) => {
    const printable = !domEvent.altKey && !domEvent.altGraphKey && !domEvent.ctrlKey && !domEvent.metaKey;

    if (domEvent.keyCode === 13) { // Tecla ENTER
        term.write('\r\n');
        if (currentInput.trim() !== '') {
            // Envia o comando + a quebra de linha (\n) pro Go processar
            try {
                await WriteTerminal(currentInput + "\n");
            } catch (err) {
                term.writeln(`\r\n\x1b[1;31mErro:\x1b[0m ${err}`);
            }
        }
        currentInput = '';
    } else if (domEvent.keyCode === 8) { // Tecla BACKSPACE
        if (currentInput.length > 0) {
            currentInput = currentInput.slice(0, -1);
            term.write('\b \b');
        }
    } else if (printable) {
        currentInput += key;
        term.write(key);
    }
    });

function prompt(term) {
    term.write('\r\n\x1b[1;32m$\x1b[0m ');
}