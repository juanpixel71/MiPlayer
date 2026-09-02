document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DE PANTALLA (Coincidentes con tu HTML) ---
    const screen1 = document.getElementById('screen-1');
    const screen2 = document.getElementById('screen-2');
    const screen3 = document.getElementById('screen-3');

    // Contenedor EXACTO de tu HTML para la Pantalla 1
    const albumsGrid = document.querySelector('#screen-1 .albums-grid') || document.querySelector('.albums-grid');

    // Elementos Pantalla 2
    const albumTitleScreen2 = document.querySelector('#screen-2 header h1') || document.getElementById('album-title');
    const songListContainer = document.querySelector('#screen-2 .song-list') || document.querySelector('#screen-2 .songs-container');

    // Elementos Pantalla 3
    const coverScreen3 = document.querySelector('#screen-3 img') || document.getElementById('cover-screen3');
    const trackTitleScreen3 = document.querySelector('#screen-3 .track-title') || document.getElementById('track-title');
    const playBtn = document.getElementById('play-btn') || document.querySelector('#screen-3 .btn-play');
    const prevBtn = document.getElementById('prev-btn') || document.querySelector('#screen-3 .btn-prev');
    const nextBtn = document.getElementById('next-btn') || document.querySelector('#screen-3 .btn-next');
    const progressBar = document.getElementById('progress-bar') || document.querySelector('#screen-3 input[type="range"]');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    // Footers
    const footerScreen2 = document.querySelector('#screen-2 footer');
    const footerScreen3 = document.querySelector('#screen-3 footer');

    // Icono SVG Nota Musical 🎵
    const MUSIC_NOTE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff8c00"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

    let albumsData = [];
    let currentAlbum = null;
    let currentTrackIndex = 0;
    let audio = new Audio();
    let isPlaying = false;

    // Normalizar ruta de archivo para WebView
    function getValidSrc(path) {
        if (!path) return MUSIC_NOTE_SVG;
        if (window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function' && path.startsWith('file://')) {
            return window.Capacitor.convertFileSrc(path);
        }
        return path;
    }

    // 1. RENDERIZADO INMEDIATO DE PANTALLA 1
    function renderScreen1() {
        if (!albumsGrid) return;
        albumsGrid.innerHTML = '';

        if (albumsData.length === 0) {
            albumsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding: 40px 10px; color:#ffffff;">
                    <p style="font-size:16px; font-weight:bold; margin-bottom:5px;">No se detectaron álbumes</p>
                    <p style="font-size:12px; opacity:0.7;">Comprueba la carpeta /MiMusica en tu dispositivo</p>
                </div>
            `;
            return;
        }

        albumsData.forEach((album) => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.style.cursor = 'pointer';

            const coverUrl = getValidSrc(album.cover);

            card.innerHTML = `
                <div class="album-cover-wrapper" style="width:100%; aspect-ratio:1/1; background:#1e1e1e; border-radius:10px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                    <img src="${coverUrl}" alt="${album.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='${MUSIC_NOTE_SVG}';">
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
    }

    // 2. RENDERIZADO PANTALLA 2 (CANCIONES)
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

    // 3. CAMBIO DE PANTALLAS
    function showScreen(targetScreen) {
        if (!targetScreen) return;
        screen1.classList.remove('active');
        if (screen2) screen2.classList.remove('active');
        screen3.classList.remove('active');

        targetScreen.classList.add('active');
    }

    if (footerScreen2) footerScreen2.addEventListener('click', () => showScreen(screen1));
    if (footerScreen3) footerScreen3.addEventListener('click', () => showScreen(currentAlbum ? screen2 : screen1));

    // 4. ESCANEO DE ALMACENAMIENTO NATIVO
    async function scanFolders() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            const { Filesystem, Directory } = window.Capacitor.Plugins;

            try {
                await Filesystem.requestPermissions();

                const rootResult = await Filesystem.readdir({
                    path: 'MiMusica',
                    directory: Directory.ExternalStorage
                });

                if (rootResult && rootResult.files) {
                    let tempAlbums = [];

                    for (const item of rootResult.files) {
                        const folderName = typeof item === 'string' ? item : item.name;

                        if (!folderName.includes('.')) {
                            const albumPath = `MiMusica/${folderName}`;
                            
                            const albumContent = await Filesystem.readdir({
                                path: albumPath,
                                directory: Directory.ExternalStorage
                            });

                            let coverPath = MUSIC_NOTE_SVG;
                            let tracks = [];

                            if (albumContent && albumContent.files) {
                                for (const file of albumContent.files) {
                                    const fileName = typeof file === 'string' ? file : file.name;
                                    const filePath = `${albumPath}/${fileName}`;

                                    if (fileName.toLowerCase().startsWith('cover.')) {
                                        try {
                                            const coverUri = await Filesystem.getUri({
                                                path: filePath,
                                                directory: Directory.ExternalStorage
                                            });
                                            coverPath = coverUri.uri;
                                        } catch (e) {
                                            coverPath = MUSIC_NOTE_SVG;
                                        }
                                    } else if (fileName.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) {
                                        const trackUri = await Filesystem.getUri({
                                            path: filePath,
                                            directory: Directory.ExternalStorage
                                        });
                                        tracks.push({
                                            title: fileName.replace(/\.[^/.]+$/, ""),
                                            src: trackUri.uri
                                        });
                                    }
                                }
                            }

                            tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));

                            if (tracks.length > 0) {
                                tempAlbums.push({
                                    name: folderName,
                                    cover: coverPath,
                                    tracks: tracks
                                });
                            }
                        }
                    }

                    if (tempAlbums.length > 0) {
                        albumsData = tempAlbums;
                        albumsData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                    }
                }
            } catch (err) {
                console.log('Error escaneando MiMusica:', err);
            }
        }

        // Renderizar tras completar el escaneo
        renderScreen1();
    }

    // 5. CONTROLES DE REPRODUCCIÓN
    function loadTrack(index) {
        if (!currentAlbum || currentAlbum.tracks.length === 0) return;
        currentTrackIndex = index;
        const track = currentAlbum.tracks[currentTrackIndex];

        audio.src = getValidSrc(track.src);

        if (trackTitleScreen3) trackTitleScreen3.textContent = track.title;
        if (coverScreen3) {
            coverScreen3.src = getValidSrc(currentAlbum.cover);
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

    // Dibujar pantalla inicialmente y lanzar escaneo en segundo plano
    renderScreen1();
    scanFolders();
});
