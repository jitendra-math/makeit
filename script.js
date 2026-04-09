document.addEventListener('DOMContentLoaded', async () => {
    // DOM elements
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');
    const uploadBtn = document.getElementById('upload-image-btn');
    const imageListDiv = document.getElementById('image-list');

    // ---------- IndexedDB Setup ----------
    const DB_NAME = 'AIDesignCanvas';
    const STORE_NAME = 'images';
    let db = null;
    let objectUrlCache = new Map(); // id -> blob URL

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    async function loadAllImages() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function saveImage(id, blob, mimeType) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const record = { id, blob, mimeType };
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async function deleteImageById(id) {
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

    // Short ID generator (A..Z, AA..ZZ)
    function generateShortId(existingIds) {
        const set = new Set(existingIds);
        for (let i = 0; i < 26; i++) {
            const letter = String.fromCharCode(65 + i);
            if (!set.has(letter)) return letter;
        }
        for (let i = 0; i < 26; i++) {
            for (let j = 0; j < 26; j++) {
                const two = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
                if (!set.has(two)) return two;
            }
        }
        let c = 1;
        while (set.has(`ID${c}`)) c++;
        return `ID${c}`;
    }

    // Refresh image grid UI
    async function renderImageGrid() {
        if (!db) return;
        const images = await loadAllImages();
        if (images.length === 0) {
            imageListDiv.innerHTML = `<div class="empty-assets-msg">No assets yet. Upload PNG/JPG/GIF → gets short ID like "A", "B" → use in code as src="$A"</div>`;
            return;
        }
        // generate object URLs if not cached
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

        document.querySelectorAll('.delete-asset').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.getAttribute('data-id');
                await deleteImageById(id);
                await renderImageGrid();
                // re-render preview to remove broken images
                await renderCode(codeInput.value);
            });
        });
    }

    // Upload handler
    uploadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const blob = file.slice(0, file.size, file.type);
            const existing = await loadAllImages();
            const existingIds = existing.map(img => img.id);
            const newId = generateShortId(existingIds);
            await saveImage(newId, blob, file.type);
            await renderImageGrid();
            alert(`✅ Image saved as $${newId}\nUse <img src="$${newId}"> in your code.`);
            // auto re-render so placeholder works if already typed
            await renderCode(codeInput.value);
        };
        input.click();
    });

    // ---------- Replace $ID with blob URL ----------
    async function replacePlaceholders(htmlCode) {
        const regex = /\$([A-Za-z][A-Za-z0-9]*)/g;
        const matches = [...htmlCode.matchAll(regex)];
        if (matches.length === 0) return htmlCode;
        
        const idsNeeded = [...new Set(matches.map(m => m[1]))];
        const allImages = await loadAllImages();
        const idToUrl = new Map();
        for (const img of allImages) {
            if (idsNeeded.includes(img.id)) {
                if (!objectUrlCache.has(img.id)) {
                    const url = URL.createObjectURL(img.blob);
                    objectUrlCache.set(img.id, url);
                }
                idToUrl.set(img.id, objectUrlCache.get(img.id));
            }
        }
        let replaced = htmlCode;
        for (let [id, url] of idToUrl.entries()) {
            const re = new RegExp(`\\$${id}`, 'g');
            replaced = replaced.replace(re, url);
        }
        return replaced;
    }

    // Clean markdown style image URLs
    function cleanImageUrls(html) {
        return html.replace(/src="\[(.*?)\]\(.*?\)"/g, 'src="$1"')
                   .replace(/src='\[(.*?)\]\(.*?\)'/g, 'src="$1"')
                   .replace(/src="\[(.*?)\]"/g, 'src="$1"')
                   .replace(/src='\[(.*?)\]'/g, 'src="$1"');
    }

    function fixCrossOrigin() {
        document.querySelectorAll('#render-area img').forEach(img => {
            if (img.src && img.src.startsWith('http') && !img.crossOrigin) {
                img.setAttribute('crossorigin', 'anonymous');
            }
        });
    }

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

    // Main render function
    async function renderCode(rawCode) {
        if (!rawCode.trim()) {
            renderArea.innerHTML = '';
            return;
        }
        let withUrls = await replacePlaceholders(rawCode);
        withUrls = cleanImageUrls(withUrls);
        const sanitized = DOMPurify.sanitize(withUrls, purifyConfig);
        renderArea.innerHTML = sanitized;
        fixCrossOrigin();
    }

    // Debounced input
    let debounce;
    codeInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
            await renderCode(codeInput.value);
        }, 200);
    });

    // ---------- EXPORT with smart crop ----------
    async function smartCropCanvas(canvas, bgTolerance = 245, margin = 8) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        let minX = w, minY = h, maxX = 0, maxY = 0;
        let has = false;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
                const isNearWhite = (r >= bgTolerance && g >= bgTolerance && b >= bgTolerance);
                const isTransparent = a < 30;
                if (!isNearWhite && !isTransparent) {
                    has = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (!has || minX >= maxX || minY >= maxY) return canvas;
        minX = Math.max(0, minX - margin);
        minY = Math.max(0, minY - margin);
        maxX = Math.min(w, maxX + margin);
        maxY = Math.min(h, maxY + margin);
        const cropped = document.createElement('canvas');
        cropped.width = maxX - minX;
        cropped.height = maxY - minY;
        const cropCtx = cropped.getContext('2d');
        cropCtx.drawImage(canvas, minX, minY, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
        return cropped;
    }

    downloadBtn.addEventListener('click', async () => {
        if (renderArea.innerText.trim() === '' && renderArea.children.length === 0) {
            alert('Bhai, pehle kuch code paste karo ya images upload karo!');
            return;
        }

        // Ensure all images are loaded (especially blob URLs)
        const imgs = Array.from(renderArea.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((res) => { img.onload = () => res(); img.onerror = () => res(); });
        }));

        downloadBtn.innerText = '🎨 Generating...';
        downloadBtn.disabled = true;

        try {
            await document.fonts.ready;
            await new Promise(r => setTimeout(r, 80));
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
            
            const cropped = await smartCropCanvas(canvas, 248, 8);
            const link = document.createElement('a');
            link.download = `design-canvas-${Date.now()}.png`;
            link.href = cropped.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error(err);
            alert('Export error: ' + (err.message || 'unknown'));
        } finally {
            downloadBtn.innerText = '⬇️ Download HD PNG';
            downloadBtn.disabled = false;
        }
    });

    // Initialize DB and default example
    try {
        db = await openDB();
        await renderImageGrid();
        // Example code with placeholder $A (if user uploads image, it will show)
        codeInput.value = `<div class="max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6 text-center">
  <img src="$A" class="w-28 h-28 rounded-full mx-auto shadow-lg mb-4" alt="asset" onerror="this.src='https://placehold.co/112x112?text=Upload+Image'">
  <h2 class="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">AI Canvas Pro</h2>
  <p class="text-gray-500 mt-2">Use <code class="bg-gray-100 px-1">src="$A"</code> to reference uploaded images.</p>
  <button class="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-full shadow-md">Explore</button>
</div>`;
        await renderCode(codeInput.value);
    } catch (err) {
        console.error('Init failed', err);
        alert('IndexedDB not supported? Try in modern browser.');
    }
});