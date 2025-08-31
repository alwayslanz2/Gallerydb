// Konstanta aplikasi
const GITHUB_API_BASE = 'https://api.github.com';
const REPO_NAME = 'github-media-gallery';
const REPO_DESCRIPTION = 'Repository untuk menyimpan media dari GitHub Media Gallery';

// State aplikasi
let currentUser = null;
let selectedFiles = [];
let mediaType = 'image';
let mediaItems = [];

// Elemen DOM
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const logoutBtn = document.getElementById('logout-btn');
const userNameSpan = document.getElementById('user-name');
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const galleryGrid = document.getElementById('gallery-grid');
const mediaModal = document.getElementById('media-modal');
const closeModal = document.querySelector('.close-modal');
const mediaContainer = document.getElementById('media-container');
const mediaFilename = document.getElementById('media-filename');
const mediaDate = document.getElementById('media-date');
const mediaLink = document.getElementById('media-link');
const filterButtons = document.querySelectorAll('.filter-btn');

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);

loginTab.addEventListener('click', () => switchAuthTab('login'));
registerTab.addEventListener('click', () => switchAuthTab('register'));
loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
logoutBtn.addEventListener('click', handleLogout);

// Event listeners untuk upload
document.querySelectorAll('input[name="media-type"]').forEach(input => {
    input.addEventListener('change', (e) => {
        mediaType = e.target.value;
        resetUploadArea();
    });
});

uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
    }
});

uploadBtn.addEventListener('click', uploadToGitHub);

// Modal events
closeModal.addEventListener('click', () => {
    mediaModal.classList.add('hidden');
});

mediaModal.addEventListener('click', (e) => {
    if (e.target === mediaModal) {
        mediaModal.classList.add('hidden');
    }
});

// Filter events
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        
        // Update UI
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Filter gallery
        filterGallery(filter);
    });
});

// Fungsi inisialisasi aplikasi
function initApp() {
    // Cek apakah pengguna sudah login
    const savedUser = localStorage.getItem('githubMediaUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showApp();
            loadMediaFromGitHub();
        } catch (e) {
            console.error('Error parsing saved user data:', e);
            localStorage.removeItem('githubMediaUser');
        }
    }
}

// Fungsi untuk beralih antara tab login/register
function switchAuthTab(tab) {
    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
}

// Fungsi untuk menangani login
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const token = document.getElementById('login-token').value;
    
    try {
        // Verifikasi kredensial dengan GitHub API
        const userData = await verifyGitHubCredentials(username, token);
        
        // Simpan data pengguna
        currentUser = {
            username,
            token,
            avatarUrl: userData.avatar_url,
            name: userData.name || username
        };
        
        localStorage.setItem('githubMediaUser', JSON.stringify(currentUser));
        
        // Periksa apakah repository sudah ada
        const repoExists = await checkRepositoryExists(username, token, REPO_NAME);
        
        if (!repoExists) {
            // Buat repository jika belum ada
            await createRepository(token);
        }
        
        showApp();
        loadMediaFromGitHub();
        
    } catch (error) {
        alert('Login gagal: ' + error.message);
        console.error('Login error:', error);
    }
}

// Fungsi untuk menangani pendaftaran
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const token = document.getElementById('register-token').value;
    
    try {
        // Verifikasi kredensial dengan GitHub API
        const userData = await verifyGitHubCredentials(username, token);
        
        // Buat repository
        await createRepository(token);
        
        // Simpan data pengguna
        currentUser = {
            username,
            token,
            avatarUrl: userData.avatar_url,
            name: userData.name || username
        };
        
        localStorage.setItem('githubMediaUser', JSON.stringify(currentUser));
        
        showApp();
        loadMediaFromGitHub();
        
    } catch (error) {
        alert('Pendaftaran gagal: ' + error.message);
        console.error('Registration error:', error);
    }
}

// Fungsi untuk verifikasi kredensial GitHub
async function verifyGitHubCredentials(username, token) {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    if (!response.ok) {
        throw new Error('Token tidak valid atau tidak memiliki izin yang cukup');
    }
    
    const userData = await response.json();
    
    // Pastikan username cocok
    if (userData.login.toLowerCase() !== username.toLowerCase()) {
        throw new Error('Username tidak cocok dengan token');
    }
    
    return userData;
}

// Fungsi untuk memeriksa apakah repository sudah ada
async function checkRepositoryExists(username, token, repoName) {
    try {
        const response = await fetch(`${GITHUB_API_BASE}/repos/${username}/${repoName}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Fungsi untuk membuat repository
async function createRepository(token) {
    const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: REPO_NAME,
            description: REPO_DESCRIPTION,
            auto_init: true,
            private: false
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal membuat repository');
    }
    
    return await response.json();
}

// Fungsi untuk menampilkan aplikasi utama
function showApp() {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    userNameSpan.textContent = currentUser.name;
}

// Fungsi untuk menangani logout
function handleLogout() {
    currentUser = null;
    localStorage.removeItem('githubMediaUser');
    appSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    
    // Reset form
    loginForm.reset();
    registerForm.reset();
    switchAuthTab('login');
}

// Fungsi untuk menangani pemilihan file
function handleFileSelect(e) {
    handleFiles(e.target.files);
}

// Fungsi untuk menangani file yang dipilih/di-drop
function handleFiles(files) {
    if (files.length === 0) return;
    
    selectedFiles = Array.from(files);
    
    // Validasi file
    for (const file of selectedFiles) {
        if (file.size > 25 * 1024 * 1024) {
            alert(`File ${file.name} terlalu besar. Maksimal ukuran file adalah 25MB.`);
            resetUploadArea();
            return;
        }
    }
    
    // Tampilkan tombol upload
    uploadBtn.classList.remove('hidden');
    
    // Update UI upload area
    uploadArea.innerHTML = `
        <div class="file-preview">
            <p>${selectedFiles.length} file siap diunggah</p>
            <ul>
                ${selectedFiles.map(file => `<li>${file.name} (${formatFileSize(file.size)})</li>`).join('')}
            </ul>
        </div>
    `;
}

// Fungsi untuk mereset area upload
function resetUploadArea() {
    selectedFiles = [];
    fileInput.value = '';
    uploadBtn.classList.add('hidden');
    uploadArea.innerHTML = `
        <div class="upload-placeholder">
            <div class="upload-icon">📁</div>
            <p>Seret file ke sini atau <span class="browse-link">telusuri</span></p>
            <small>Maksimal ukuran file: 25MB</small>
        </div>
    `;
}

// Fungsi untuk mengunggah file ke GitHub
async function uploadToGitHub() {
    if (selectedFiles.length === 0) return;
    
    try {
        // Tampilkan progress bar
        uploadProgress.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = 'Mempersiapkan...';
        
        // Unggah setiap file
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            // Update progress
            progressText.textContent = `Mengunggah ${i + 1} dari ${selectedFiles.length}: ${file.name}`;
            
            // Upload file ke GitHub
            await uploadFileToGitHub(file, (progress) => {
                progressFill.style.width = `${progress}%`;
            });
        }
        
        // Selesai
        progressFill.style.width = '100%';
        progressText.textContent = 'Upload selesai!';
        
        // Tunggu sebentar lalu refresh gallery
        setTimeout(() => {
            uploadProgress.classList.add('hidden');
            resetUploadArea();
            loadMediaFromGitHub();
        }, 1500);
        
    } catch (error) {
        alert('Upload gagal: ' + error.message);
        console.error('Upload error:', error);
        uploadProgress.classList.add('hidden');
    }
}

// Fungsi untuk mengunggah file ke GitHub
async function uploadFileToGitHub(file, progressCallback) {
    const path = `${mediaType}s/${Date.now()}_${file.name}`;
    const content = await toBase64(file);
    
    // GitHub API mengharuskan content dalam format base64
    const response = await fetch(`${GITHUB_API_BASE}/repos/${currentUser.username}/${REPO_NAME}/contents/${path}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${currentUser.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Menambahkan ${file.name} ke media gallery`,
            content: content.split(',')[1] // Hapus data:image/...;base64,
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal mengunggah file');
    }
    
    return await response.json();
}

// Fungsi untuk memuat media dari GitHub - DIPERBAIKI
async function loadMediaFromGitHub() {
    try {
        galleryGrid.innerHTML = '<div class="empty-state"><p>Memuat media...</p></div>';
        
        // Dapatkan daftar file dari repository
        const media = await fetchMediaFromGitHub();
        mediaItems = media;
        
        // Tampilkan media di gallery
        renderGallery(media);
        
    } catch (error) {
        console.error('Error loading media:', error);
        galleryGrid.innerHTML = '<div class="empty-state"><p>Gagal memuat media. Pastikan repository "github-media-gallery" sudah dibuat dan token memiliki izin yang cukup.</p></div>';
    }
}

// Fungsi untuk mengambil media dari GitHub - DIPERBAIKI
async function fetchMediaFromGitHub() {
    const media = [];
    
    try {
        // Gunakan GitHub API untuk mendapatkan daftar file dengan recursive parameter
        const response = await fetch(`${GITHUB_API_BASE}/repos/${currentUser.username}/${REPO_NAME}/git/trees/main?recursive=1`, {
            headers: {
                'Authorization': `token ${currentUser.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Tidak dapat mengakses repository');
        }
        
        const data = await response.json();
        
        // Filter file yang berada di folder images, videos, atau audio
        const mediaFiles = data.tree.filter(item => {
            return item.path.startsWith('images/') || 
                   item.path.startsWith('videos/') || 
                   item.path.startsWith('audio/');
        });
        
        // Konversi ke format yang diharapkan
        for (const file of mediaFiles) {
            const pathParts = file.path.split('/');
            const type = pathParts[0].substring(0, pathParts[0].length - 1); // Hapus 's' di akhir
            const timestamp = pathParts[1].split('_')[0];
            
            media.push({
                name: pathParts[1],
                path: file.path,
                downloadUrl: `https://raw.githubusercontent.com/${currentUser.username}/${REPO_NAME}/main/${file.path}`,
                htmlUrl: `https://github.com/${currentUser.username}/${REPO_NAME}/blob/main/${file.path}`,
                type: type,
                size: 0, // Size tidak tersedia di tree API
                date: timestamp
            });
        }
        
    } catch (error) {
        console.error('Error fetching media files:', error);
        
        // Fallback: coba metode lama jika metode baru gagal
        try {
            console.log('Mencoba metode fallback...');
            const folders = ['images', 'videos', 'audio'];
            
            for (const folder of folders) {
                try {
                    const response = await fetch(`${GITHUB_API_BASE}/repos/${currentUser.username}/${REPO_NAME}/contents/${folder}`, {
                        headers: {
                            'Authorization': `token ${currentUser.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    
                    if (response.ok) {
                        const files = await response.json();
                        
                        // Filter hanya file (bukan folder)
                        for (const file of files) {
                            if (file.type === 'file') {
                                media.push({
                                    name: file.name,
                                    path: file.path,
                                    downloadUrl: file.download_url,
                                    htmlUrl: file.html_url,
                                    type: folder.slice(0, -1), // Hapus 's' di akhir
                                    size: file.size,
                                    date: file.name.split('_')[0] // Ambil timestamp dari nama file
                                });
                            }
                        }
                    }
                } catch (folderError) {
                    console.error(`Error fetching ${folder} files:`, folderError);
                }
            }
        } catch (fallbackError) {
            console.error('Fallback method also failed:', fallbackError);
            throw new Error('Tidak dapat mengambil data media dari GitHub');
        }
    }
    
    // Urutkan berdasarkan tanggal (terbaru pertama)
    return media.sort((a, b) => parseInt(b.date) - parseInt(a.date));
}

// Fungsi untuk merender gallery
function renderGallery(media) {
    if (media.length === 0) {
        galleryGrid.innerHTML = '<div class="empty-state"><p>Belum ada media. Unggah file pertama Anda!</p></div>';
        return;
    }
    
    galleryGrid.innerHTML = '';
    
    media.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.type = item.type;
        
        let thumbContent = '';
        
        if (item.type === 'image') {
            thumbContent = `<img src="${item.downloadUrl}" alt="${item.name}" class="media-thumb" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdhbWJhciBnYWdhbCBkaW11bGF0PC90ZXh0Pjwvc3ZnPg=='">`;
        } else if (item.type === 'video') {
            thumbContent = `
                <video class="media-thumb" preload="metadata" poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlZpZGVvPC90ZXh0Pjwvc3ZnPg==">
                    <source src="${item.downloadUrl}#t=0.5" type="video/mp4">
                </video>
                <div style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.7); color:white; padding:2px 6px; border-radius:4px; font-size:12px;">VIDEO</div>
            `;
        } else {
            thumbContent = `
                <div class="audio-thumb">
                    <div class="audio-icon">🎵</div>
                </div>
                <div style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.7); color:white; padding:2px 6px; border-radius:4px; font-size:12px;">AUDIO</div>
            `;
        }
        
        card.innerHTML = `
            <div style="position:relative;">
                ${thumbContent}
            </div>
            <div class="media-info">
                <h4>${item.name.split('_').slice(1).join('_')}</h4>
                <p>${formatDate(item.date)}</p>
            </div>
        `;
        
        card.addEventListener('click', () => openMediaModal(item));
        galleryGrid.appendChild(card);
    });
}

// Fungsi untuk membuka modal media
function openMediaModal(media) {
    mediaFilename.textContent = media.name.split('_').slice(1).join('_');
    mediaDate.textContent = `Diunggah pada: ${formatDate(media.date)}`;
    mediaLink.href = media.htmlUrl;
    
    mediaContainer.innerHTML = '';
    
    if (media.type === 'image') {
        const img = document.createElement('img');
        img.src = media.downloadUrl;
        img.alt = media.name;
        img.style.maxWidth = '100%';
        img.onerror = function() {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdhbWJhciBnYWdhbCBkaW11bGF0PC90ZXh0Pjwvc3ZnPg==';
        };
        mediaContainer.appendChild(img);
    } else if (media.type === 'video') {
        const video = document.createElement('video');
        video.controls = true;
        video.src = media.downloadUrl;
        video.style.maxWidth = '100%';
        mediaContainer.appendChild(video);
    } else {
        mediaContainer.innerHTML = `
            <div class="audio-container">
                <div class="audio-icon" style="font-size: 4rem;">🎵</div>
                <audio controls>
                    <source src="${media.downloadUrl}" type="audio/mpeg">
                    Browser Anda tidak mendukung pemutar audio.
                </audio>
            </div>
        `;
    }
    
    mediaModal.classList.remove('hidden');
}

// Fungsi untuk memfilter gallery
function filterGallery(filter) {
    const mediaCards = document.querySelectorAll('.media-card');
    
    mediaCards.forEach(card => {
        if (filter === 'all' || card.dataset.type === filter) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Fungsi utilitas: Convert file to base64
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Fungsi utilitas: Format ukuran file
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Fungsi utilitas: Format tanggal
function formatDate(timestamp) {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
