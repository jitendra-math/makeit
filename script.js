document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const cloudSaveBtn = document.getElementById('cloud-save-btn');

    // Modal Elements
    const saveModal = document.getElementById('save-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const folderListContainer = document.getElementById('folder-list');
    const newFolderBtn = document.getElementById('new-folder-btn');

    // GitHub Config
    const REPO_NAME = "My-Canvas-Designs";
    let githubUser = null;

    // ---------- FIX: Anti-aliasing ONLY (No forced shadows) ----------
    const styleFix = document.createElement('style');
    styleFix.textContent = `
        #render-area * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        /* Custom divider style for live preview of bulk designs */
        .bulk-divider {
            margin: 40px 0;
            border: 0;
            border-top: 3px dashed #cbd5e1;
            width: 100%;
        }
    `;
    document.head.appendChild(styleFix);

    // ---------- Helper: Clean image URLs ----------
    function cleanImageUrls(html) {
        let cleaned = html.replace(/src="\[(.*?)\]\(.*?\)"/g, 'src="$1"');
        cleaned = cleaned.replace(/src='\[(.*?)\]\(.*?\)'/g, 'src="$1"');
        cleaned = cleaned.replace(/src="\[(.*?)\]"/g, 'src="$1"');
        cleaned = cleaned.replace(/src='\[(.*?)\]'/g, 'src="$1"');
        return cleaned;
    }

    // ---------- Helper: Force crossorigin ----------
    function fixImages() {
        const images = renderArea.querySelectorAll('img');
        images.forEach(img => {
            if (!img.hasAttribute('crossorigin')) img.setAttribute('crossorigin', 'anonymous');
            if (!img.src || img.src === '') return;
            img.onerror = () => { img.style.border = '2px solid red'; };
        });
    }

    // ---------- Sanitization config ----------
    const purifyConfig = {
        ALLOWED_TAGS: [
            'div', 'span', 'h1', 'h2', 'h3', 'h4', 'p', 'a', 'img', 'button',
            'svg', 'path', 'circle', 'rect', 'ul', 'li', 'section', 'header',
            'footer', 'main', 'article', 'nav', 'aside', 'form', 'input',
            'label', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'br', 'hr',
            'strong', 'em', 'b', 'i', 'u', 'small', 'mark', 'figure', 'figcaption',
            'blockquote', 'pre', 'code', 'iframe', 'link', 'style'
        ],
        ALLOWED_ATTR: [
            'class', 'id', 'style', 'src', 'alt', 'href', 'target', 'rel',
            'width', 'height', 'fill', 'stroke', 'viewBox', 'd', 'cx', 'cy',
            'r', 'rx', 'ry', 'x', 'y', 'type', 'placeholder', 'value',
            'disabled', 'checked', 'selected', 'xmlns', 'transform', 'stroke-width',
            'stroke-linecap', 'stroke-linejoin', 'crossorigin', 'integrity', 'referrerpolicy'
        ]
    };

    // Global render function taaki Puppeteer backdoor isko access kar sake
    window.renderCode = function(code, isLivePreview = true) {
        let cleanedCode = cleanImageUrls(code);

        // Agar live preview hai aur multiple files (<next>) hain, toh ek visual line dikhao
        if (isLivePreview) {
            cleanedCode = cleanedCode.replace(/<next>/gi, '<hr class="bulk-divider" />');
        }

        const clean = DOMPurify.sanitize(cleanedCode, purifyConfig);
        renderArea.innerHTML = clean;
        fixImages();
    };

    codeInput.value = '';
    renderArea.innerHTML = '';

    let debounceTimer;
    codeInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { window.renderCode(codeInput.value, true); }, 150);
    });

    // ---------- PASTE BUTTON ----------
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                codeInput.value = text;
                codeInput.dispatchEvent(new Event('input'));
                const originalText = pasteBtn.innerText;
                pasteBtn.innerText = 'Pasted! ✓';
                pasteBtn.style.backgroundColor = '#e8f5e9';
                pasteBtn.style.borderColor = '#c8e6c9';
                setTimeout(() => {
                    pasteBtn.innerText = originalText;
                    pasteBtn.style.backgroundColor = '';
                    pasteBtn.style.borderColor = '';
                }, 2000);
            }
        } catch (err) { alert('Browser ko clipboard permission allow karo bhai.'); }
    });

    // ---------- DOWNLOAD LOGIC (Now with Bulk Support) ----------
    downloadBtn.addEventListener('click', async () => {
        const fullCode = codeInput.value.trim();
        if (fullCode === '') return alert('Bhai, pehle kuch code paste karo!');

        // HTML ko <next> tag ke basis par split karo
        const htmlSegments = fullCode.split(/<next>/i).map(seg => seg.trim()).filter(seg => seg.length > 0);

        if (htmlSegments.length === 0) return alert('Valid code nahi mila!');

        const originalText = downloadBtn.innerText;
        downloadBtn.disabled = true;

        try {
            // Har ek split kiye hue design par loop lagao
            for (let i = 0; i < htmlSegments.length; i++) {

                if (htmlSegments.length > 1) {
                    downloadBtn.innerText = `Generating ${i + 1} of ${htmlSegments.length}...`;
                } else {
                    downloadBtn.innerText = 'Generating HD Image...';
                }

                // Sirf current segment ko render karo (bina visual divider ke)
                window.renderCode(htmlSegments[i], false);

                // Browser ko elements paint aur fonts load karne ka time do
                await document.fonts.ready;
                await new Promise(r => setTimeout(r, 800));
                fixImages();

                const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
                const originalPadding = renderArea.style.padding;
                const originalTransition = renderArea.style.transition;

                renderArea.style.transition = 'none';
                renderArea.style.padding = '48px';
                void renderArea.offsetHeight;

                const rect = renderArea.getBoundingClientRect();

                // Canvas generation
                const canvas = await htmlToImage.toCanvas(renderArea, {
                    pixelRatio: pixelRatio, backgroundColor: null,
                    cacheBust: true, useCORS: true, allowTaint: false, skipAutoScale: false,
                    canvasWidth: rect.width * pixelRatio, canvasHeight: rect.height * pixelRatio,
                    style: { transform: 'scale(1)', transformOrigin: 'top left', margin: '0' }
                });

                renderArea.style.padding = originalPadding;
                renderArea.style.transition = originalTransition;
                canvas.getContext('2d').imageSmoothingEnabled = true;
                canvas.getContext('2d').imageSmoothingQuality = 'high';

                // File download trigger
                const link = document.createElement('a');
                link.download = htmlSegments.length > 1 ? `jss-design-canvas-export-${i + 1}.png` : 'jss-design-canvas-export.png';
                link.href = canvas.toDataURL('image/png');
                link.click();

                // Doosri file download hone se pehle thoda pause taaki browser freeze na ho
                if (i < htmlSegments.length - 1) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // Sab hone ke baad original pura code wapas preview mein daal do (with dividers)
            window.renderCode(fullCode, true);

        } catch (error) {
            alert(`Kuch gadbad ho gayi. Error: ${error.message.substring(0, 100)}`);
        } finally {
            downloadBtn.innerText = originalText;
            downloadBtn.disabled = false;
        }
    });

    // ==========================================
    // 🔥 GITHUB VERSION CONTROL CLOUD SAVE API
    // ==========================================

    function encodeBase64Safe(text) {
        const bytes = new TextEncoder().encode(text);
        const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
        return btoa(binString);
    }

    function getToken() {
        let token = localStorage.getItem('gh_canvas_token');
        if (!token) {
            token = prompt("GitHub PAT daal bhai 😏 (repo scope required)");
            if (token) localStorage.setItem('gh_canvas_token', token.trim());
        }
        return token;
    }

    // Modal Handlers
    cloudSaveBtn.addEventListener('click', async () => {
        const codeContent = codeInput.value.trim();
        if (!codeContent) return alert('Save karne ke liye code paste karo pehle!');

        const token = getToken();
        if (!token) return alert('Token ke bina kaam nahi chalega bhai 😭');

        saveModal.classList.add('active');
        await fetchFolders(token);
    });

    closeModalBtn.addEventListener('click', () => saveModal.classList.remove('active'));

    // 1. Fetch Folders
    async function fetchFolders(token) {
        folderListContainer.innerHTML = '<p style="text-align:center; color:#888; font-size:14px;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching folders...</p>';
        try {
            if (!githubUser) {
                const userRes = await fetch('https://api.github.com/user', { headers: { 'Authorization': `Bearer ${token}` } });
                if (!userRes.ok) {
                    localStorage.removeItem('gh_canvas_token');
                    throw new Error("Invalid token bhai, refresh karke wapas daal.");
                }
                const userData = await userRes.json();
                githubUser = userData.login;
            }

            const repoRes = await fetch(`https://api.github.com/repos/${githubUser}/${REPO_NAME}/contents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!repoRes.ok) {
                if (repoRes.status === 404) throw new Error(`Repository '${REPO_NAME}' nahi mili. GitHub pe ek public/private repo bana de is naam se.`);
                throw new Error("GitHub se connect nahi ho paaya.");
            }

            const data = await repoRes.json();
            const folders = data.filter(item => item.type === 'dir');

            if (folders.length === 0) {
                folderListContainer.innerHTML = '<p style="text-align:center; color:#888; font-size:13px; padding: 20px;">Koi project folder nahi hai. Naya banao!</p>';
                return;
            }

            folderListContainer.innerHTML = '';
            folders.forEach(folder => {
                const item = document.createElement('div');
                item.className = 'folder-item';
                item.innerHTML = `
                    <div class="folder-name"><i class="fa-solid fa-folder"></i> ${folder.name}</div>
                    <button class="save-here-btn" onclick="saveToFolder('${folder.name}', this)">Save Here</button>
                `;
                folderListContainer.appendChild(item);
            });

        } catch (error) {
            folderListContainer.innerHTML = `<p style="text-align:center; color:red; font-size:13px;">Error: ${error.message}</p>`;
        }
    }

    // 2. New Folder Button (Creates virtual path)
    newFolderBtn.addEventListener('click', () => {
        const folderName = prompt("Naye project (folder) ka naam batao (e.g., Dashboard_UI):");
        if (!folderName || folderName.trim() === '') return;

        const safeFolderName = folderName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");

        const tempBtn = document.createElement('button');
        saveToFolder(safeFolderName, tempBtn, true);
    });

    // 3. The Brain: Save logic with Version Mapping (v1, v2, v3...)
    window.saveToFolder = async function(folderName, btnElement, isNewFolder = false) {
        const token = getToken();
        const codeContent = codeInput.value.trim();

        if (btnElement.innerText) {
            btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving';
            btnElement.disabled = true;
        }

        try {
            let nextVersion = 1;

            const contentRes = await fetch(`https://api.github.com/repos/${githubUser}/${REPO_NAME}/contents/${folderName}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (contentRes.ok) {
                const files = await contentRes.json();
                let maxVersion = 0;

                files.forEach(f => {
                    const match = f.name.match(/^v(\d+)\.html$/);
                    if (match) {
                        const verNum = parseInt(match[1], 10);
                        if (verNum > maxVersion) maxVersion = verNum;
                    }
                });
                nextVersion = maxVersion + 1;
            } else if (contentRes.status !== 404) {
                throw new Error("Folder contents padhne mein error aayi.");
            }

            const fileName = `v${nextVersion}.html`;
            const filePath = `${folderName}/${fileName}`;
            const base64Content = encodeBase64Safe(codeContent);

            const saveRes = await fetch(`https://api.github.com/repos/${githubUser}/${REPO_NAME}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Added ${fileName} to ${folderName} 🚀`,
                    content: base64Content
                })
            });

            if (!saveRes.ok) throw new Error("Save fail ho gaya bhai 😭");

            if (isNewFolder) {
                alert(`Naya folder '${folderName}' ban gaya aur design '${fileName}' save ho gayi! ✅`);
                fetchFolders(token);
            } else {
                btnElement.innerHTML = 'Saved! ✅';
                btnElement.style.background = '#2e7d32';
                setTimeout(() => {
                    saveModal.classList.remove('active');
                }, 1000);
            }

        } catch (error) {
            alert(`Error: ${error.message}`);
            if (btnElement.innerText) {
                btnElement.innerHTML = 'Save Here';
                btnElement.disabled = false;
            }
        }
    };
});

// ==========================================
// 🔥 PUPPETEER API BACKDOOR (Single + Bulk)
// ==========================================
async function renderSingleSegmentToDataUrl(segmentHtml) {
    window.renderCode(segmentHtml, false);

    // Fonts load hone ka wait
    await document.fonts.ready;

    // External images load hone ka smart wait (max 4s per image)
    const renderArea = document.getElementById('render-area');
    const imgs = Array.from(renderArea.querySelectorAll('img'));
    await Promise.all(
        imgs.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                const timer = setTimeout(resolve, 4000);
                img.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
                img.addEventListener('error', () => { clearTimeout(timer); resolve(); }, { once: true });
            });
        })
    );

    // Tailwind CDN styles + layout paint settle hone ka brief wait
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 350));

    const pixelRatio = 2;
    const originalPadding = renderArea.style.padding;
    const originalTransition = renderArea.style.transition;

    // Transition off karo taaki 48px padding turant apply ho aur edges crop na hon
    renderArea.style.transition = 'none';
    renderArea.style.padding = '48px';
    void renderArea.offsetHeight;

    const rect = renderArea.getBoundingClientRect();

    const canvas = await htmlToImage.toCanvas(renderArea, {
        pixelRatio: pixelRatio,
        backgroundColor: null,
        cacheBust: true,
        useCORS: true,
        canvasWidth: rect.width * pixelRatio,
        canvasHeight: rect.height * pixelRatio,
        style: { transform: 'scale(1)', transformOrigin: 'top left', margin: '0' }
    });

    renderArea.style.padding = originalPadding;
    renderArea.style.transition = originalTransition;

    return canvas.toDataURL('image/png');
}

// Single design (existing scripts ke liye 100% compatible)
window.exportForPuppeteer = async function(htmlContent) {
    return await renderSingleSegmentToDataUrl(htmlContent);
};

// Bulk designs (<next> string ya HTML array dono support karta hai)
window.exportBulkForPuppeteer = async function(input) {
    const segments = Array.isArray(input)
        ? input.map((s) => String(s || '').trim()).filter(Boolean)
        : String(input || '').split(/<next>/i).map((s) => s.trim()).filter(Boolean);

    if (segments.length === 0) {
        throw new Error('Koi valid HTML segment nahi mila.');
    }

    const results = [];
    for (let i = 0; i < segments.length; i++) {
        const dataUrl = await renderSingleSegmentToDataUrl(segments[i]);
        results.push({
            index: i + 1,
            filename: `design-${i + 1}.png`,
            dataUrl
        });
    }
    return results;
};
