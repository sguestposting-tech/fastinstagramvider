/* ========================================
   INSTAGRAB — Instagram DP Downloader
   Frontend JavaScript (Backend-powered)
   ======================================== */

// --- State ---
let currentImageUrl = '';
let currentOriginalUrl = '';
let currentUsername = '';
let zoomLevel = 1;

// --- Particles ---
function createParticles() {
    const container = document.getElementById('particles');
    const count = window.innerWidth < 768 ? 15 : 30;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = (8 + Math.random() * 12) + 's';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.width = (2 + Math.random() * 3) + 'px';
        particle.style.height = particle.style.width;
        particle.style.background = `hsla(${330 + Math.random() * 60}, 80%, 60%, ${0.2 + Math.random() * 0.3})`;
        container.appendChild(particle);
    }
}

// --- Navigation ---
const allSections = ['downloader', 'history', 'settings'];
function hideAllSections() {
    document.getElementById('downloader').style.display = 'none';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('history').style.display = 'none';
    document.getElementById('settingsPanel').style.display = 'none';
    document.querySelector('.features').style.display = 'none';
}

document.querySelectorAll('.nav-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
        e.preventDefault();
        const section = pill.dataset.section;
        document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        hideAllSections();

        if (section === 'downloader') {
            document.getElementById('downloader').style.display = '';
            const resultSection = document.getElementById('resultSection');
            if (resultSection.classList.contains('show')) resultSection.style.display = '';
            document.querySelector('.features').style.display = '';
        } else if (section === 'history') {
            document.getElementById('history').style.display = '';
            renderHistory();
        } else if (section === 'settings') {
            document.getElementById('settingsPanel').style.display = '';
            checkCookieStatus();
        }
    });
});

// --- Enter Key ---
document.getElementById('usernameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchDP();
});

// --- Toast Notifications ---
function showError(message) {
    const toast = document.getElementById('errorToast');
    document.getElementById('errorMessage').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

function showSuccess(message) {
    const toast = document.getElementById('successToast');
    document.getElementById('successMessage').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- Main Fetch Function (calls our backend) ---
async function fetchDP() {
    const input = document.getElementById('usernameInput');
    const btn = document.getElementById('searchBtn');
    let username = input.value.trim();

    // Clean username — handle @, full URLs
    username = username
        .replace(/^@/, '')
        .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
        .replace(/\/.*$/, '')
        .replace(/\?.*$/, '')
        .trim();

    if (!username) {
        showError('Please enter an Instagram username');
        input.focus();
        return;
    }

    if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
        showError('Invalid username. Use only letters, numbers, dots and underscores');
        return;
    }

    // Loading state
    btn.classList.add('loading');
    btn.disabled = true;
    currentUsername = username;

    try {
        const response = await fetch(`/api/dp/${encodeURIComponent(username)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Could not fetch profile picture');
        }

        // Use proxy URL for display (avoids CORS on images too)
        currentOriginalUrl = data.imageUrl;
        currentImageUrl = `/api/proxy-image?url=${encodeURIComponent(data.imageUrl)}`;

        displayResult(data);
        saveToHistory(data);
        showSuccess(`Profile picture found for @${data.username}!`);

    } catch (error) {
        console.error('Fetch error:', error);
        showError(error.message || 'Could not fetch profile. Please check the username and try again.');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// --- Display Result ---
function displayResult(data) {
    const resultSection = document.getElementById('resultSection');
    const previewAvatar = document.getElementById('previewAvatar');
    const hdImage = document.getElementById('hdImage');
    const displayUsername = document.getElementById('displayUsername');
    const fullscreenImage = document.getElementById('fullscreenImage');
    const resolutionEl = document.getElementById('imageResolution');

    // Use proxied image URL for display
    const proxyUrl = currentImageUrl;

    displayUsername.textContent = `@${data.username}`;

    // Update user meta with real data if available
    const userMeta = document.querySelector('.user-meta');
    const qualityLabel = data.source === 'mobile_api_hd'
        ? `Full HD ${data.imageWidth || 1080}p`
        : 'Standard Quality';
    const qualityColor = data.source === 'mobile_api_hd'
        ? 'border-color: rgba(34,197,94,0.3); color: #86efac; background: rgba(34,197,94,0.1);'
        : 'border-color: rgba(245,158,11,0.3); color: #fbbf24; background: rgba(245,158,11,0.1);';
    let metaHTML = `
        <span class="meta-badge" style="${qualityColor}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            ${qualityLabel}
        </span>
    `;

    if (data.fullName) {
        metaHTML += `
            <span class="meta-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${data.fullName}
            </span>
        `;
    }

    if (data.followers != null) {
        metaHTML += `
            <span class="meta-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                ${formatNumber(data.followers)} followers
            </span>
        `;
    }

    if (data.isPrivate) {
        metaHTML += `
            <span class="meta-badge" style="border-color: rgba(245,158,11,0.3); color: #fbbf24; background: rgba(245,158,11,0.1);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Private Account
            </span>
        `;
    }

    userMeta.innerHTML = metaHTML;

    previewAvatar.src = proxyUrl;
    hdImage.src = proxyUrl;
    fullscreenImage.src = proxyUrl;

    // Show result section with animation
    resultSection.classList.add('show');
    resultSection.style.display = '';

    // Scroll to result
    setTimeout(() => {
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);

    // Get image resolution
    const tempImg = new Image();
    tempImg.onload = function () {
        resolutionEl.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="22" y2="7"/><line x1="2" y1="17" x2="22" y2="17"/></svg>
            <span>${this.naturalWidth} × ${this.naturalHeight} px</span>
        `;
    };
    tempImg.onerror = function () {
        resolutionEl.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/></svg>
            <span>HD Quality</span>
        `;
    };
    tempImg.src = proxyUrl;
}

// --- Format large numbers ---
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// --- Download Image (through backend proxy) ---
function downloadImage() {
    if (!currentOriginalUrl) {
        showError('No image to download. Please search for a user first.');
        return;
    }

    const downloadUrl = `/api/download?url=${encodeURIComponent(currentOriginalUrl)}&username=${encodeURIComponent(currentUsername)}`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${currentUsername}_instagram_dp.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showSuccess('Download started!');
}

// --- Copy Image URL ---
async function copyImageUrl() {
    if (!currentOriginalUrl) {
        showError('No image URL to copy');
        return;
    }

    try {
        await navigator.clipboard.writeText(currentOriginalUrl);
        showSuccess('Image URL copied to clipboard!');
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = currentOriginalUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showSuccess('Image URL copied to clipboard!');
    }
}

// --- Share ---
async function shareImage() {
    if (!currentOriginalUrl) {
        showError('No image to share');
        return;
    }

    if (navigator.share) {
        try {
            await navigator.share({
                title: `@${currentUsername}'s Instagram DP`,
                text: `Check out @${currentUsername}'s Instagram profile picture in HD!`,
                url: `https://www.instagram.com/${currentUsername}/`
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                copyImageUrl();
            }
        }
    } else {
        copyImageUrl();
    }
}

// --- Fullscreen ---
function openFullscreen() {
    if (!currentImageUrl) return;
    const modal = document.getElementById('fullscreenModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    zoomLevel = 1;
    updateZoom();
}

function closeFullscreen() {
    const modal = document.getElementById('fullscreenModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    zoomLevel = 1;
    updateZoom();
}

function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.25, 5);
    updateZoom();
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.25, 0.5);
    updateZoom();
}

function resetZoom() {
    zoomLevel = 1;
    updateZoom();
}

function updateZoom() {
    const wrapper = document.querySelector('.modal-image-wrapper');
    if (wrapper) {
        wrapper.style.transform = `scale(${zoomLevel})`;
    }
}

// Keyboard shortcuts for modal
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('fullscreenModal');
    if (!modal.classList.contains('show')) return;

    switch (e.key) {
        case 'Escape': closeFullscreen(); break;
        case '+': case '=': zoomIn(); break;
        case '-': zoomOut(); break;
        case '0': resetZoom(); break;
    }
});

// --- History (LocalStorage) ---
function getHistory() {
    try {
        return JSON.parse(localStorage.getItem('instagrab_history') || '[]');
    } catch {
        return [];
    }
}

function saveToHistory(data) {
    const history = getHistory();
    const filtered = history.filter(item => item.username !== data.username);

    filtered.unshift({
        username: data.username,
        fullName: data.fullName || null,
        imageUrl: data.imageUrl, // original Instagram URL
        timestamp: Date.now()
    });

    const trimmed = filtered.slice(0, 20);
    localStorage.setItem('instagrab_history', JSON.stringify(trimmed));
}

function renderHistory() {
    const grid = document.getElementById('historyGrid');
    const history = getHistory();
    const emptyEl = document.getElementById('emptyHistory');

    grid.querySelectorAll('.history-item').forEach(el => el.remove());

    if (history.length === 0) {
        emptyEl.style.display = '';
        return;
    }

    emptyEl.style.display = 'none';

    history.forEach(item => {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}`;
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <img src="${proxyUrl}" alt="@${item.username}" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiMxYTFhMmUiLz48dGV4dCB4PSI3NSIgeT0iNzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNTU1NTZhIiBmb250LXNpemU9IjEyIj5FeHBpcmVkPC90ZXh0Pjwvc3ZnPg=='" />
            <div class="history-item-label">@${item.username}</div>
        `;
        div.addEventListener('click', () => {
            currentUsername = item.username;
            currentOriginalUrl = item.imageUrl;
            currentImageUrl = proxyUrl;
            document.getElementById('usernameInput').value = item.username;

            // Switch to downloader view
            document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
            document.querySelector('.nav-pill[data-section="downloader"]').classList.add('active');
            document.getElementById('downloader').style.display = '';
            document.getElementById('history').style.display = 'none';
            document.querySelector('.features').style.display = '';

            // Re-fetch to get fresh URL (Instagram CDN URLs expire)
            fetchDP();
        });
        grid.appendChild(div);
    });
}

function clearHistory() {
    localStorage.removeItem('instagrab_history');
    renderHistory();
    showSuccess('History cleared!');
}

// --- Cookie Management ---
async function checkCookieStatus() {
    try {
        const r = await fetch('/api/cookie-status');
        const d = await r.json();
        const dot = document.getElementById('cookieStatusDot');
        const indicator = document.getElementById('cookieIndicator');
        const text = document.getElementById('cookieStatusText');
        if (d.hasCookies) {
            dot?.classList.add('active');
            indicator?.classList.add('active');
            if (text) text.textContent = '✅ Cookies set — HD mode active!';
        } else {
            dot?.classList.remove('active');
            indicator?.classList.remove('active');
            if (text) text.textContent = '❌ No cookies — sirf small thumbnails milenge';
        }
    } catch {}
}

async function saveCookies() {
    const input = document.getElementById('cookieInput');
    const cookies = input.value.trim();
    if (!cookies) { showError('Cookies paste karo pehle!'); return; }
    try {
        const r = await fetch('/api/set-cookies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies }),
        });
        if (r.ok) {
            showSuccess('Cookies saved! Ab HD images milenge 🔥');
            checkCookieStatus();
        } else {
            showError('Cookies save nahi hue');
        }
    } catch { showError('Server error'); }
}

async function clearCookies() {
    try {
        await fetch('/api/cookies', { method: 'DELETE' });
        document.getElementById('cookieInput').value = '';
        showSuccess('Cookies cleared');
        checkCookieStatus();
    } catch {}
}

function goToSettings() {
    document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('.nav-pill[data-section="settings"]').classList.add('active');
    hideAllSections();
    document.getElementById('settingsPanel').style.display = '';
    checkCookieStatus();
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    checkCookieStatus();
    setTimeout(() => {
        document.getElementById('usernameInput').focus();
    }, 500);
});
