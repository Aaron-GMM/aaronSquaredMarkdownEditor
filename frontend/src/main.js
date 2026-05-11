import {
    GetDirectory, OpenNote, SaveNote, CreateFile, DeleteNode, RenameNode, StartTerminal, WriteTerminal, SaveImage, ReadImageBase64
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
    document.getElementById('btn-export-pdf').onclick = async () => {
        if (document.getElementById('markdown-editor').value.trim() === "") {
            alert("A nota está vazia!");
            return;
        }

        const element = document.getElementById('markdown-preview');

        const opt = {
            margin:       15,
            filename:     'aaron_nota.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        alert("Gerando PDF... Aguarde um momento.");

        // 1. APLICA O MODO CLARO
        element.classList.add('pdf-export-mode');

        // TRUQUE MÁGICO: Espera 150ms para garantir que o navegador repintou todas as letras de preto
        await new Promise(resolve => setTimeout(resolve, 150));

        try {
            const dataUri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
            const base64Data = dataUri.split(',')[1];

            const filePath = `./aaron_export_${Date.now()}.pdf`;
            await SaveImage(filePath, base64Data);
            await loadDirectory("./", document.getElementById('file-tree'));

            alert(`✅ Sucesso! O PDF foi guardado no projeto como: ${filePath}`);
        } catch (err) {
            alert("Erro ao gerar o PDF via Go: " + err);
        } finally {
            // 2. REMOVE A CLASSE E VOLTA AO MODO ESCURO
            element.classList.remove('pdf-export-mode');
        }
    };
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

    const btnInsertImage = document.getElementById('btn-insert-image');
    const imageUpload = document.getElementById('image-upload');

    // Quando clica no botão com o ícone, dispara o input de ficheiro escondido
    btnInsertImage.onclick = () => imageUpload.click();

    // Quando o utilizador escolhe uma imagem do computador
    imageUpload.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (event) => {
            const base64Str = event.target.result.split(',')[1];
            // Extrai a extensão original do ficheiro ou usa png por defeito
            const ext = file.name.split('.').pop() || 'png';
            const fileName = `img_${Date.now()}.${ext}`;
            const filePath = `./${fileName}`;

            try {
                // Envia para o Go guardar no disco
                await SaveImage(filePath, base64Str);

                // Insere a tag Markdown onde o cursor estiver
                const cursorPos = editor.selectionStart;
                const textBefore = editor.value.substring(0, cursorPos);
                const textAfter = editor.value.substring(editor.selectionEnd);

                const markdownTag = `\n![${file.name}](${filePath})\n`;
                editor.value = textBefore + markdownTag + textAfter;

                // Atualiza o ecrã
                updatePreview();
                await loadDirectory("./", document.getElementById('file-tree'));

            } catch (err) {
                alert("Erro ao guardar a imagem: " + err);
            }

            // Limpa o input para permitir escolher a mesma imagem novamente se necessário
            imageUpload.value = '';
        };

        // Lê o ficheiro escolhido
        reader.readAsDataURL(file);
    };

    editor.addEventListener('input', updatePreview);

// --- LÓGICA DE COLAR IMAGENS (RF06) - COM DEBUG ---
    editor.addEventListener('paste', async (e) => {
        // 1. Tenta capturar a área de transferência
        const clipboardData = e.clipboardData || window.clipboardData;

        if (!clipboardData) {
            console.error("Área de transferência não encontrada pelo navegador.");
            return;
        }

        const items = clipboardData.items;
        let imageFound = false;

        // 2. Procura por qualquer item que seja uma imagem
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                imageFound = true;
                e.preventDefault(); // Impede de colar texto por acidente

                const file = items[i].getAsFile();
                if (!file) {
                    alert("A imagem foi detetada, mas o sistema não conseguiu lê-la.");
                    continue;
                }

                alert(`Imagem capturada com sucesso! Tipo: ${file.type}`);

                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64Str = event.target.result.split(',')[1];
                    const ext = file.type.split('/')[1] || 'png';
                    const fileName = `img_${Date.now()}.${ext}`;
                    const filePath = `./${fileName}`;

                    try {
                        alert("A enviar para o Go guardar...");
                        await SaveImage(filePath, base64Str);
                        alert("Go guardou a imagem!");

                        // Insere a tag no editor
                        const cursorPos = editor.selectionStart;
                        const textBefore = editor.value.substring(0, cursorPos);
                        const textAfter = editor.value.substring(editor.selectionEnd);

                        const markdownTag = `\n![Imagem](${filePath})\n`;
                        editor.value = textBefore + markdownTag + textAfter;

                        updatePreview();
                        await loadDirectory("./", document.getElementById('file-tree'));

                    } catch (err) {
                        alert("Erro no Go ao guardar: " + err);
                    }
                };

                reader.readAsDataURL(file);
                break; // Para o loop depois de achar a imagem
            }
        }

        if (!imageFound) {
            console.log("Nenhuma imagem detetada no Ctrl+V. Apenas texto.");
        }
    });

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        }
    });

    // --- LÓGICA DO SLASH COMMANDS (Menu /) ---
    const slashMenu = document.getElementById('slash-menu');
    const slashItems = document.querySelectorAll('.slash-item');
    let slashMenuOpen = false;
    let selectedIndex = 0;

    // Escuta a digitação normal
    editor.addEventListener('input', () => {
        const cursorPos = editor.selectionStart;
        const textBeforeCursor = editor.value.substring(0, cursorPos);

        // Expressão Regular (Regex) para ver se o cursor está imediatamente após um "/"
        // no início do texto ou após uma quebra de linha.
        const match = textBeforeCursor.match(/(?:^|\n)\/$/);

        if (match) {
            openSlashMenu();
        } else if (slashMenuOpen) {
            // Se estava aberto mas apagou o "/", fecha o menu
            closeSlashMenu();
        }
    });

    // Escuta teclas de controlo (Setas, Enter, Esc)
    editor.addEventListener('keydown', (e) => {
        if (!slashMenuOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % slashItems.length;
            updateSlashSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + slashItems.length) % slashItems.length;
            updateSlashSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            executeSlashCommand(slashItems[selectedIndex].getAttribute('data-action'));
        } else if (e.key === 'Escape' || e.key === ' ') {
            closeSlashMenu();
        }
    });

    // Permitir clique com o rato nas opções
    slashItems.forEach((item, index) => {
        item.addEventListener('mouseenter', () => {
            selectedIndex = index;
            updateSlashSelection();
        });
        item.addEventListener('click', () => {
            executeSlashCommand(item.getAttribute('data-action'));
            editor.focus(); // Devolve o cursor para o editor
        });
    });

    // Funções auxiliares do Menu Slash
    function openSlashMenu() {
        slashMenuOpen = true;
        slashMenu.classList.add('active');
        selectedIndex = 0;
        updateSlashSelection();
    }

    function closeSlashMenu() {
        slashMenuOpen = false;
        slashMenu.classList.remove('active');
    }

    function updateSlashSelection() {
        slashItems.forEach(item => item.classList.remove('selected'));
        slashItems[selectedIndex].classList.add('selected');
    }

    function executeSlashCommand(action) {
        const cursorPos = editor.selectionStart;
        const textBefore = editor.value.substring(0, cursorPos);
        const textAfter = editor.value.substring(editor.selectionEnd);

        // Remove a barra '/' que o utilizador digitou
        const cleanTextBefore = textBefore.substring(0, textBefore.length - 1);

        let insertText = "";

        // Templates de Markdown
        if (action === 'table') {
            insertText = "| Cabeçalho 1 | Cabeçalho 2 |\n| ----------- | ----------- |\n| Valor       | Valor       |\n";
        } else if (action === 'code') {
            insertText = "```javascript\n// O seu código aqui\n```\n";
        } else if (action === 'mermaid') {
            insertText = "```mermaid\ngraph TD;\n    A[Início] --> B[Fim];\n```\n";
        }

        // Atualiza o texto do editor
        editor.value = cleanTextBefore + insertText + textAfter;

        // Move o cursor para o fim do bloco inserido
        editor.selectionStart = editor.selectionEnd = cleanTextBefore.length + insertText.length;

        closeSlashMenu();
        updatePreview();
    }
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

        // 1. Renderiza o HTML puro do Markdown
        preview.innerHTML = md.render(editor.value);

        // 2. Processa os diagramas Mermaid
        try {
            await mermaid.run({ querySelector: '.mermaid', suppressErrors: true });
        } catch (err) {}

        // 3. MÁGICA DAS IMAGENS: Carrega imagens locais dinamicamente via Go
        const images = preview.querySelectorAll('img');
        images.forEach(async (img) => {
            const originalSrc = img.getAttribute('src');

            // Se for um caminho local (não começar com http ou data:)
            if (originalSrc && !originalSrc.startsWith('http') && !originalSrc.startsWith('data:')) {
                try {
                    // Pede ao Go para ler o ficheiro no disco
                    const base64Data = await ReadImageBase64(originalSrc);

                    // Descobre a extensão para o formato correto
                    const ext = originalSrc.split('.').pop().toLowerCase();
                    const mimeType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' :
                        (ext === 'svg') ? 'image/svg+xml' :
                            (ext === 'gif') ? 'image/gif' : 'image/png';

                    // Substitui a src temporariamente no preview pela imagem real carregada!
                    img.src = `data:${mimeType};base64,${base64Data}`;
                } catch (err) {
                    console.warn(`Aviso: Imagem local não encontrada: ${originalSrc}`);
                }
            }
        });
    }, 50);
}