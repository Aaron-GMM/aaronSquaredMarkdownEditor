import {
    GetDirectory, OpenNote, SaveNote, CreateFile, DeleteNode, RenameNode,
    StartTerminal, WriteTerminal, SaveImage, ReadImageBase64, StopTerminal,
    SelectFolder
} from './services/wailsjs/go/app/App.js';

// ==========================================
// 1. ESTADO GLOBAL E CONFIGURAÇÕES
// ==========================================
let currentRootPath = "./";
let currentFilePath = "";
let debounceTimer;

const md = window.markdownit({
    html: true, breaks: true, linkify: true,
    highlight: function (str, lang) {
        if (lang && lang.toLowerCase() === 'mermaid') return `<div class="mermaid">${str}</div>`;
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

    // ==========================================
    // 2. CONTROLOS DA JANELA (FRAMELESS)
    // ==========================================
    document.getElementById('window-minimize').onclick = () => window.runtime.WindowMinimise();
    document.getElementById('window-maximize').onclick = () => window.runtime.WindowToggleMaximise();
    document.getElementById('window-close').onclick = () => window.runtime.Quit();

    // ==========================================
    // 3. REDIMENSIONAMENTO DA SIDEBAR
    // ==========================================
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = e.clientX;
        if (newWidth > 150 && newWidth < 500) sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('active');
            document.body.style.cursor = 'default';
        }
    });

    // ==========================================
    // 4. EXPLORADOR DE FICHEIROS E PASTAS
    // ==========================================
    // Abrir pasta externa (Nova Feature!)
    document.getElementById('btn-open-folder').onclick = async () => {
        try {
            const folder = await SelectFolder();
            if (folder) {
                currentRootPath = folder;
                currentFilePath = ""; // Reseta o ficheiro atual
                editor.value = "";
                updatePreview();
                await loadDirectory(currentRootPath, fileTree);
            }
        } catch (err) { alert("Erro ao selecionar pasta: " + err); }
    };

    document.getElementById('btn-refresh').onclick = () => loadDirectory(currentRootPath, fileTree);

    document.getElementById('btn-new-file').onclick = async () => {
        const fileName = prompt("Nome do arquivo (ex: nota.md):");
        if (fileName) {
            const safeName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
            const fullPath = `${currentRootPath}/${safeName}`;
            try {
                await CreateFile(fullPath);
                await loadDirectory(currentRootPath, fileTree);
                await window.openFile(fullPath);
            } catch (err) { alert("Erro ao criar: " + err); }
        }
    };

    // ==========================================
    // 5. GESTÃO DO TERMINAL
    // ==========================================
    const bottomPanel = document.getElementById('bottom-panel');
    let terminalActive = false;
    let term = null;

    const toggleTerminal = async (show) => {
        if (show) {
            bottomPanel.classList.remove('hidden');
            if (!terminalActive) {
                term = new Terminal({
                    theme: { background: '#000000', foreground: '#e2e8f0', cursor: '#3b82f6' },
                    fontFamily: 'monospace', fontSize: 13, cursorBlink: true
                });
                document.getElementById('terminal-container').innerHTML = '';
                term.open(document.getElementById('terminal-container'));

                try {
                    await StartTerminal();
                    window.runtime.EventsOn("terminal:output", (data) => term.write(data.replace(/\n/g, '\r\n')));
                } catch (e) { term.writeln(`\r\n\x1b[1;31mErro:\x1b[0m ${e}`); }

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
                terminalActive = true;
            }
        } else {
            bottomPanel.classList.add('hidden');
            if (terminalActive) {
                await StopTerminal();
                if (term) term.dispose();
                terminalActive = false;
            }
        }
    };

    document.getElementById('btn-open-terminal').onclick = () => toggleTerminal(true);
    document.getElementById('btn-close-terminal').onclick = () => toggleTerminal(false);

    // ==========================================
    // 6. EDITOR, IMAGENS E EXPORTAÇÃO PDF
    // ==========================================
    editor.addEventListener('input', updatePreview);

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        }
    });

    const btnInsertImage = document.getElementById('btn-insert-image');
    const imageUpload = document.getElementById('image-upload');
    btnInsertImage.onclick = () => imageUpload.click();

    imageUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64Str = event.target.result.split(',')[1];
            const ext = file.name.split('.').pop() || 'png';
            const fileName = `img_${Date.now()}.${ext}`;
            const filePath = `${currentRootPath}/${fileName}`;
            try {
                await SaveImage(filePath, base64Str);
                const cursorPos = editor.selectionStart;
                const textBefore = editor.value.substring(0, cursorPos);
                const textAfter = editor.value.substring(editor.selectionEnd);
                editor.value = textBefore + `\n![${file.name}](${filePath})\n` + textAfter;
                updatePreview();
                await loadDirectory(currentRootPath, fileTree);
            } catch (err) { alert("Erro ao guardar a imagem: " + err); }
            imageUpload.value = '';
        };
        reader.readAsDataURL(file);
    };

    document.getElementById('btn-export-pdf').onclick = async () => {
        if (editor.value.trim() === "") { alert("A nota está vazia!"); return; }
        const element = document.getElementById('markdown-preview');
        const opt = {
            margin: 15, filename: 'aaron_nota.pdf', image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        alert("Gerando PDF... Aguarde um momento.");
        element.classList.add('pdf-export-mode');
        await new Promise(resolve => setTimeout(resolve, 150));

        try {
            const dataUri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
            const base64Data = dataUri.split(',')[1];
            const filePath = `${currentRootPath}/aaron_export_${Date.now()}.pdf`;
            await SaveImage(filePath, base64Data);
            await loadDirectory(currentRootPath, fileTree);
            alert(`✅ Sucesso! PDF guardado: ${filePath}`);
        } catch (err) { alert("Erro ao gerar o PDF: " + err); }
        finally { element.classList.remove('pdf-export-mode'); }
    };

    // ==========================================
    // 7. SLASH COMMANDS (Menu Flutuante /)
    // ==========================================
    const slashMenu = document.getElementById('slash-menu');
    const slashItems = document.querySelectorAll('.slash-item');
    let slashMenuOpen = false;
    let selectedIndex = 0;

    editor.addEventListener('input', () => {
        const cursorPos = editor.selectionStart;
        const match = editor.value.substring(0, cursorPos).match(/(?:^|\n)\/$/);
        if (match) openSlashMenu();
        else if (slashMenuOpen) closeSlashMenu();
    });

    editor.addEventListener('keydown', (e) => {
        if (!slashMenuOpen) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = (selectedIndex + 1) % slashItems.length; updateSlashSelection(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = (selectedIndex - 1 + slashItems.length) % slashItems.length; updateSlashSelection(); }
        else if (e.key === 'Enter') { e.preventDefault(); executeSlashCommand(slashItems[selectedIndex].getAttribute('data-action')); }
        else if (e.key === 'Escape' || e.key === ' ') closeSlashMenu();
    });

    slashItems.forEach((item, index) => {
        item.addEventListener('mouseenter', () => { selectedIndex = index; updateSlashSelection(); });
        item.addEventListener('click', () => { executeSlashCommand(item.getAttribute('data-action')); editor.focus(); });
    });

    function openSlashMenu() { slashMenuOpen = true; slashMenu.classList.add('active'); selectedIndex = 0; updateSlashSelection(); }
    function closeSlashMenu() { slashMenuOpen = false; slashMenu.classList.remove('active'); }
    function updateSlashSelection() { slashItems.forEach(item => item.classList.remove('selected')); slashItems[selectedIndex].classList.add('selected'); }

    function executeSlashCommand(action) {
        const cursorPos = editor.selectionStart;
        const textBefore = editor.value.substring(0, cursorPos - 1);
        const textAfter = editor.value.substring(editor.selectionEnd);
        let insertText = action === 'table' ? "| Cabeçalho 1 | Cabeçalho 2 |\n| ----------- | ----------- |\n| Valor       | Valor       |\n" :
            action === 'code' ? "```javascript\n// O seu código aqui\n```\n" :
                "```mermaid\ngraph TD;\n    A[Início] --> B[Fim];\n```\n";

        editor.value = textBefore + insertText + textAfter;
        editor.selectionStart = editor.selectionEnd = textBefore.length + insertText.length;
        closeSlashMenu();
        updatePreview();
    }

    // Carrega a diretoria inicial
    await loadDirectory(currentRootPath, fileTree);
});

// ==========================================
// 8. FUNÇÕES GLOBAIS DE RENDERIZAÇÃO
// ==========================================
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
    if (!currentFilePath) { alert("Nenhum arquivo aberto para salvar!"); return; }
    try {
        await SaveNote(currentFilePath, document.getElementById('markdown-editor').value);
        alert("✅ Arquivo salvo com sucesso!");
    } catch (err) { alert(err); }
}

window.deleteItem = async (path) => {
    if (confirm("Tem certeza que deseja deletar?")) {
        await DeleteNode(path);
        await loadDirectory(currentRootPath, document.getElementById('file-tree'));
    }
};

window.renameItem = async (path, oldName) => {
    const newName = prompt("Novo nome:", oldName);
    if (newName && newName !== oldName) {
        await RenameNode(path, path.replace(oldName, newName));
        await loadDirectory(currentRootPath, document.getElementById('file-tree'));
    }
};

window.handleItemClick = async (path, isDir, element) => {
    if (isDir) {
        const li = element.closest('li');
        const ul = li.querySelector('.sub-dir');
        if (ul.style.display === 'none') {
            ul.style.display = 'block';
            await loadDirectory(path, ul);
        } else { ul.style.display = 'none'; }
    } else { await window.openFile(path); }
};

function renderNodes(nodes, container) {
    container.innerHTML = '';
    if (!nodes) return;
    nodes.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));

    const folderIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #94a3b8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    const fileIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #64748b"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;

    nodes.forEach(node => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="file-item">
                <div class="file-info" onclick="window.handleItemClick('${node.path}', ${node.isDir}, this)">
                    ${node.isDir ? folderIcon : fileIcon} <span style="margin-top: 1px;">${node.name}</span>
                </div>
                <div class="file-actions">
                    <button class="action-btn btn-rename" onclick="event.stopPropagation(); window.renameItem('${node.path}', '${node.name}')">✏️</button>
                    <button class="action-btn btn-delete" onclick="event.stopPropagation(); window.deleteItem('${node.path}')">✕</button>
                </div>
            </div>
            <ul class="sub-dir" style="display: none; padding-left: 15px;"></ul>
        `;
        container.appendChild(li);
    });
}

function updatePreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const editor = document.getElementById('markdown-editor');
        const preview = document.getElementById('markdown-preview');
        preview.innerHTML = md.render(editor.value);

        try { await mermaid.run({ querySelector: '.mermaid', suppressErrors: true }); } catch (err) {}

        const images = preview.querySelectorAll('img');
        images.forEach(async (img) => {
            const originalSrc = img.getAttribute('src');
            if (originalSrc && !originalSrc.startsWith('http') && !originalSrc.startsWith('data:')) {
                try {
                    const base64Data = await ReadImageBase64(originalSrc);
                    const ext = originalSrc.split('.').pop().toLowerCase();
                    const mimeType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : (ext === 'svg') ? 'image/svg+xml' : (ext === 'gif') ? 'image/gif' : 'image/png';
                    img.src = `data:${mimeType};base64,${base64Data}`;
                } catch (err) { console.warn(`Aviso: Imagem não encontrada: ${originalSrc}`); }
            }
        });
    }, 50);
}