import {
    GetDirectory, OpenNote, SaveNote, CreateFile, DeleteNode, RenameNode, StartTerminal, WriteTerminal
} from './services/wailsjs/go/app/App.js';

let currentFilePath = "";
let debounceTimer;

// Configuração do Markdown-it e Prism
const md = window.markdownit({
    html: true, breaks: true, linkify: true,
    highlight: function (str, lang) {
        if (lang && lang.toLowerCase() === 'mermaid') { return `<div class="mermaid">${str}</div>`; }
        if (lang && Prism.languages[lang]) {
            try { return '<pre class="language-' + lang + '"><code class="language-' + lang + '">' + Prism.highlight(str, Prism.languages[lang], lang) + '</code></pre>'; } catch (__) {}
        }
        return '<pre class="language-none"><code class="language-none">' + md.utils.escapeHtml(str) + '</code></pre>';
    }
});
mermaid.initialize({ startOnLoad: false, theme: 'dark' });

document.addEventListener('DOMContentLoaded', async () => {
    const fileTree = document.getElementById('file-tree');
    const editor = document.getElementById('markdown-editor');

    // 1. Inicia o Terminal
    const term = new Terminal({
        theme: { background: '#000000', foreground: '#e2e8f0', cursor: '#3b82f6' },
        fontFamily: 'monospace', fontSize: 14, cursorBlink: true
    });
    term.open(document.getElementById('terminal-container'));

    try {
        await StartTerminal();
        window.runtime.EventsOn("terminal:output", (data) => {
            term.write(data.replace(/\n/g, '\r\n'));
        });
    } catch (e) {
        term.writeln(`\r\n\x1b[1;31mErro:\x1b[0m ${e}`);
    }

    let currentInput = '';
    term.onKey(async ({ key, domEvent }) => {
        if (domEvent.keyCode === 13) {
            term.write('\r\n');
            await WriteTerminal(currentInput + "\n");
            currentInput = '';
        } else if (domEvent.keyCode === 8) {
            if (currentInput.length > 0) {
                currentInput = currentInput.slice(0, -1);
                term.write('\b \b');
            }
        } else {
            currentInput += key;
            term.write(key);
        }
    });

    // 2. Eventos da UI e Arquivos
    await loadDirectory("./", fileTree);

    document.getElementById('btn-refresh').onclick = () => loadDirectory("./", fileTree);

    document.getElementById('btn-new-file').onclick = async () => {
        const fileName = prompt("Nome do arquivo (ex: nota.md):");
        if (fileName) {
            const safeName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
            try {
                await CreateFile(`./${safeName}`);
                await loadDirectory("./", fileTree);
                await window.openFile(`./${safeName}`);
            } catch (err) { alert("Erro ao criar: " + err); }
        }
    };

    editor.addEventListener('input', updatePreview);

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        }
    });
});

// --- FUNÇÕES GLOBAIS DE ARQUIVOS ---
async function loadDirectory(path, container) {
    try {
        const dirNode = await GetDirectory(path);
        renderNodes(dirNode.children, container);
    } catch (error) { console.error(error); }
}

window.openFile = async (path) => {
    try {
        const note = await OpenNote(path);
        currentFilePath = path;
        document.getElementById('markdown-editor').value = note.content;
        updatePreview();
    } catch (error) { console.error(error); }
};

async function handleSave() {
    if (!currentFilePath) {
        alert("Nenhum arquivo aberto para salvar!");
        return;
    }
    const content = document.getElementById('markdown-editor').value;
    try {
        await SaveNote(currentFilePath, content);
        alert("✅ Arquivo salvo com sucesso!");
    } catch (err) { alert(err); }
}

function renderNodes(nodes, container) {
    container.innerHTML = '';
    if (!nodes) return;
    nodes.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));

    nodes.forEach(node => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="file-item" style="display: flex; justify-content: space-between; cursor: pointer; padding: 4px;">
                <div class="file-info" onclick="window.handleItemClick('${node.path}', ${node.isDir}, this)">
                    <span>${node.isDir ? '📂' : '📄'}</span> ${node.name}
                </div>
                <div class="file-actions">
                    <button class="action-btn btn-rename" onclick="event.stopPropagation(); window.renameItem('${node.path}', '${node.name}')">✏️</button>
                    <button class="action-btn btn-delete" onclick="event.stopPropagation(); window.deleteItem('${node.path}')">🗑️</button>
                </div>
            </div>
            <ul class="sub-dir" style="display: none; padding-left: 15px;"></ul>
        `;
        container.appendChild(li);
    });
}

window.handleItemClick = async (path, isDir, element) => {
    if (isDir) {
        const li = element.closest('li');
        const ul = li.querySelector('.sub-dir');
        if (ul.style.display === 'none') {
            ul.style.display = 'block';
            await loadDirectory(path, ul);
        } else {
            ul.style.display = 'none';
        }
    } else {
        await window.openFile(path);
    }
};

window.deleteItem = async (path) => {
    if (confirm("Tem certeza que deseja deletar?")) {
        await DeleteNode(path);
        await loadDirectory("./", document.getElementById('file-tree'));
    }
};

window.renameItem = async (path, oldName) => {
    const newName = prompt("Novo nome:", oldName);
    if (newName && newName !== oldName) {
        await RenameNode(path, path.replace(oldName, newName));
        await loadDirectory("./", document.getElementById('file-tree'));
    }
};

function updatePreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const editor = document.getElementById('markdown-editor');
        const preview = document.getElementById('markdown-preview');

        preview.innerHTML = md.render(editor.value);
        try {
            await mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
        } catch (err) {}
    }, 50);
}