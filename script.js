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

    // ---------- Anti-aliasing ONLY ----------
    const styleFix = document.createElement('style');
    styleFix.textContent = `
        #render-area * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    `;
    document.head.appendChild(styleFix);

    // ==========================================
    // 🔧 SHADOW FIX: box-shadow → filter:drop-shadow
    // html-to-image SVG foreignObject mein box-shadow ka blur
    // Chrome renderer skip kar deta hai — isliye solid dikhta hai.
    // Fix: capture se pehle box-shadow hata ke filter:drop-shadow() lagao,
    // capture ke baad wapas restore karo.
    // ==========================================

    function parseShadowLayers(shadowStr) {
        // rgba() ke andar commas hote hain, isliye simple split nahi chalega
        const layers = [];
        let depth = 0, curr = '';
        for (const ch of shadowStr + ',') {
            if (ch === '(') { depth++; curr += ch; }
            else if (ch === ')') { depth--; curr += ch; }
            else if (ch === ',' && depth === 0) {
                const t = curr.trim();
                if (t) layers.push(t);
                curr = '';
            } else { curr += ch; }
        }
        return layers;
    }

    function boxShadowToDropShadow(computedShadow) {
        if (!computedShadow || computedShadow === 'none') return '';
        const layers = parseShadowLayers(computedShadow);
        const drops = [];

        layers.forEach(layer => {
            // inset shadows drop-shadow mein convert nahi hoti
            if (/\binset\b/.test(layer)) return;

            // Browser always normalized format deta hai:
            // "rgba(r, g, b, a) Xpx Ypx BlurPx SpreadPx"
            const colorMatch = layer.match(/rgba?\([^)]+\)/);
            const lengths = [...layer.matchAll(/([-\d.]+px)/g)].map(m => m[0]);

            if (colorMatch && lengths.length >= 2) {
                const x     = lengths[0];
                const y     = lengths[1];
                const blur  = lengths[2] || '0px';
                // lengths[3] = spread — drop-shadow support nahi karta, skip
                drops.push(`drop-shadow(${x} ${y} ${blur} ${colorMatch[0]})`);
            }
        });

        return drops.join(' ');
    }

    function applyExportFix(root) {
        const snapshot = [];
        [root, ...root.querySelectorAll('*')].forEach(el => {
            const computed = getComputedStyle(el).boxShadow;
            if (!computed || computed === 'none') return;

            const dropFilter = boxShadowToDropShadow(computed);
            if (!dropFilter) return;

            // Original inline values save karo (restore ke liye)
            snapshot.push({
                el,
                filter: el.style.filter,
                boxShadow: el.style.boxShadow
            });

            el.style.boxShadow = 'none';
            el.style.filter = el.style.filter
                ? `${el.style.filter} ${dropFilter}`
                : dropFilter;
        });
        return snapshot;
    }

    function revertExportFix(snapshot) {
        snapshot.forEach(({ el, filter, boxShadow }) => {
            el.style.filter    = filter;
            el.style.boxShadow = boxShadow;
        });
    }

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

    function renderCode(code) {
        let cleanedCode = cleanImageUrls(code);
        const clean = DOMPurify.sanitize(cleanedCode, purifyConfig);
        renderArea.innerHTML = clean;
        fixImages();
    }

    codeInput.value = '';
    renderArea.innerHTML = '';

    let debounceTimer;
    codeInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { renderCode(codeInput.value); }, 150);
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

    // ---------- DOWNLOAD LOGIC (Shadow Fix Applied) ----------
    downloadBtn.addEventListener('click', async () => {
        if (renderArea.innerText.trim() === '' && renderArea.children.length === 0)
            return alert('Bhai, pehle kuch code paste karo!');

        fixImages();

        const originalText    = downloadBtn.innerText;
        const originalPadding = renderArea.style.padding;
        let shadowSnapshot    = [];

        downloadBtn.innerText = 'Generating HD Image...';
        downloadBtn.disabled  = true;

        try {
            await document.fonts.ready;
            await new Promise(r => setTimeout(r, 500));

            renderArea.style.padding = '48px';

            // 🔧 box-shadow → filter:drop-shadow (blur fix)
            shadowSnapshot = applyExportFix(renderArea);

            // Styles settle hone do before capture
            await new Promise(r => setTimeout(r, 60));

            const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
            const rect = renderArea.getBoundingClientRect();

            const canvas = await htmlToImage.toCanvas(renderArea, {
                pixelRatio:    pixelRatio,
                backgroundColor: '#ffffff',
                cacheBust:     true,
                useCORS:       true,
                allowTaint:    false,
                skipAutoScale: false,
                canvasWidth:   rect.width  * pixelRatio,
                canvasHeight:  rect.height * pixelRatio,
                style: { transform: 'scale(1)', transformOrigin: 'top left', margin: '0' }
            });

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            const link = document.createElement('a');
            link.download = 'jss-design-canvas-export.png';
            link.href = canvas.toDataURL('image/png');
            link.click();

        } catch (error) {
            alert(`Kuch gadbad ho gayi. Error: ${error.message.substring(0, 100)}`);
        } finally {
            // Always restore — even on error
            revertExportFix(shadowSnapshot);
            renderArea.style.padding = originalPadding;
            downloadBtn.innerText    = originalText;
            downloadBtn.disabled     = false;
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
                const userRes = await fetch('https://api.github.com/user', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
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
                if (repoRes.status === 404)
                    throw new Error(`Repository '${REPO_NAME}' nahi mili. GitHub pe ek public/private repo bana de is naam se.`);
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
                item.dataset.folder = folder.name;
                item.innerHTML = `
                    <div class="folder-name"><i class="fa-solid fa-folder"></i> ${folder.name}</div>
                    <button class="save-here-btn">Save Here</button>
                `;
                folderListContainer.appendChild(item);
            });

        } catch (error) {
            folderListContainer.innerHTML = `<p style="text-align:center; color:red; font-size:13px;">Error: ${error.message}</p>`;
        }
    }

    // Event delegation — no more window.saveToFolder
    folderListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('save-here-btn')) {
            const folderName = e.target.closest('.folder-item').dataset.folder;
            saveToFolder(folderName, e.target);
        }
    });

    // 2. New Folder Button
    newFolderBtn.addEventListener('click', () => {
        const folderName = prompt("Naye project (folder) ka naam batao (e.g., Dashboard_UI):");
        if (!folderName || folderName.trim() === '') return;
        const safeFolderName = folderName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
        const tempBtn = document.createElement('button');
        saveToFolder(safeFolderName, tempBtn, true);
    });

    // 3. Save Logic with Version Mapping (v1, v2, v3...)
    async function saveToFolder(folderName, btnElement, isNewFolder = false) {
        const token = getToken();
        const codeContent = codeInput.value.trim();

        if (btnElement.innerText !== undefined) {
            btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving';
            btnElement.disabled = true;
        }

        try {
            let nextVersion = 1;

            const contentRes = await fetch(
                `https://api.github.com/repos/${githubUser}/${REPO_NAME}/contents/${folderName}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

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

            const saveRes = await fetch(
                `https://api.github.com/repos/${githubUser}/${REPO_NAME}/contents/${filePath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Added ${fileName} to ${folderName} 🚀`,
                        content: base64Content
                    })
                }
            );

            if (!saveRes.ok) throw new Error("Save fail ho gaya bhai 😭");

            if (isNewFolder) {
                alert(`Naya folder '${folderName}' ban gaya aur design '${fileName}' save ho gayi! ✅`);
                const token2 = getToken();
                fetchFolders(token2);
            } else {
                btnElement.innerHTML = 'Saved! ✅';
                btnElement.style.background = '#2e7d32';
                setTimeout(() => {
                    saveModal.classList.remove('active');
                }, 1000);
            }

        } catch (error) {
            alert(`Error: ${error.message}`);
            if (btnElement.innerText !== undefined) {
                btnElement.innerHTML = 'Save Here';
                btnElement.disabled = false;
            }
        }
    }
});
