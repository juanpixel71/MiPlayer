document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DE PANTALLA ---
    const screen1 = document.getElementById('screen-1');
    const screen2 = document.getElementById('screen-2');
    const screen3 = document.getElementById('screen-3');

    const albumsGrid = document.querySelector('#screen-1 .albums-grid') || document.querySelector('.albums-grid');
    const albumTitleScreen2 = document.querySelector('#screen-2 header h1') || document.getElementById('album-title');
    const songListContainer = document.querySelector('#screen-2 .song-list') || document.querySelector('#screen-2 .songs-container');

    const coverScreen3 = document.querySelector('#screen-3 img') || document.getElementById('cover-screen3');
    const trackTitleScreen3 = document.querySelector('#screen-3 .track-title') || document.getElementById('track-title');
    const playBtn = document.getElementById('play-btn') || document.querySelector('#screen-3 .btn-play');
    const prevBtn = document.getElementById('prev-btn') || document.querySelector('#screen-3 .btn-prev');
    const nextBtn = document.getElementById('next-btn') || document.querySelector('#screen-3 .btn-next');
    const progressBar = document.getElementById('progress-bar') || document.querySelector('#screen-3 input[type="range"]');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    const footerScreen2 = document.querySelector('#screen-2 footer');
    const footerScreen3 = document.querySelector('#screen-3 footer');

    // Icono SVG por defecto (Nota musical 🎵)
    const MUSIC_NOTE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff8c00"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

    let albumsData = [];
    let currentAlbum = null;
    let currentTrackIndex = 0;
    let audio = new Audio();
    let isPlaying = false;

    // Crear un input nativo oculto para seleccionar carpetas (SAF)
    const folderInput = document.createElement('input');
    folderInput.type = 'file';
    folderInput.webkitdirectory = true;
    folderInput.directory = true;
    folderInput.style.display = 'none';
    document.body.appendChild(folderInput);

    // 1. DIBUJAR PANTALLA 1 CON BOTÓN DE SELECCIÓN DE CARPETA
    function renderScreen1() {
        if (!albumsGrid) return;
        albumsGrid.innerHTML = '';

        if (albumsData.length === 0) {
            albumsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding: 40px 20px; color:#ffffff;">
                    <p style="font-size:18px; font-weight:bold; margin-bottom:10px;">¡Bienvenido a MiPlayer!</p>
                    <p style="font-size:13px; opacity:0.8; margin-bottom:20px;">En Android 16 debes conceder acceso a tu carpeta de música una sola vez.</p>
                    <button id="btn-select-folder" style="background:#ff8c00; color:#fff; border:none; padding:12px 24px; font-weight:bold; border-radius:25px; font-size:14px; box-shadow: 0 4px 12px rgba(255,140,0,0.4); cursor:pointer;">
                        📁 Seleccionar carpeta /MiMusica
                    </button>
                </div>
            `;

            document.getElementById('btn-select-folder')?.addEventListener('click', () => {
                folderInput.click();
            });
            return;
        }

        albumsData.forEach((album) => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.style.cursor = 'pointer';

            card.innerHTML = `
                <div class="album-cover-wrapper" style="width:100%; aspect-ratio:1/1; background:#1e1e1e; border-radius:10px; overflow:hidden; display:flex; align-items:center; justify-content:center; border: 1px solid rgba(255,140,0,0.3);">
                    <img src="${album.cover}" alt="${album.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='${MUSIC_NOTE_SVG}';">
                </div>
                <div class="album-title" style="color:#fff; font-size:13px; font-weight:bold; margin-top:6px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${album.name}
                </div>
            `;

            card.addEventListener('click', () => {
                currentAlbum = album;
                renderScreen2();
                showScreen(screen2);
            });

            albumsGrid.appendChild(card);
        });

        // Botón flotante para cambiar de carpeta en cualquier momento
        const changeFolderBtn = document.createElement('div');
        changeFolderBtn.innerHTML = '📁 Cambiar carpeta';
        changeFolderBtn.style.cssText = 'position:fixed; bottom:70px; right:15px; background:rgba(255,140,0,0.9); color:#fff; padding:6px 12px; border-radius:15px; font-size:11px; font-weight:bold; z-index:999; cursor:pointer;';
        changeFolderBtn.addEventListener('click', () => folderInput.click());
        albumsGrid.appendChild(changeFolderBtn);
    }

    // 2. PROCESAR CARPETA Y ARCHIVOS SELECCIONADOS POR EL USUARIO
    folderInput.addEventListener('change', async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        const albumsMap = {};

        for (const file of files) {
            const relativePath = file.webkitRelativePath; // Ejemplo: "MiMusica/Album1/cancion.mp3"
            const parts = relativePath.split('/');

            if (parts.length >= 3) {
                const albumName = parts[1]; // Nombre de la subcarpeta (Álbum)
                const fileName = parts[parts.length - 1];

                if (!albumsMap[albumName]) {
                    albumsMap[albumName] = {
                        name: albumName,
                        cover: MUSIC_NOTE_SVG,
                        tracks: []
                    };
                }

                // Detectar Carátula
                if (fileName.toLowerCase().startsWith('cover.')) {
                    albumsMap[albumName].cover = await fileToBase64(file);
                } 
                // Detectar Canciones
                else if (fileName.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) {
                    albumsMap[albumName].tracks.push({
                        title: fileName.replace(/\.[^/.]+$/, ""),
                        src: URL.createObjectURL(file) // Genera URL Blob segura compatible con Android 16
                    });
                }
            }
        }

        albumsData = Object.values(albumsMap).filter(album => album.tracks.length > 0);
        albumsData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        // Ordenar canciones A-Z dentro de cada álbum
        albumsData.forEach(album => {
            album.tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
        });

        renderScreen1();
    });

    // Convierte imágenes locales a Base64 para garantizar su renderizado sin bloqueos CORS en Android 16
    function fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(MUSIC_NOTE_SVG);
            reader.readAsDataURL(file);
        });
    }

    // 3. RENDERIZADO PANTALLA 2 (CANCIONES)
    function renderScreen2() {
        if (!currentAlbum) return;

        if (albumTitleScreen2) albumTitleScreen2.textContent = currentAlbum.name;
        if (!songListContainer) return;

        songListContainer.innerHTML = '';

        currentAlbum.tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'song-item';
            item.style.cssText = 'padding:12px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; cursor:pointer;';

            item.innerHTML = `
                <span style="color:#ff8c00; font-weight:bold; margin-right:12px; min-width:20px;">${index + 1}</span>
                <span style="color:#ffffff; font-size:14px;">${track.title}</span>
            `;

            item.addEventListener('click', () => {
                loadTrack(index);
                playTrack();
                showScreen(screen3);
            });

            songListContainer.appendChild(item);
        });
    }

    // 4. CAMBIO DE PANTALLAS
    function showScreen(targetScreen) {
        if (!targetScreen) return;
        screen1.classList.remove('active');
        if (screen2) screen2.classList.remove('active');
        screen3.classList.remove('active');

        targetScreen.classList.add('active');
    }

    if (footerScreen2) footerScreen2.addEventListener('click', () => showScreen(screen1));
    if (footerScreen3) footerScreen3.addEventListener('click', () => showScreen(currentAlbum ? screen2 : screen1));

    // 5. CONTROLES DE REPRODUCCIÓN (PANTALLA 3)
    function loadTrack(index) {
        if (!currentAlbum || currentAlbum.tracks.length === 0) return;
        currentTrackIndex = index;
        const track = currentAlbum.tracks[currentTrackIndex];

        audio.src = track.src;

        if (trackTitleScreen3) trackTitleScreen3.textContent = track.title;
        if (coverScreen3) {
            coverScreen3.src = currentAlbum.cover;
            coverScreen3.onerror = () => { coverScreen3.src = MUSIC_NOTE_SVG; };
        }

        updatePlayButton(false);
    }

    function updatePlayButton(playing) {
        isPlaying = playing;
        const playSVG = `<svg viewBox="0 0 24 24" width="28" height="28" fill="white"><path d="M8 5v14l11-7z"/></svg>`;
        const pauseSVG = `<svg viewBox="0 0 24 24" width="28" height="28" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

        if (playBtn) playBtn.innerHTML = isPlaying ? pauseSVG : playSVG;
    }

    function playTrack() {
        if (!audio.src) return;
        audio.play().then(() => updatePlayButton(true)).catch(e => console.log('Error play:', e));
    }

    function togglePlay() {
        if (!audio.src) return;
        if (isPlaying) {
            audio.pause();
            updatePlayButton(false);
        } else {
            playTrack();
        }
    }

    if (playBtn) playBtn.addEventListener('click', togglePlay);

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (!currentAlbum) return;
            let prevIndex = currentTrackIndex - 1;
            if (prevIndex < 0) prevIndex = currentAlbum.tracks.length - 1;
            loadTrack(prevIndex);
            playTrack();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (!currentAlbum) return;
            let nextIndex = (currentTrackIndex + 1) % currentAlbum.tracks.length;
            loadTrack(nextIndex);
            playTrack();
        });
    }

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            if (progressBar) progressBar.value = progress;
            if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
            if (totalTimeEl) totalTimeEl.textContent = formatTime(audio.duration);
        }
    });

    if (progressBar) {
        progressBar.addEventListener('input', () => {
            if (audio.duration) {
                audio.currentTime = (progressBar.value / 100) * audio.duration;
            }
        });
    }

    function formatTime(secs) {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    renderScreen1();
});
