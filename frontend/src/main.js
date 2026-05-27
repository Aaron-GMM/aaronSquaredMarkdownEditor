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
// --- SISTEMA DE DIÁLOGOS PROFISSIONAIS ---
const Dialog = {
    show: function({ title, message = '', type = 'alert', placeholder = '', defaultValue = '' }) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-dialog');
            const titleEl = document.getElementById('dialog-title');
            const msgEl = document.getElementById('dialog-message');
            const inputEl = document.getElementById('dialog-input');
            const btnCancel = document.getElementById('btn-dialog-cancel');
            const btnConfirm = document.getElementById('btn-dialog-confirm');

            titleEl.innerHTML = title;

            if (message) { msgEl.innerText = message; msgEl.style.display = 'block'; }
            else { msgEl.style.display = 'none'; }

            if (type === 'prompt') {
                inputEl.style.display = 'block';
                inputEl.placeholder = placeholder;
                inputEl.value = defaultValue;
                setTimeout(() => inputEl.focus(), 100);
            } else {
                inputEl.style.display = 'none';
            }

            btnCancel.style.display = type === 'alert' ? 'none' : 'block';
            btnConfirm.innerText = type === 'confirm' ? 'Confirmar' : 'OK';

            const cleanup = () => {
                modal.classList.add('hidden');
                btnConfirm.onclick = null;
                btnCancel.onclick = null;
                inputEl.onkeydown = null;
            };

            btnCancel.onclick = () => { cleanup(); resolve(null); };
            btnConfirm.onclick = () => {
                cleanup();
                resolve(type === 'prompt' ? inputEl.value : true);
            };

            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') btnConfirm.click();
                if (e.key === 'Escape') btnCancel.click();
            };

            modal.classList.remove('hidden');
        });
    },
    alert: (title, message) => Dialog.show({ title, message, type: 'alert' }),
    confirm: (title, message) => Dialog.show({ title, message, type: 'confirm' }),
    prompt: (title, placeholder, defaultValue = '') => Dialog.show({ title, type: 'prompt', placeholder, defaultValue })
};
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
    const langSelector = document.getElementById('language-selector');
    const settingsModal = document.getElementById('settings-modal');
    const inputGroqKey = document.getElementById('groq-api-key');
    const statusMsg = document.getElementById('settings-status-msg');
    const btnSaveSettings = document.getElementById('btn-save-settings');

    const openSettings = () => {
        inputGroqKey.value = localStorage.getItem('groq_api_key') || '';
        statusMsg.style.display = 'none';
        settingsModal.classList.remove('hidden');
    };

    document.getElementById('btn-settings').onclick = openSettings;
    document.getElementById('btn-close-settings').onclick = () => settingsModal.classList.add('hidden');

    // Validar Chave na Groq antes de salvar
    btnSaveSettings.onclick = async () => {
        const key = inputGroqKey.value.trim();
        if (!key) {
            statusMsg.innerText = "A chave não pode estar vazia.";
            statusMsg.style.color = "#ef4444"; // Vermelho
            statusMsg.style.display = "block";
            return;
        }

        statusMsg.innerText = "⏳ A validar chave na Groq...";
        statusMsg.style.color = "var(--accent-blue)";
        statusMsg.style.display = "block";
        btnSaveSettings.disabled = true;

        try {
            // Tenta listar os modelos para ver se a chave é válida
            const res = await fetch('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${key}` }
            });

            if (res.ok) {
                localStorage.setItem('groq_api_key', key);
                statusMsg.innerText = "✅ Chave validada e guardada com sucesso!";
                statusMsg.style.color = "#10b981"; // Verde
                setTimeout(() => settingsModal.classList.add('hidden'), 1500); // Fecha após 1.5s
            } else {
                statusMsg.innerText = "❌ Chave inválida. Verifique e tente novamente.";
                statusMsg.style.color = "#ef4444";
            }
        } catch (err) {
            statusMsg.innerText = "❌ Erro de rede ao tentar validar.";
            statusMsg.style.color = "#ef4444";
        } finally {
            btnSaveSettings.disabled = false;
        }
    };
    let systemLang = navigator.language || navigator.userLanguage;
    if (!systemLang || systemLang === 'C' || systemLang === 'C.UTF-8') {
        systemLang = 'pt-BR';
    }

    // Ajusta o seletor para o idioma detetado
    // (Pega apenas os primeiros 5 caracteres, ex: "pt-BR")
    const shortLang = systemLang.substring(0, 5);
    if (Array.from(langSelector.options).some(opt => opt.value === shortLang)) {
        langSelector.value = shortLang;
    }

    // Aplica no editor
    editor.setAttribute('lang', langSelector.value);

    // --- 2. TROCA MANUAL ---
    langSelector.onchange = () => {
        const selectedLang = langSelector.value;
        editor.setAttribute('lang', selectedLang);
        console.log("Teclado/Idioma alterado manualmente para:", selectedLang);

        // Foca de volta no editor para o utilizador continuar a escrever
        editor.focus();
    }

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
        const titleIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg> Novo Arquivo`;

        const fileName = await Dialog.prompt(titleIcon, "Nome do arquivo (ex: nota.md)");

        if (fileName) {
            const safeName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
            const fullPath = `${currentRootPath}/${safeName}`;
            try {
                await CreateFile(fullPath);
                await loadDirectory(currentRootPath, fileTree);
                await window.openFile(fullPath);
            } catch (err) { Dialog.alert("❌ Erro", "Erro ao criar ficheiro."); }
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

                // NOVO: Aplica o redimensionamento inteligente
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);

                document.getElementById('terminal-container').innerHTML = '';
                term.open(document.getElementById('terminal-container'));

                // Força o terminal a ganhar o tamanho exato da Div no Windows
                fitAddon.fit();
                window.addEventListener('resize', () => fitAddon.fit());

                try {
                    await StartTerminal();
                    window.runtime.EventsOn("terminal:output", (data) => {
                        // NOVO: Normaliza a quebra de linha do Windows para não empurrar o texto de forma errada
                        const normalizedData = data.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
                        term.write(normalizedData);
                    });
                } catch (e) { term.writeln(`\r\n\x1b[1;31mErro:\x1b[0m ${e}`); }

                let currentInput = '';
                term.onKey(async ({ key, domEvent }) => {
                    if (domEvent.keyCode === 13) {
                        term.write('\r\n');
                        // NOVO: Manda \r\n para o Windows executar o comando sem falhar
                        await WriteTerminal(currentInput + "\r\n");
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

    async function executeSlashCommand(action) {
        const cursorPos = editor.selectionStart;
        const textBefore = editor.value.substring(0, cursorPos - 1); // remove o "/"
        const textAfter = editor.value.substring(editor.selectionEnd);
        let insertText = "";

        if (action === 'image') {
            document.getElementById('image-upload').click();
            closeSlashMenu();
            return; // Interrompe para esperar o upload
        }

        if (action === 'ai') {
            closeSlashMenu();

            let apiKey = localStorage.getItem('groq_api_key');

            if (!apiKey) {
                openSettings();
                return;
            }

            const aiIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Gerar com IA`;

            const promptText = await Dialog.prompt(aiIcon, "O que deseja que a IA gere em Markdown?");
            if (!promptText) return;

            editor.value = textBefore + "⏳ *A gerar estrutura em milissegundos...*\n" + textAfter;
            updatePreview();

            try {
                // A magia acontece aqui: o Go faz a chamada pesada!
                const responseText = await window.go.app.App.GenerateAIContent(apiKey, promptText);
                insertText = responseText + "\n\n";
            } catch (e) {
                insertText = `> ❌ *Erro da IA:* ${e}\n`;
            }

            // Atualiza o editor com a resposta da IA
            editor.value = textBefore + insertText + textAfter;
            editor.selectionStart = editor.selectionEnd = textBefore.length + insertText.length;
            updatePreview();

            return; // CÍRTICO: Impede que o código continue e execute a lógica genérica abaixo
        }

        // --- Lógica para inserções estáticas (Tabelas, Código, Diagramas) ---
        else if (action === 'table') insertText = "| Cab 1 | Cab 2 |\n| --- | --- |\n| Val | Val |\n";
        else if (action === 'code') insertText = "```javascript\n\n```\n";
        else if (action === 'mermaid') insertText = "```mermaid\ngraph TD;\n    A --> B;\n```\n";

        // Aplica a inserção estática no editor
        editor.value = textBefore + insertText + textAfter;
        updatePreview();
        closeSlashMenu();
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
    const titleIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Apagar Item`;

    const confirmed = await Dialog.confirm(titleIcon, "Tem a certeza que deseja eliminar permanentemente este item? Esta ação não pode ser desfeita.");
    if (confirmed) {
        await DeleteNode(path);
        await loadDirectory(currentRootPath, document.getElementById('file-tree'));
    }
};
window.renameItem = async (path, oldName) => {
    const titleIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg> Renomear Ficheiro`;

    const newName = await Dialog.prompt(titleIcon, "Novo nome:", oldName);
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
        // MÁGICA WINDOWS: Transforma "C:\pasta\nota.md" em "C:\\pasta\\nota.md" para o JS não bugar
        const safePath = node.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeName = node.name.replace(/'/g, "\\'");

        const editIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
        const trashIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

        const li = document.createElement('li');
        li.innerHTML = `
            <div class="file-item">
                <div class="file-info" onclick="window.handleItemClick('${safePath}', ${node.isDir}, this)">
                    ${node.isDir ? folderIcon : fileIcon} <span style="margin-top: 1px;">${node.name}</span>
                </div>
                <div class="file-actions">
                    <button class="action-btn btn-rename" onclick="event.stopPropagation(); window.renameItem('${safePath}', '${safeName}')" title="Renomear">${editIcon}</button>
                    <button class="action-btn btn-delete" onclick="event.stopPropagation(); window.deleteItem('${safePath}')" title="Apagar">${trashIcon}</button>
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
                    const decodedPath = decodeURIComponent(originalSrc).replace('file:///', '');
                    const base64Data = await ReadImageBase64(decodedPath);
                    const ext = originalSrc.split('.').pop().toLowerCase();
                    const mimeType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : (ext === 'svg') ? 'image/svg+xml' : (ext === 'gif') ? 'image/gif' : 'image/png';
                    img.src = `data:${mimeType};base64,${base64Data}`;
                } catch (err) { console.warn(`Aviso: Imagem não encontrada: ${originalSrc}`); }
            }
        });
    }, 50);
}