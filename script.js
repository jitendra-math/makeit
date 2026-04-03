document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');

    // ---------- Helper: Clean image URLs (remove brackets, spaces, etc.) ----------
    function cleanImageUrls(html) {
        // Remove square brackets around src="[...]" 
        // Regex to find src="[http...]" and replace with src="http..."
        const cleaned = html.replace(/src="\[(.*?)\]"/g, 'src="$1"');
        return cleaned;
    }

    // ---------- Helper: Force crossorigin on all images ----------
    function fixImageCrossOrigin() {
        const images = renderArea.querySelectorAll('img');
        images.forEach(img => {
            if (!img.hasAttribute('crossorigin')) {
                img.setAttribute('crossorigin', 'anonymous');
            }
            // Log image URL for debugging
            console.log('Image:', img.src, 'Crossorigin:', img.crossOrigin);
            // Add onerror handler to detect load failures
            img.onerror = () => {
                console.error('Failed to load image:', img.src);
                // Optionally show a placeholder
                img.style.outline = '2px solid red';
            };
        });
    }

    // ---------- Sanitization config (allow all needed attributes) ----------
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
            'stroke-linecap', 'stroke-linejoin',
            'crossorigin', 'onerror'   // onerror for debugging (but won't execute due to DOMPurify? Actually DOMPurify removes event handlers, so better to add via JS)
        ]
    };

    // Function to safely render HTML
    function renderCode(code) {
        // First, clean image URLs (remove brackets)
        let cleanedCode = cleanImageUrls(code);
        // Sanitize
        const clean = DOMPurify.sanitize(cleanedCode, purifyConfig);
        renderArea.innerHTML = clean;
        // After inserting, fix crossorigin attributes
        fixImageCrossOrigin();
    }

    // No default code – textarea khali
    codeInput.value = '';
    renderArea.innerHTML = '';

    // Live preview with debounce
    let debounceTimer;
    codeInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            renderCode(codeInput.value);
        }, 150);
    });

    // ---------- DOWNLOAD with html-to-image (robust CORS handling) ----------
    downloadBtn.addEventListener('click', async () => {
        if (renderArea.innerText.trim() === '' && renderArea.children.length === 0) {
            alert('Bhai, pehle kuch code toh paste karo!');
            return;
        }

        // Ensure all images have crossorigin and wait for them to load (or at least try)
        fixImageCrossOrigin();

        // Wait for all images to load (best effort)
        const images = Array.from(renderArea.querySelectorAll('img'));
        if (images.length > 0) {
            await Promise.all(images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = () => {
                        console.warn('Image failed to load, continuing anyway:', img.src);
                        resolve();
                    };
                });
            }));
        }

        const originalText = downloadBtn.innerText;
        downloadBtn.innerText = 'Generating HD Image...';
        downloadBtn.disabled = true;

        try {
            await document.fonts.ready;
            await new Promise(resolve => setTimeout(resolve, 100));

            const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
            
            // Use html-to-image with CORS settings
            const dataUrl = await htmlToImage.toPng(renderArea, {
                pixelRatio: pixelRatio,
                backgroundColor: null,
                cacheBust: true,
                skipAutoScale: false,
                // Important for CORS images
                useCORS: true,
                allowTaint: false
            });

            const link = document.createElement('a');
            link.download = 'design-canvas-export.png';
            link.href = dataUrl;
            link.click();

        } catch (error) {
            console.error('Export Error:', error);
            let errorMsg = 'Image banate waqt error: ' + (error.message || 'Unknown');
            if (error.message && error.message.includes('tainted')) {
                errorMsg = 'Cross-origin images ki wajah se export fail. Ensure your CDN sends Access-Control-Allow-Origin: * header.';
            }
            alert(errorMsg);
        } finally {
            downloadBtn.innerText = originalText;
            downloadBtn.disabled = false;
        }
    });
});