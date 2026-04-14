document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const cloudSaveBtn = document.getElementById('cloud-save-btn'); // Naya Button

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
            'link', 'style' 
        ],
        ALLOWED_ATTR: [
            'class', 'id', 'style', 'src', 'alt', 'href', 'target', 'rel',
            'width', 'height', 'fill', 'stroke', 'viewBox', 'd', 'cx', 'cy',
            'r', 'rx', 'ry', 'x', 'y', 'type', 'placeholder', 'value',
            'disabled', 'checked', 'selected', 'xmlns', 'transform', 'stroke-width',
            'stroke-linecap', 'stroke-linejoin',
            'crossorigin', 
            'integrity', 'referrerpolicy' 
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

    // ---------- GITHUB CLOUD SAVE LOGIC ----------
    
    // UTF-8 Safe Base64 Encoding
    function encodeBase64Safe(text) {
        const bytes = new TextEncoder().encode(text);
        const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
        return btoa(binString);
    }

    cloudSaveBtn.addEventListener('click', async () => {
        const codeContent = codeInput.value.trim();
        
        if (!codeContent) {
            alert('Bhai, save karne ke liye pehle kuch design code paste karo!');
            return;
        }

        let githubToken = localStorage.getItem('gh_canvas_token');
        
        if (!githubToken) {
            githubToken = prompt("Apna GitHub PAT (Personal Access Token) enter karo.\n'repo' scope tick hona zaroori hai:");
            if (!githubToken) return;
            localStorage.setItem('gh_canvas_token', githubToken.trim());
        }

        const originalText = cloudSaveBtn.innerHTML;
        cloudSaveBtn.innerHTML = 'Saving... ⏳';
        cloudSaveBtn.disabled = true;

        try {
            // Fetch User Data to get username automatically
            const userRes = await fetch('https://api.github.com/user', {
                headers: { 
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!userRes.ok) {
                localStorage.removeItem('gh_canvas_token');
                throw new Error("Invalid Token. Puraana token delete kar diya hai, dobara click karke naya daalo.");
            }

            const userData = await userRes.json();
            const username = userData.login;
            const repoName = "My-Canvas-Designs"; // Apne GitHub pe yeh repo bana lena!

            // Generate unique filename
            const randomId = Math.random().toString(36).substring(2, 8);
            const fileName = `design_${Date.now()}_${randomId}.html`;
            
            const base64Content = encodeBase64Safe(codeContent);

            // Upload directly to GitHub
            const saveRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/${fileName}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Canvas save: ${fileName} 🚀`,
                    content: base64Content
                })
            });

            if (!saveRes.ok) {
                const errData = await saveRes.json();
                if (errData.message.includes("Not Found")) {
                    throw new Error(`'${repoName}' repository nahi mili! GitHub par ek naya khali repo banao.`);
                }
                throw new Error(errData.message);
            }

            // Success feedback
            cloudSaveBtn.innerHTML = 'Saved! ✅';
            cloudSaveBtn.style.backgroundColor = '#e8f5e9';
            cloudSaveBtn.style.borderColor = '#c8e6c9';
            cloudSaveBtn.style.color = '#2e7d32';

        } catch (error) {
            console.error("Cloud Save Error:", error);
            alert(`Error: ${error.message}`);
            cloudSaveBtn.innerHTML = '<i class="fa-brands fa-github"></i> Failed';
        } finally {
            setTimeout(() => {
                // Reset button to original state
                cloudSaveBtn.innerHTML = '<i class="fa-brands fa-github"></i> Save to Cloud';
                cloudSaveBtn.style.backgroundColor = '#fafbfc';
                cloudSaveBtn.style.borderColor = '#d1d5da';
                cloudSaveBtn.style.color = '#24292e';
                cloudSaveBtn.disabled = false;
            }, 3000);
        }
    });
});
