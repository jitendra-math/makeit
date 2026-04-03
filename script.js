document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');

    // ---------- Sanitization config (allow modern CSS classes, Tailwind & CORS attributes) ----------
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
            'crossorigin'   // 👈 IMPORTANT: enables CORS images
        ]
    };

    // Function to safely render HTML
    function renderCode(code) {
        const clean = DOMPurify.sanitize(code, purifyConfig);
        renderArea.innerHTML = clean;
    }

    // Textarea khali rakho – koi default code nahi
    codeInput.value = '';
    renderArea.innerHTML = '';  // empty preview

    // Live preview with debounce (150ms)
    let debounceTimer;
    codeInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            renderCode(codeInput.value);
        }, 150);
    });

    // ---------- DOWNLOAD with html-to-image (supports blur, backdrop, gradient text & CORS images) ----------
    downloadBtn.addEventListener('click', async () => {
        // Check if render area has any content
        if (renderArea.innerText.trim() === '' && renderArea.children.length === 0) {
            alert('Bhai, pehle kuch code toh paste karo!');
            return;
        }

        const originalText = downloadBtn.innerText;
        downloadBtn.innerText = 'Generating HD Image...';
        downloadBtn.disabled = true;

        try {
            // Wait for all fonts to load (important for gradient text & custom fonts)
            await document.fonts.ready;

            // Small delay for any CSS transitions/animations to settle
            await new Promise(resolve => setTimeout(resolve, 100));

            // Dynamic pixel ratio: 2x to 3x for HD quality (avoid memory crash on huge elements)
            const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));

            const dataUrl = await htmlToImage.toPng(renderArea, {
                pixelRatio: pixelRatio,
                backgroundColor: null,   // transparent background (wrapper background shows)
                cacheBust: true,
                skipAutoScale: false,
                style: {
                    transform: 'scale(1)',
                    transformOrigin: 'top left'
                }
            });

            // Trigger download
            const link = document.createElement('a');
            link.download = 'design-canvas-export.png';
            link.href = dataUrl;
            link.click();

        } catch (error) {
            console.error('Export Error:', error);
            let errorMsg = 'Kuch gadbad ho gayi image banate waqt.';
            if (error.message && error.message.includes('tainted')) {
                errorMsg = 'Cross-origin images ki wajah se export fail ho raha hai. Apne CDN ya image URLs par CORS enable karo aur img tag mein crossorigin="anonymous" daalo.';
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