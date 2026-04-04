document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');

    // ---------- Advanced: Clean image URLs (handles markdown-style [url](url) and [url]) ----------
    function cleanImageUrls(html) {
        // Pattern 1: src="[url](url)" -> src="url"
        let cleaned = html.replace(/src="\[(.*?)\]\(.*?\)"/g, 'src="$1"');
        // Pattern 2: src='[url](url)' -> src='url'
        cleaned = cleaned.replace(/src='\[(.*?)\]\(.*?\)'/g, 'src="$1"');
        // Pattern 3: src="[url]" -> src="url"
        cleaned = cleaned.replace(/src="\[(.*?)\]"/g, 'src="$1"');
        // Pattern 4: src='[url]' -> src='url'
        cleaned = cleaned.replace(/src='\[(.*?)\]'/g, 'src="$1"');
        return cleaned;
    }

    // ---------- Helper: Force crossorigin and fix image loading ----------
    function fixImages() {
        const images = renderArea.querySelectorAll('img');
        images.forEach(img => {
            if (!img.hasAttribute('crossorigin')) {
                img.setAttribute('crossorigin', 'anonymous');
            }
            if (!img.src || img.src === '') {
                console.warn('Image with empty src');
                return;
            }
            img.onerror = () => {
                console.error('Failed to load image:', img.src);
                img.style.border = '2px solid red';
            };
            img.onload = () => {
                console.log('Image loaded:', img.src);
            };
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
            'blockquote', 'pre', 'code', 'iframe'
        ],
        ALLOWED_ATTR: [
            'class', 'id', 'style', 'src', 'alt', 'href', 'target', 'rel',
            'width', 'height', 'fill', 'stroke', 'viewBox', 'd', 'cx', 'cy',
            'r', 'rx', 'ry', 'x', 'y', 'type', 'placeholder', 'value',
            'disabled', 'checked', 'selected', 'xmlns', 'transform', 'stroke-width',
            'stroke-linecap', 'stroke-linejoin',
            'crossorigin'
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
        debounceTimer = setTimeout(() => {
            renderCode(codeInput.value);
        }, 150);
    });

    downloadBtn.addEventListener('click', async () => {
        if (renderArea.innerText.trim() === '' && renderArea.children.length === 0) {
            alert('Bhai, pehle kuch code paste karo!');
            return;
        }

        fixImages();

        const images = Array.from(renderArea.querySelectorAll('img'));
        await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = () => {
                    console.warn('Image failed to load:', img.src);
                    resolve();
                };
            });
        }));

        const originalText = downloadBtn.innerText;
        downloadBtn.innerText = 'Generating HD Image...';
        downloadBtn.disabled = true;

        try {
            await document.fonts.ready;
            await new Promise(r => setTimeout(r, 100));

            const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
            const dataUrl = await htmlToImage.toPng(renderArea, {
                pixelRatio: pixelRatio,
                backgroundColor: null,
                cacheBust: true,
                useCORS: true,
                allowTaint: false,
                skipAutoScale: false
            });

            const link = document.createElement('a');
            link.download = 'design-canvas-export.png';
            link.href = dataUrl;
            link.click();

        } catch (error) {
            console.error('Export Error:', error);
            let errorMsg = 'Kuch gadbad ho gayi image banate waqt.';
            if (error.message && (error.message.includes('tainted') || error.message.includes('CORS'))) {
                errorMsg = 'CORS issue: Ensure your CDN sends Access-Control-Allow-Origin header and images have crossorigin="anonymous".';
            } else if (error.message) {
                errorMsg = `Error: ${error.message.substring(0, 100)}`;
            }
            alert(errorMsg);
        } finally {
            downloadBtn.innerText = originalText;
            downloadBtn.disabled = false;
        }
    });
});