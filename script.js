document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');
    const pasteBtn = document.getElementById('paste-btn');

    // ---------- FIX: Anti-aliasing ONLY (No forced shadows) ----------
    const styleFix = document.createElement('style');
    styleFix.textContent = `
        #render-area * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    `;
    document.head.appendChild(styleFix);

    // ---------- Helper: Clean image URLs (handles [url](url) and [url]) ----------
    function cleanImageUrls(html) {
        let cleaned = html.replace(/src="\[(.*?)\]\(.*?\)"/g, 'src="$1"');
        cleaned = cleaned.replace(/src='\[(.*?)\]\(.*?\)'/g, 'src="$1"');
        cleaned = cleaned.replace(/src="\[(.*?)\]"/g, 'src="$1"');
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
            'blockquote', 'pre', 'code', 'iframe',
            // --- FIX FOR TESTING ---
            'link', 'style' // Allows FontAwesome CDN to be pasted directly in textarea
        ],
        ALLOWED_ATTR: [
            'class', 'id', 'style', 'src', 'alt', 'href', 'target', 'rel',
            'width', 'height', 'fill', 'stroke', 'viewBox', 'd', 'cx', 'cy',
            'r', 'rx', 'ry', 'x', 'y', 'type', 'placeholder', 'value',
            'disabled', 'checked', 'selected', 'xmlns', 'transform', 'stroke-width',
            'stroke-linecap', 'stroke-linejoin',
            'crossorigin', 
            // --- FIX FOR TESTING ---
            'integrity', 'referrerpolicy' // Required for secure CDN links
        ]
    };

    function renderCode(code) {
        let cleanedCode = cleanImageUrls(code);
        const clean = DOMPurify.sanitize(cleanedCode, purifyConfig);
        renderArea.innerHTML = clean;
        fixImages();
    }

    // No default code
    codeInput.value = '';
    renderArea.innerHTML = '';

    let debounceTimer;
    codeInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            renderCode(codeInput.value);
        }, 150);
    });

    // ---------- PASTE BUTTON LOGIC ----------
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
        } catch (err) {
            console.error('Failed to read clipboard: ', err);
            alert('Bhai, browser ko clipboard permission deni padegi (Allow pe click karna).');
        }
    });

    // ---------- DOWNLOAD LOGIC ----------
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
                img.onerror = () => resolve();
            });
        }));

        const originalText = downloadBtn.innerText;
        downloadBtn.innerText = 'Generating HD Image...';
        downloadBtn.disabled = true;

        try {
            await document.fonts.ready;
            // Extra delay given for external fonts to properly render before canvas captures them
            await new Promise(r => setTimeout(r, 500)); 

            const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
            const originalPadding = renderArea.style.padding;
            renderArea.style.padding = '48px'; 
            
            const rect = renderArea.getBoundingClientRect();
            const captureWidth = rect.width;
            const captureHeight = rect.height;

            const canvas = await htmlToImage.toCanvas(renderArea, {
                pixelRatio: pixelRatio,
                backgroundColor: '#ffffff',
                cacheBust: true,
                useCORS: true, 
                allowTaint: false,
                skipAutoScale: false,
                canvasWidth: captureWidth * pixelRatio,
                canvasHeight: captureHeight * pixelRatio,
                style: {
                    transform: 'scale(1)',
                    transformOrigin: 'top left',
                    margin: '0',
                }
            });

            renderArea.style.padding = originalPadding;

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'jss-design-canvas-export.png';
            link.href = dataUrl;
            link.click();

        } catch (error) {
            console.error('Export Error:', error);
            alert(`Kuch gadbad ho gayi. Error: ${error.message.substring(0, 100)}`);
        } finally {
            downloadBtn.innerText = originalText;
            downloadBtn.disabled = false;
        }
    });
});
