document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const renderArea = document.getElementById('render-area');
    const downloadBtn = document.getElementById('download-btn');

    // Live Preview Logic: Jaise hi code likhega, yahan dikhega
    codeInput.addEventListener('input', () => {
        // Note: Production level app mein DOMPurify use karna security ke liye
        renderArea.innerHTML = codeInput.value;
    });

    // High Quality Download Logic
    downloadBtn.addEventListener('click', () => {
        // Agar render area khali hai toh return kardo
        if (renderArea.innerHTML.trim() === '') {
            alert('Bhai, pehle thoda code toh paste karo!');
            return;
        }

        // Button ka text change kardo taaki user ko lage process ho raha hai
        const originalText = downloadBtn.innerText;
        downloadBtn.innerText = 'Generating HD Image...';
        downloadBtn.disabled = true;

        // html2canvas ka magic
        html2canvas(renderArea, {
            scale: 4, // 👈 Yahi trick hai Full HD/4K quality ke liye
            useCORS: true, // External images load karne ke liye
            backgroundColor: null // Transparent background maintain rakhne ke liye
        }).then(canvas => {
            // Canvas ko image URL mein badalna
            const imageURL = canvas.toDataURL('image/png');

            // Ek hidden link banakar usko auto-click karwana download ke liye
            const link = document.createElement('a');
            link.download = 'jss-design-export.png';
            link.href = imageURL;
            link.click();

            // Button ko wapas normal state mein lana
            downloadBtn.innerText = originalText;
            downloadBtn.disabled = false;
        }).catch(error => {
            console.error('Error generating image:', error);
            alert('Kuch gadbad ho gayi image banate waqt.');
            downloadBtn.innerText = originalText;
            downloadBtn.disabled = false;
        });
    });
});
