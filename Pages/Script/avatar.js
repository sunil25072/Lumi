/* ==========================================================================
   AI Image Forge — avatar.js
   Dynamic Styling Configurations, Gemini AI Prompt Enhancement,
   and Pollinations AI Art Synthesizer
   ========================================================================== */

'use strict';

const API_BASE = 'http://localhost:5001/api';

// State
let enhancedConcepts = null; // Stored concepts returned by Gemini AI
let activeConceptIndex = 0; // Current concept selection
let galleryAvatars = []; // Locally stored historical creations

// DOM Elements
const basicDescription = document.getElementById('basicDescription');

const enhancePromptBtn = document.getElementById('enhancePromptBtn');
const generateAvatarBtn = document.getElementById('generateAvatarBtn');
const downloadAvatarBtn = document.getElementById('downloadAvatarBtn');
const saveGalleryBtn = document.getElementById('saveGalleryBtn');

const enhancedBox = document.getElementById('enhancedBox');
const enhancedText = document.getElementById('enhancedText');
const conceptTabsContainer = document.getElementById('conceptTabsContainer');

const hologramPortal = document.getElementById('hologramPortal');
const hologramPlaceholder = document.getElementById('hologramPlaceholder');
const avatarImg = document.getElementById('avatarImg');
const galleryContainer = document.getElementById('galleryContainer');

/* ── INITIALIZATION ─────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
    // Load historical masterpieces from local storage
    loadLocalGallery();
    
    // Wire buttons
    if (enhancePromptBtn) enhancePromptBtn.addEventListener('click', enhancePromptWithAI);
    if (generateAvatarBtn) generateAvatarBtn.addEventListener('click', triggerImageSynthesis);
    if (downloadAvatarBtn) downloadAvatarBtn.addEventListener('click', downloadAvatarImage);
    if (saveGalleryBtn) saveGalleryBtn.addEventListener('click', saveActiveToLocalGallery);
});

/* ── GEMINI AI PROMPT ENHANCER ──────────────────────────────────────────── */

async function enhancePromptWithAI() {
    const text = basicDescription.value.trim();
    if (!text) {
        showLumiAlert('Please enter a description of your vision first (e.g. "a futuristic tree of life at golden hour").');
        return;
    }

    // Disable button, show loader state
    enhancePromptBtn.classList.add('disabled');
    enhancePromptBtn.setAttribute('disabled', 'true');
    enhancePromptBtn.innerHTML = `
        <div class="loader-spinner" style="width:16px; height:16px; border-width:2px; border-top-color:#fff; margin:0;"></div>
        Expanding...
    `;

    const payload = {
        description: text
    };

    try {
        const res = await fetch(`${API_BASE}/enhance-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error('API server returned an error during enhancement.');
        }

        const data = await res.json();
        enhancedConcepts = data.concepts; // Expects an array of 3 expanded concepts
        
        // Show enhance box
        enhancedBox.classList.remove('hidden');
        
        // Render concept tabs
        conceptTabsContainer.innerHTML = '';
        enhancedConcepts.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.className = `concept-tab ${idx === 0 ? 'active' : ''}`;
            btn.textContent = c.title || `Concept ${idx + 1}`;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.concept-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeConceptIndex = idx;
                enhancedText.textContent = enhancedConcepts[idx].expanded_prompt;
            });
            conceptTabsContainer.appendChild(btn);
        });

        // Set default concept text
        activeConceptIndex = 0;
        enhancedText.textContent = enhancedConcepts[0].expanded_prompt;

        // Scroll config card slightly to bring prompt box in view
        document.querySelector('.config-card').scrollIntoView({ behavior: 'smooth', block: 'end' });

    } catch (e) {
        console.error("Enhancement failed:", e);
        showLumiAlert("Failed to enhance prompt: " + e.message + "\nUsing direct description.");
        
        enhancedBox.classList.remove('hidden');
        conceptTabsContainer.innerHTML = '<button class="concept-tab active">Direct Prompt</button>';
        enhancedConcepts = [{ title: 'Direct Prompt', expanded_prompt: text }];
        activeConceptIndex = 0;
        enhancedText.textContent = text;
    } finally {
        enhancePromptBtn.classList.remove('disabled');
        enhancePromptBtn.removeAttribute('disabled');
        enhancePromptBtn.innerHTML = `
            <svg class="sparkles-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707-.707M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"></path>
            </svg>
            Enhance with Gemini AI
        `;
    }
}

/* ── IMAGE SYNTHESIS ENGINE (POLLINATIONS AI) ────────────────────────────── */

async function triggerImageSynthesis() {
    let promptToUse = '';

    if (enhancedConcepts && enhancedConcepts[activeConceptIndex]) {
        promptToUse = enhancedConcepts[activeConceptIndex].expanded_prompt;
    } else {
        const desc = basicDescription.value.trim();
        if (!desc) {
            showLumiAlert('Please enter a description or enhance it with Gemini first.');
            return;
        }
        promptToUse = desc;
    }

    // Set Hologram Portal Loading State
    hologramPortal.className = 'hologram-portal loading';
    hologramPlaceholder.classList.add('hidden');
    avatarImg.classList.remove('visible');
    
    // Disable synthesis buttons
    generateAvatarBtn.classList.add('disabled');
    generateAvatarBtn.setAttribute('disabled', 'true');
    
    // Construct direct high-performance Pollinations URL
    const seedVal = Math.floor(Math.random() * 100000);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptToUse)}?width=1024&height=1024&seed=${seedVal}&nologo=true&private=true&enhance=false&model=flux`;

    // Create browser Image loader to handle onload transitions smoothly
    const imgLoader = new Image();
    imgLoader.src = pollinationsUrl;
    
    imgLoader.onload = function() {
        avatarImg.src = pollinationsUrl;
        avatarImg.classList.add('visible');
        
        hologramPortal.className = 'hologram-portal success';
        
        // Enable action buttons
        generateAvatarBtn.classList.remove('disabled');
        generateAvatarBtn.removeAttribute('disabled');
        downloadAvatarBtn.classList.remove('disabled');
        downloadAvatarBtn.removeAttribute('disabled');
        saveGalleryBtn.classList.remove('disabled');
        saveGalleryBtn.removeAttribute('disabled');
        
        // Update gallery button state to default
        saveGalleryBtn.textContent = 'Save to Vault';
    };

    imgLoader.onerror = function() {
        console.warn("Direct Pollinations image load failed or rate-limited. Falling back to local secure proxy...");
        
        // Dynamic fallback to local backend secure proxy
        const proxyUrl = `${API_BASE}/proxy-avatar-image?prompt=${encodeURIComponent(promptToUse)}&seed=${seedVal}`;
        
        const fallbackLoader = new Image();
        fallbackLoader.src = proxyUrl;
        
        fallbackLoader.onload = function() {
            avatarImg.src = proxyUrl;
            avatarImg.classList.add('visible');
            hologramPortal.className = 'hologram-portal success';
            
            // Enable action buttons
            generateAvatarBtn.classList.remove('disabled');
            generateAvatarBtn.removeAttribute('disabled');
            downloadAvatarBtn.classList.remove('disabled');
            downloadAvatarBtn.removeAttribute('disabled');
            saveGalleryBtn.classList.remove('disabled');
            saveGalleryBtn.removeAttribute('disabled');
            saveGalleryBtn.textContent = 'Save to Vault';
        };
        
        fallbackLoader.onerror = function() {
            showLumiAlert('Generator service is currently busy. Please try another prompt.');
            hologramPortal.className = 'hologram-portal';
            hologramPlaceholder.classList.remove('hidden');
            
            generateAvatarBtn.classList.remove('disabled');
            generateAvatarBtn.removeAttribute('disabled');
        };
    };
}

/* ── DOWNLOAD & LOCAL GALLERY SYSTEMS ────────────────────────────────────── */

async function downloadAvatarImage() {
    const src = avatarImg.src;
    if (!src) return;

    downloadAvatarBtn.classList.add('disabled');
    downloadAvatarBtn.innerHTML = `Downloading...`;

    try {
        let downloadUrl = src;
        if (src.includes('image.pollinations.ai')) {
            const urlObj = new URL(src);
            const promptPath = urlObj.pathname.split('/prompt/')[1];
            const decodedPrompt = decodeURIComponent(promptPath);
            const seed = urlObj.searchParams.get('seed') || '42';
            
            downloadUrl = `${API_BASE}/proxy-avatar-image?prompt=${encodeURIComponent(decodedPrompt)}&seed=${seed}&download=true`;
        } else {
            downloadUrl = src + '&download=true';
        }
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `Lumi_Masterpiece_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        console.error("Proxy download failed, opening in new tab:", e);
        window.open(src, '_blank');
    } finally {
        downloadAvatarBtn.classList.remove('disabled');
        downloadAvatarBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Masterpiece
        `;
    }
}

// Storing creations in local storage
function saveActiveToLocalGallery() {
    const src = avatarImg.src;
    if (!src || src.includes('placeholder')) return;

    // Check if it already exists
    if (galleryAvatars.some(item => item.url === src)) {
        showLumiAlert('This masterpiece is already saved in your vault.');
        return;
    }

    const newItem = {
        id: Date.now().toString(),
        url: src,
        description: basicDescription.value.trim() || 'AI Generated Art'
    };

    galleryAvatars.unshift(newItem); // Add to the front
    
    // Save to local storage
    localStorage.setItem('lumi_avatars', JSON.stringify(galleryAvatars));
    
    renderLocalGallery();
    
    saveGalleryBtn.classList.add('disabled');
    saveGalleryBtn.setAttribute('disabled', 'true');
    saveGalleryBtn.textContent = 'Saved to Vault';
}

function loadLocalGallery() {
    const local = localStorage.getItem('lumi_avatars');
    if (local) {
        try {
            galleryAvatars = JSON.parse(local);
        } catch (e) {
            galleryAvatars = [];
        }
    }
    renderLocalGallery();
}

function renderLocalGallery() {
    galleryContainer.innerHTML = '';
    
    if (galleryAvatars.length === 0) {
        galleryContainer.innerHTML = `<div class="gallery-empty">Your saved masterpieces will appear here. Try generating one!</div>`;
        return;
    }

    galleryAvatars.forEach(item => {
        const el = document.createElement('div');
        el.className = 'gallery-item';
        
        el.innerHTML = `
            <img src="${item.url}" alt="${esc(item.description)}">
            <button class="gallery-item-delete" title="Delete Creation">✕</button>
        `;
        
        // Click to load image back into portal
        el.addEventListener('click', (e) => {
            if (e.target.classList.contains('gallery-item-delete')) return;
            
            avatarImg.src = item.url;
            avatarImg.classList.add('visible');
            hologramPlaceholder.classList.add('hidden');
            hologramPortal.className = 'hologram-portal success';
            
            // Toggle buttons
            downloadAvatarBtn.classList.remove('disabled');
            downloadAvatarBtn.removeAttribute('disabled');
            saveGalleryBtn.classList.add('disabled');
            saveGalleryBtn.setAttribute('disabled', 'true');
            saveGalleryBtn.textContent = 'Saved to Vault';
        });

        // Delete button click
        const delBtn = el.querySelector('.gallery-item-delete');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteGalleryItem(item.id);
        });

        galleryContainer.appendChild(el);
    });
}

function deleteGalleryItem(id) {
    galleryAvatars = galleryAvatars.filter(item => item.id !== id);
    localStorage.setItem('lumi_avatars', JSON.stringify(galleryAvatars));
    renderLocalGallery();
}

/* ── HELPERS ────────────────────────────────────────────────────────────── */

function esc(s) {
    if (!s) return "";
    return s.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── 3D INTERACTIVE HOLOGRAM PARALLAX SYSTEM ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const portal = document.getElementById('hologramPortal');
    const img = document.getElementById('avatarImg');
    
    if (portal && img) {
        portal.addEventListener('mousemove', (e) => {
            if (!img.classList.contains('visible')) return;
            
            const rect = portal.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            // Dynamic floating parallax and shiny filter response
            img.style.transform = `scale(1.08) translate(${-x / 16}px, ${-y / 16}px) rotateY(${x / 7}deg) rotateX(${-y / 7}deg)`;
            img.style.filter = `brightness(1.02) contrast(1.02) drop-shadow(0 0 25px rgba(99,102,241,0.4))`;
        });
        
        portal.addEventListener('mouseleave', () => {
            img.style.transform = '';
            img.style.filter = '';
        });
    }
});

/* --- CUSTOM GLOBAL MODAL ALERT --- */
window.showLumiAlert = function(message) {
    const existing = document.getElementById('lumi-custom-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'lumi-custom-modal';
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: '9999', backdropFilter: 'blur(4px)', opacity: '0', transition: 'opacity 0.2s ease'
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: 'var(--bg-card, #1E1E2E)', color: 'var(--text-color, #FFF)', padding: '24px',
        borderRadius: '16px', maxWidth: '400px', width: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        border: '1px solid var(--border-color, #333)', textAlign: 'center',
        transform: 'translateY(20px)', transition: 'transform 0.2s ease'
    });

    const text = document.createElement('p');
    text.textContent = message;
    text.style.margin = '0 0 20px 0'; text.style.fontSize = '1.1rem'; text.style.lineHeight = '1.5';

    const btn = document.createElement('button');
    btn.textContent = 'Got it';
    Object.assign(btn.style, {
        background: 'var(--primary-color, #6366F1)', color: '#FFF', border: 'none', padding: '10px 24px',
        borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', transition: 'background 0.2s ease'
    });

    btn.onmouseover = () => btn.style.filter = 'brightness(1.2)';
    btn.onmouseout = () => btn.style.filter = 'none';

    btn.onclick = () => {
        modal.style.opacity = '0';
        box.style.transform = 'translateY(20px)';
        setTimeout(() => modal.remove(), 200);
    };

    box.appendChild(text);
    box.appendChild(btn);
    modal.appendChild(box);
    document.body.appendChild(modal);

    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });
};
