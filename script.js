// ==========================================
// ⚡ FAST ASSET & FONT CACHE (Shared by Manual + Puppeteer)
// ==========================================
const loadedImageUrlCache = new Set();
let cachedFontEmbedCSS = null;
let cachedFontSignature = null;

function getFontSignature(container) {
    const links = Array.from(container.querySelectorAll('link[rel="stylesheet"]'))
        .map((l) => l.getAttribute('href') || '')
        .sort()
        .join('|');
    const styles = Array.from(container.querySelectorAll('style'))
        .map((s) => s.textContent || '')
        .filter((txt) => /@font-face|@import/i.test(txt))
        .join('|');
    return `${links}::${styles}`;
}

async function waitForInlineStylesheets(container) {
    const links = Array.from(container.querySelectorAll('link[rel="stylesheet"]'));
    if (!links.length) return;
    await Promise.all(
        links.map((link) => {
            if (link.sheet) return Promise.resolve();
            return new Promise((resolve) => {
                const timer = setTimeout(resolve, 3500);
                link.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
                link.addEventListener('error', () => { clearTimeout(timer); resolve(); }, { once: true });
            });
        })
    );
}

function extractBgImageUrls(container) {
    const urls = new Set();
    const elements = container.querySelectorAll('[style*="url"]');
    elements.forEach((el) => {
        const bg = el.style.backgroundImage || el.style.background || '';
        const matches = bg.matchAll(/url\((['"]?)(https?:\/\/[^'")]+)\1\)/gi);
        for (const m of matches) {
            if (m[2]) urls.add(m[2]);
        }
    });
    return Array.from(urls);
}

function preloadImageUrl(url, timeoutMs = 4000) {
    if (!url || loadedImageUrlCache.has(url)) return Promise.resolve();
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const timer = setTimeout(resolve, timeoutMs);
        img.onload = () => {
            clearTimeout(timer);
            loadedImageUrlCache.add(url);
            resolve();
        };
        img.onerror = () => {
            clearTimeout(timer);
            resolve();
        };
        img.src = url;
    });
}

async function waitForAllImages(container) {
    // 1. <img> tags
    const imgTasks = Array.from(container.querySelectorAll('img')).map((img) => {
        if (!img.src) return Promise.resolve();
        if (img.complete && img.naturalWidth > 0) {
            loadedImageUrlCache.add(img.src);
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, 4000);
            img.addEventListener('load', () => {
                clearTimeout(timer);
                loadedImageUrlCache.add(img.src);
                resolve();
            }, { once: true });
            img.addEventListener('error', () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
        });
    });

    // 2. Inline CSS background-image: url(...) (e.g. i.ibb.co)
    const bgTasks = extractBgImageUrls(container).map((url) => preloadImageUrl(url, 4000));

    await Promise.all([...imgTasks, ...bgTasks]);
}

async function getOptimizedFontEmbedCSS(renderArea) {
    await waitForInlineStylesheets(renderArea);
    await document.fonts.ready;

    const currentSig = getFontSignature(renderArea);

    // Same fonts hain toh cached base64 CSS seedha reuse karo (0ms overhead)
    if (cachedFontEmbedCSS !== null && cachedFontSignature === currentSig) {
        return cachedFontEmbedCSS;
    }

    if (typeof htmlToImage !== 'undefined' && typeof htmlToImage.getFontEmbedCSS === 'function') {
        try {
            // Sirf woff2 embed karo taaki purane ttf/eot download na hon
            cachedFontEmbedCSS = await htmlToImage.getFontEmbedCSS(renderArea, {
                preferredFontFormat: 'woff2'
            });
            cachedFontSignature = currentSig;
            return cachedFontEmbedCSS;
        } catch (err) {
            console.warn('Font CSS cache build skipped:', err);
        }
    }

    return undefined;
}

async function captureRenderAreaToCanvas(pixelRatio = 2) {
    const renderArea = document.getElementById('render-area');

    // Fonts aur saari images (<img> + CSS background-image) parallel mein ready karo
    const [fontEmbedCSS] = await Promise.all([
        getOptimizedFontEmbedCSS(renderArea),
        waitForAllImages(renderArea)
    ]);

    // Tailwind CDN styles + layout paint settle hone ka minimal wait
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 80));

    const originalPadding = renderArea.style.padding;
    const originalTransition = renderArea.style.transition;

    try {
        // Transition off karo taaki 48px padding turant apply ho aur edges crop na hon
        renderArea.style.transition = 'none';
        renderArea.style.padding = '48px';
        void renderArea.offsetHeight;

        const rect = renderArea.getBoundingClientRect();

        const canvasOptions = {
            pixelRatio: pixelRatio,
            backgroundColor: null,
            cacheBust: false, // Browser cache reuse hoga (har card par re-download band)
            useCORS: true,
            allowTaint: false,
            skipAutoScale: false,
            preferredFontFormat: 'woff2',
            canvasWidth: rect.width * pixelRatio,
            canvasHeight: rect.height * pixelRatio,
            style: { transform: 'scale(1)', transformOrigin: 'top left', margin: '0' }
        };

        if (fontEmbedCSS) {
            canvasOptions.fontEmbedCSS = fontEmbedCSS;
        }

        let canvas;
        try {
            canvas = await htmlToImage.toCanvas(renderArea, canvasOptions);
        } catch (firstErr) {
            // Rare CORS cache mismatch par sirf tab cacheBust: true ke saath fallback retry
            canvas = await htmlToImage.toCanvas(renderArea, { ...canvasOptions, cacheBust: true });
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        }
        return canvas;
    } finally {
        renderArea.style.padding = originalPadding;
        renderArea.style.transition = originalTransition;
    }
}

// ==========================================
// MAIN APP LOGIC
// ==========================================
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

    // Page load hote hi Inter + FontAwesome fonts ko background mein pre-warm karke cache kar lo
    window.addEventListener('load', () => {
        getOptimizedFontEmbedCSS(renderArea).catch(() => {});
    });

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

    // ---------- DOWNLOAD LOGIC (Fast Bulk Support) ----------
    downloadBtn.addEventListener('click', async () => {
        const fullCode = codeInput.value.trim();
        if (fullCode === '') return alert('Bhai, pehle kuch code paste karo!');

        const htmlSegments = fullCode.split(/<next>/i).map(seg => seg.trim()).filter(seg => seg.length > 0);
        if (htmlSegments.length === 0) return alert('Valid code nahi mila!');

        const originalText = downloadBtn.innerText;
        downloadBtn.disabled = true;

        try {
            const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));

            for (let i = 0; i < htmlSegments.length; i++) {
                downloadBtn.innerText = htmlSegments.length > 1
                    ? `Generating ${i + 1} of ${htmlSegments.length}...`
                    : 'Generating HD Image...';

                window.renderCode(htmlSegments[i], false);
                const canvas = await captureRenderAreaToCanvas(pixelRatio);

                const link = document.createElement('a');
                link.download = htmlSegments.length > 1 ? `jss-design-canvas-export-${i + 1}.png` : 'jss-design-canvas-export.png';
                link.href = canvas.toDataURL('image/png');
                link.click();

                if (i < htmlSegments.length - 1) {
                    await new Promise(r => setTimeout(r, 250));
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

    cloudSaveBtn.addEventListener('click', async () => {
        const codeContent = codeInput.value.trim();
        if (!codeContent) return alert('Save karne ke liye code paste karo pehle!');

        const token = getToken();
        if (!token) return alert('Token ke bina kaam nahi chalega bhai 😭');

        saveModal.classList.add('active');
        await fetchFolders(token);
    });

    closeModalBtn.addEventListener('click', () => saveModal.classList.remove('active'));

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

    newFolderBtn.addEventListener('click', () => {
        const folderName = prompt("Naye project (folder) ka naam batao (e.g., Dashboard_UI):");
        if (!folderName || folderName.trim() === '') return;

        const safeFolderName = folderName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
        const tempBtn = document.createElement('button');
        saveToFolder(safeFolderName, tempBtn, true);
    });

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
// 🔥 PUPPETEER API BACKDOOR (Fast Single + Bulk)
// ==========================================
window.exportForPuppeteer = async function(htmlContent) {
    window.renderCode(htmlContent, false);
    const canvas = await captureRenderAreaToCanvas(2);
    return canvas.toDataURL('image/png');
};

window.exportBulkForPuppeteer = async function(input) {
    const segments = Array.isArray(input)
        ? input.map((s) => String(s || '').trim()).filter(Boolean)
        : String(input || '').split(/<next>/i).map((s) => s.trim()).filter(Boolean);

    if (segments.length === 0) {
        throw new Error('Koi valid HTML segment nahi mila.');
    }

    const results = [];
    for (let i = 0; i < segments.length; i++) {
        window.renderCode(segments[i], false);
        const canvas = await captureRenderAreaToCanvas(2);
        results.push({
            index: i + 1,
            filename: `design-${i + 1}.png`,
            dataUrl: canvas.toDataURL('image/png')
        });
    }
    return results;
};
