document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');

    // ---------- DEFAULT EXAMPLE (Farmer Loan Poster with blur + gradient text) ----------
    const defaultCode = `<div class="relative w-[800px] h-[1200px] overflow-hidden bg-gradient-to-br from-sky-50 via-teal-50 to-emerald-100 font-sans flex flex-col items-center text-slate-800">
<div class="absolute -top-40 -right-40 w-[30rem] h-[30rem] bg-amber-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-40"></div>
<div class="absolute top-60 -left-20 w-[24rem] h-[24rem] bg-emerald-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-30"></div>
<div class="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-emerald-600/10 to-transparent"></div>

<div class="relative z-10 w-[90%] mt-12 bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-white/80 p-10 flex flex-col items-center text-center">
    <div class="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 rounded-full font-bold text-xl mb-6 shadow-sm border border-amber-200/50">
        <span>🌾</span> किसानों के लिए सुनहरा अवसर!
    </div>
    
    <h1 class="text-[2.75rem] font-extrabold text-slate-700 tracking-tight mb-2 leading-none">
        समय पर ऋण चुकाएं
    </h1>
    
    <div class="text-[4.5rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 drop-shadow-sm mb-6 leading-tight">
        पाएं 7% ब्याज की छूट!
    </div>
    
    <p class="text-2xl font-bold text-slate-600 leading-snug max-w-[90%]">
        अब समय पर फसल ऋण चुकाने पर मिलेगा <br/>
        <span class="text-emerald-600 border-b-4 border-amber-400 pb-1">ब्याज मुक्त ऋण</span> का लाभ
    </p>
</div>

<div class="relative z-10 w-[80%] mt-8 bg-gradient-to-r from-emerald-700 to-teal-800 text-white rounded-[2rem] shadow-[0_20px_50px_rgba(4,120,87,0.25)] p-8 flex items-center justify-center gap-8 border border-emerald-500/30 transform transition-transform hover:scale-[1.02]">
    <div class="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
        <svg class="w-12 h-12 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
    </div>
    <div class="flex flex-col text-left">
        <span class="text-emerald-200 text-xl font-bold uppercase tracking-widest mb-1">अंतिम तिथि</span>
        <span class="text-5xl font-black tracking-wide drop-shadow-md">31 मार्च 2026</span>
    </div>
</div>

<div class="relative z-10 w-[90%] mt-8 grid grid-cols-5 gap-6">
    
    <div class="col-span-3 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/80 p-8 flex flex-col justify-between">
        <ul class="space-y-6 mt-2">
            <li class="flex items-center gap-5">
                <div class="bg-gradient-to-br from-emerald-100 to-emerald-200 p-3 rounded-full text-emerald-700 shadow-inner">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span class="text-2xl font-bold text-slate-700">ब्याज की बचत करें</span>
            </li>
            <li class="flex items-center gap-5">
                <div class="bg-gradient-to-br from-emerald-100 to-emerald-200 p-3 rounded-full text-emerald-700 shadow-inner">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span class="text-2xl font-bold text-slate-700">आसानी से नया ऋण प्राप्त करें</span>
            </li>
            <li class="flex items-center gap-5">
                <div class="bg-gradient-to-br from-emerald-100 to-emerald-200 p-3 rounded-full text-emerald-700 shadow-inner">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span class="text-2xl font-bold text-slate-700">अपनी साख (क्रेडिट) मजबूत बनाएं</span>
            </li>
        </ul>
        
        <div class="mt-8 bg-red-50 border-l-[6px] border-red-500 p-5 rounded-r-2xl rounded-l-md">
            <p class="text-red-700 font-bold text-lg flex items-start gap-3 leading-snug">
                <svg class="w-7 h-7 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                ध्यान दें: निर्धारित तिथि के बाद यह लाभ उपलब्ध नहीं होगा
            </p>
        </div>
    </div>

    <div class="col-span-2 relative flex items-center justify-center h-full">
        <div class="absolute w-56 h-56 bg-gradient-to-br from-amber-200 to-emerald-200 rounded-full blur-2xl opacity-70"></div>
        
        <div class="relative w-full h-full flex items-center justify-center">
            <div class="absolute z-30 transform -translate-y-16 translate-x-8 rotate-[8deg] bg-white p-5 rounded-[2rem] shadow-2xl border border-slate-100 text-7xl flex items-center justify-center">
                👨🏽‍🌾
            </div>
            <div class="absolute z-20 transform translate-y-12 -translate-x-12 -rotate-[12deg] bg-white p-5 rounded-[2rem] shadow-2xl border border-slate-100 text-6xl flex items-center justify-center">
                🚜
            </div>
            <div class="absolute z-10 transform -translate-y-20 -translate-x-12 rotate-[-6deg] bg-white/90 p-4 rounded-3xl shadow-xl border border-slate-100 text-5xl flex items-center justify-center backdrop-blur-sm">
                🏦
            </div>
            <div class="absolute z-40 transform translate-y-20 translate-x-14 rotate-[15deg] bg-gradient-to-br from-green-100 to-emerald-200 p-4 rounded-full shadow-lg border-2 border-white text-5xl flex items-center justify-center">
                ₹
            </div>
        </div>
    </div>
</div>

<div class="absolute bottom-0 inset-x-0 z-20 bg-emerald-950 text-white rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.3)] pt-12 pb-10 px-10 flex flex-col items-center justify-center text-center">
    
    <div class="absolute -top-7 bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-950 px-10 py-4 rounded-full font-extrabold text-xl shadow-xl border-4 border-emerald-950 flex items-center gap-3">
        <span class="text-2xl">🌟</span> समय पर भुगतान करें - खुशहाल किसान बनें!
    </div>
    
    <p class="text-[1.65rem] font-medium leading-relaxed text-emerald-50 w-[95%]">
        ऋण भुगतान के लिए अपनी 
        <span class="font-bold text-amber-400 border-b border-amber-400/50 pb-0.5">ग्राम सेवा सहकारी समिति</span> 
        अथवा 
        <span class="font-bold text-amber-400 border-b border-amber-400/50 pb-0.5">बैंक की शाखा</span> 
        में सम्पर्क करें
    </p>
</div>

</div>`;

    // ---------- Sanitization config (allow modern CSS classes & Tailwind) ----------
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
            'stroke-linecap', 'stroke-linejoin'
        ]
    };

    // Function to safely render
    function renderCode(code) {
        const clean = DOMPurify.sanitize(code, purifyConfig);
        renderArea.innerHTML = clean;
    }

    // Set default code on load
    codeInput.value = defaultCode;
    renderCode(defaultCode);

    // Live preview with debounce (150ms)
    let debounceTimer;
    codeInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            renderCode(codeInput.value);
        }, 150);
    });

    // ---------- DOWNLOAD with html-to-image (supports blur, backdrop, gradient text) ----------
    downloadBtn.addEventListener('click', async () => {
        // Check if render area has any content
        if (renderArea.innerText.trim() === '' && renderArea.children.length === 0) {
            alert('Bhai, pehle thoda code toh paste karo ya default example use karo!');
            return;
        }

        const originalText = downloadBtn.innerText;
        downloadBtn.innerText = 'Generating HD Image...';
        downloadBtn.disabled = true;

        try {
            // Wait for all fonts to load (important for gradient text & custom fonts)
            await document.fonts.ready;

            // Optional: small delay for any CSS transitions/animations to settle
            await new Promise(resolve => setTimeout(resolve, 100));

            // Use html-to-image with high pixel ratio
            const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1)); // between 2 and 3
            const dataUrl = await htmlToImage.toPng(renderArea, {
                pixelRatio: pixelRatio,
                backgroundColor: null,   // keep transparent (wrapper background will show)
                cacheBust: true,
                skipAutoScale: false,
                style: {
                    transform: 'scale(1)',
                    transformOrigin: 'top left'
                }
            });

            // Download
            const link = document.createElement('a');
            link.download = 'design-canvas-export.png';
            link.href = dataUrl;
            link.click();

        } catch (error) {
            console.error('Export Error:', error);
            let errorMsg = 'Kuch gadbad ho gayi image banate waqt.';
            if (error.message && error.message.includes('tainted')) {
                errorMsg = 'Cross-origin images ki wajah se export fail ho raha hai. Images same domain ya CORS enabled server se load karo.';
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