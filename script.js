document.addEventListener('DOMContentLoaded', async () => {
    // ---------- DOM Elements ----------
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');
    const uploadBtn = document.getElementById('upload-image-btn');
    const imageListDiv = document.getElementById('image-list');

    // ---------- IndexedDB Setup ----------
    const DB_NAME = 'AIDesignCanvas';
    const STORE_NAME = 'images';
    let db = null;

    // Cache for object URLs (id -> blob url)
    let objectUrlCache = new Map();

    // Helper: open DB
    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('id', 'id', { unique: true });
                }
            };
        });
    }

    // Load all images from DB
    async function loadAllImages() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Save image (id, blob, mime)
    async function saveImage(id, blob, mimeType) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const record = { id, blob, mimeType, name: `${id}.png` };
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Delete image by id
    async function deleteImage(id) {
        // revoke object URL if exists
        if (objectUrlCache.has(id)) {
            URL.revokeObjectURL(objectUrlCache.get(id));
            objectUrlCache.delete(id);
        }
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ---------- Short ID Generator (A, B, C ... Z, AA, AB ...) ----------
    function generateShortId(existingIds) {
        const usedSet = new Set(existingIds);
        // Try A-Z
        for (let i = 0; i < 26; i++) {
            const letter = String.fromCharCode(65 + i);
            if (!usedSet.has(letter)) return letter;
        }
        // Then AA, AB ... ZZ
        for (let i = 0; i < 26; i++) {
            for (let j = 0; j < 26; j++) {
                const twoLetter = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
                if (!usedSet.has(twoLetter)) return twoLetter;
            }
        }
        // fallback (should never happen)
        let counter = 1;
        while (usedSet.has(`ID${counter}`)) counter++;
        return `ID${counter}`;
    }

    // ---------- Render Image Grid ----------
    async function renderImageGrid() {
        if (!db) return;
        const images = await loadAllImages();
        if (images.length === 0) {
            imageListDiv.innerHTML = `<div class="empty-assets-msg">No assets yet. Upload PNG/JPG/GIF → gets short ID like "A", "B" → use in code as src="$A"</div>`;
            return;
        }
        // generate object URLs for each (if not cached)
        for (const img of images) {
            if (!objectUrlCache.has(img.id)) {
                const url = URL.createObjectURL(img.blob);
                objectUrlCache.set(img.id, url);
            }
        }
        const html = images.map(img => `
            <div class="image-card" data-id="${img.id}">
                <img src="${objectUrlCache.get(img.id)}" alt="${img.id}">
                <div class="image-id">$${img.id}</div>
                <button class="delete-asset" data-id="${img.id}">🗑 Delete</button>
            </div>
        `).join('');
        imageListDiv.innerHTML = html;

        // attach delete events
        document.querySelectorAll('.delete-asset').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                await deleteImage(id);
                await renderImageGrid();
                // re-render preview because image might be gone
                renderCode(codeInput.value);
            });
        });
    }

    // ---------- Upload Image Handler ----------
    uploadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';
        input.multiple = false;
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            // read as blob
            const blob = file.slice(0, file.size, file.type);
            // get existing ids
            const existingImages = await loadAllImages();
            const existingIds = existingImages.map(img => img.id);
            const newId = generateShortId(existingIds);
            await saveImage(newId, blob, file.type);
            await renderImageGrid();
            // optional: show toast
            alert(`✅ Image saved with ID: $${newId}\nUse <img src="$${newId}"> in your code.`);
        };
        input.click();
    });

    // ---------- Helper: Replace $ID placeholders with actual blob URLs ----------
    async function replacePlaceholdersWithBlobUrls(htmlCode) {
        // match $A, $B, $AA, $AB etc. (alphanumeric but starting with letter)
        const regex = /\$([A-Za-z][A-Za-z0-9]*)/g;
        let match;
        const idsToFetch = new Set();
        while ((match = regex.exec(htmlCode)) !== null) {
            idsToFetch.add(match[1]);
        }
        if (idsToFetch.size === 0) return htmlCode;

        // fetch all images from DB
        const allImages = await loadAllImages();
        const idToBlobUrl = new Map();
        for (const img of allImages) {
            if (idsToFetch.has(img.id)) {
                if (!objectUrlCache.has(img.id)) {
                    const url = URL.createObjectURL(img.blob);
                    objectUrlCache.set(img.id, url);
                }
                idToBlobUrl.set(img.id, objectUrlCache.get(img.id));
            }
        }
        // replace each $ID with actual blob URL
        let replaced = htmlCode;
        for (let [id, url] of idToBlobUrl.entries()) {
            const regexGlobal = new RegExp(`\\$${id}`, 'g');
            replaced = replaced.replace(regexGlobal, url);
        }
        return replaced;
    }

    // ---------- Render Code with placeholder resolution ----------
    async function renderCode(rawCode) {
        if (!rawCode.trim()) {
            renderArea.innerHTML = '';
            return;
        }
        // Step 1: replace $ID with blob URLs
        let withUrls = await replacePlaceholdersWithBlobUrls(rawCode);
        
        // Step 2: clean any markdown image syntax
        withUrls = cleanImageUrls(withUrls);
        
        // Step 3: sanitize
        const sanitized = DOMPurify.sanitize(withUrls, purifyConfig);
        renderArea.innerHTML = sanitized;
        
        // Step 4: fix crossorigin for any external images
        fixImagesCrossOrigin();
    }

    // ---------- Helper: Clean [url](url) patterns ----------
    function cleanImageUrls(html) {
        let cleaned = html.replace(/src="\[(.*?)\]\(.*?\)"/g, 'src="$1"');
        cleaned = cleaned.replace(/src='\[(.*?)\]\(.*?\)'/g, 'src="$1"');
        cleaned = cleaned.replace(/src="\[(.*?)\]"/g, 'src="$1"');
        cleaned = cleaned.replace(/src='\[(.*?)\]'/g, 'src="$1"');
        return cleaned;
    }

    function fixImagesCrossOrigin() {
        const images = renderArea.querySelectorAll('img');
        images.forEach(img => {
            if (!img.hasAttribute('crossorigin') && img.src && img.src.startsWith('http')) {
                img.setAttribute('crossorigin', 'anonymous');
            }
        });
    }

    // DOMPurify config
    const purifyConfig = {
        ALLOWED_TAGS: [
            'div', 'span', 'h1', 'h2', 'h3', 'h4', 'p', 'a', 'img', 'button',
            'svg', 'path', 'circle', 'rect', 'ul', 'li', 'section', 'header',
            'footer', 'main', 'article', 'nav', 'aside', 'form', 'input',
            'label', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'br', 'hr',
            'strong', 'em', 'b', 'i', 'u', 'small', 'mark', 'figure', 'figcaption',
            'blockquote', 'pre', 'code', 'iframe'
        ],
        ALLOWED_ATTR: [
            'class', 'id', 'style', 'src', 'alt', 'href', 'target', 'rel',
            'width', 'height', 'fill', 'stroke', 'viewBox', 'd', 'cx', 'cy',
            'r', 'rx', 'ry', 'x', 'y', 'type', 'placeholder', 'value',
            'disabled', 'checked', 'selected', 'xmlns', 'transform', 'stroke-width',
            'stroke-linecap', 'stroke-linejoin', 'crossorigin'
        ]
    };

    // ---------- Debounced input ----------
    let debounceTimer;
    codeInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            await renderCode(codeInput.value);
        }, 200);
    });

    // ---------- EXPORT with smart crop ----------
    async function smartCropCanvas(originalCanvas, bgTolerance = 245, margin = 6) {
        const ctx = originalCanvas.getContext('2d');
        const w = originalCanvas.width, h = originalCanvas.height;
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        let minX = w, minY = h, maxX = 0, maxY = 0;
        let hasContent = false;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
                const isNearWhite = (r >= bgTolerance && g >= bgTolerance && b >= bgTolerance);
                const isTransparent = a < 30;
                if (!isNearWhite && !isTransparent) {
                    hasContent = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (!hasContent || minX >= maxX || minY >= maxY) return originalCanvas;
        minX = Math.max(0, minX - margin);
        minY = Math.max(0, minY - margin);
        maxX = Math.min(w, maxX + margin);
        maxY = Math.min(h, maxY + margin);
        const cropW = maxX - minX, cropH = maxY - minY;
        const cropped = document.createElement('canvas');
        cropped.width = cropW;
        cropped.height = cropH;
        const cropCtx = cropped.getContext('2d');
        cropCtx.drawImage(originalCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
        return cropped;
    }

    downloadBtn.addEventListener('click', async () => {
        if (renderArea.innerText.trim() === '' && renderArea.children.length === 0) {
            alert('Bhai, pehle kuch code paste karo ya images upload karo!');
            return;
        }
        // ensure all images loaded (especially blob URLs)
        const images = Array.from(renderArea.querySelectorAll('img'));
        await Promise.all(images.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
            });
        }));
        
        const originalText = downloadBtn.innerText;
        downloadBtn.innerText = '🎨 Generating...';
        downloadBtn.disabled = true;
        
        try {
            await document.fonts.ready;
            await new Promise(r => setTimeout(r, 100));
            const originalPadding = renderArea.style.padding;
            renderArea.style.padding = '48px';
            const captureWidth = renderArea.scrollWidth;
            const captureHeight = renderArea.scrollHeight;
            const pixelRatio = Math.min(2.5, Math.max(1.8, window.devicePixelRatio || 1));
            
            const canvas = await htmlToImage.toCanvas(renderArea, {
                pixelRatio: pixelRatio,
                backgroundColor: '#ffffff',
                cacheBust: true,
                useCORS: true,
                allowTaint: false,
                canvasWidth: captureWidth * pixelRatio,
                canvasHeight: captureHeight * pixelRatio,
            });
            renderArea.style.padding = originalPadding;
            
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            const croppedCanvas = await smartCropCanvas(canvas, 248, 8);
            const dataUrl = croppedCanvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `ai-canvas-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error(err);
            alert('Export error: ' + (err.message || 'unknown'));
        } finally {
            downloadBtn.innerText = originalText;
            downloadBtn.disabled = false;
        }
    });

    // ---------- INITIALIZE ----------
    try {
        db = await openDB();
        await renderImageGrid();
        // set default example code with placeholder $A (if user uploads, it will work)
        codeInput.value = `<div class="max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6 text-center">
  <img src="$A" class="w-28 h-28 rounded-full mx-auto shadow-lg mb-4" alt="asset">
  <h2 class="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">AI Canvas Pro</h2>
  <p class="text-gray-500 mt-2">Use <code class="bg-gray-100 px-1">src="$A"</code> to reference uploaded images.</p>
  <button class="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-full shadow-md">Explore</button>
</div>`;
        await renderCode(codeInput.value);
    } catch (err) {
        console.error('DB init failed', err);
        alert('IndexedDB not supported?');
    }
});