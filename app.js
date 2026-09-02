document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENTOS DE PANTALLA ---
    const screen1 = document.getElementById('screen-1');
    const screen2 = document.getElementById('screen-2');
    const screen3 = document.getElementById('screen-3');

    // Contenedor principal de álbumes en Pantalla 1
    const albumsContainer = document.querySelector('#screen-1 .album-grid') || 
                            document.querySelector('#screen-1 .albums-container') || 
                            document.getElementById('album-list') ||
                            screen1;

    // Elementos Pantalla 2
    const albumTitleScreen2 = document.querySelector('#screen-2 header h1') || document.getElementById('album-title');
    const songListContainer = document.querySelector('#screen-2 .song-list') || 
                                document.querySelector('#screen-2 .songs-container') || 
                                document.getElementById('song-list');

    // Elementos Pantalla 3
    const coverScreen3 = document.querySelector('#screen-3 img') || document.getElementById('cover-screen3');
    const trackTitleScreen3 = document.querySelector('#screen-3 .track-title') || document.getElementById('track-title');
    const playBtn = document.getElementById('play-btn') || document.querySelector('#screen-3 .btn-play');
    const prevBtn = document.getElementById('prev-btn') || document.querySelector('#screen-3 .btn-prev');
    const nextBtn = document.getElementById('next-btn') || document.querySelector('#screen-3 .btn-next');
    const progressBar = document.getElementById('progress-bar') || document.querySelector('#screen-3 input[type="range"]');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    // Footers de navegación
    const footerScreen2 = document.querySelector('#screen-2 footer');
    const footerScreen3 = document.querySelector('#screen-3 footer');

    // Icono vectorial por defecto (Nota musical 🎵) cuando no existe cover.jpg
    const MUSIC_NOTE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff8c00"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

    let albumsData = [];
    let currentAlbum = null;
    let currentTrackIndex = 0;
    let audio = new Audio();
    let isPlaying = false;

    // Convierte rutas locales nativas en URLs accesibles por el WebView de Capacitor
    function normalizeFileUrl(uri) {
        if (!uri) return MUSIC_NOTE_SVG;
        if (window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function') {
            return window.Capacitor.convertFileSrc(uri);
        }
        return uri;
    }

    // 1. SOLICITUD DE PERMISOS NATIVOS
    async function requestPermissions() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            try {
                await window.Capacitor.Plugins.Filesystem.requestPermissions();
            } catch (err) {
                console.log('Solicitud de permisos completada/omitida:', err);
            }
        }
    }

    // 2. ESCANEO DE CARPETAS Y COVERS
    async function scanFolders() {
        albumsData = [];

        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            const { Filesystem, Directory } = window.Capacitor.Plugins;

            try {
                // Lectura de la carpeta MiMusica en almacenamiento externo
                const rootResult = await Filesystem.readdir({
                    path: 'MiMusica',
                    directory: Directory.ExternalStorage
                });

                if (rootResult && rootResult.files) {
                    for (const item of rootResult.files) {
                        const folderName = typeof item === 'string' ? item : item.name;

                        // Filtrar carpetas (álbumes)
                        if (!folderName.includes('.')) {
                            const albumPath = `MiMusica/${folderName}`;
                            
                            const albumContent = await Filesystem.readdir({
                                path: albumPath,
                                directory: Directory.ExternalStorage
                            });

                            let coverSrc = MUSIC_NOTE_SVG;
                            let tracks = [];

                            if (albumContent && albumContent.files) {
                                for (const file of albumContent.files) {
                                    const fileName = typeof file === 'string' ? file : file.name;
                                    const filePath = `${albumPath}/${fileName}`;

                                    // Buscar portada
                                    if (fileName.toLowerCase().startsWith('cover.')) {
                                        try {
                                            const coverUri = await Filesystem.getUri({
                                                path: filePath,
                                                directory: Directory.ExternalStorage
                                            });
                                            coverSrc = normalizeFileUrl(coverUri.uri);
                                        } catch (e) {
                                            coverSrc = MUSIC_NOTE_SVG;
                                        }
                                    } 
                                    // Buscar canciones
                                    else if (fileName.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) {
                                        const trackUri = await Filesystem.getUri({
                                            path: filePath,
                                            directory: Directory.ExternalStorage
                                        });
                                        tracks.push({
                                            title: fileName.replace(/\.[^/.]+$/, ""),
                                            src: normalizeFileUrl(trackUri.uri)
                                        });
                                    }
                                }
                            }

                            // Ordenar canciones A-Z
                            tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));

                            if (tracks.length > 0) {
                                albumsData.push({
                                    name: folderName,
                                    cover: coverSrc,
                                    tracks: tracks
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.log('Error escaneando almacenamiento:', err);
            }
        }

        // Ordenar álbumes A-Z
        albumsData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        renderScreen1();
    }

    // 3. RENDERIZADO PANTALLA 1 (ÁLBURMES Y CARÁTULAS)
    function renderScreen1() {
        if (!albumsContainer) return;

        // Limpiar contenedor
        albumsContainer.innerHTML = '';

        if (albumsData.length === 0) {
            albumsContainer.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:#ffffff;">
                    <p style="font-size:16px; font-weight:bold;">No se encontraron álbumes</p>
                    <p style="font-size:12px; opacity:0.7;">Verifica que las carpetas estén en /MiMusica</p>
                </div>
            `;
            return;
        }

        albumsData.forEach((album) => {
            const card = document.createElement('div');
            card.className = 'album-item';
            card.style.cssText = 'display:inline-block; margin:12px; text-align:center; cursor:pointer; width:120px;';

            card.innerHTML = `
                <div style="width:120px; height:120px; background:#111; border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center; border:2px solid #ff8c00; box-shadow:0 4px 10px rgba(0,0,0,0.5);">
                    <img src="${album.cover}" alt="${album.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${MUSIC_NOTE_SVG}';">
                </div>
                <div style="color:#ffffff; font-size:13px; font-weight:bold; margin-top:8px; width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${album.name}
                </div>
            `;

            card.addEventListener('click', () => {
                currentAlbum = album;
                renderScreen2();
                showScreen(screen2);
            });

            albumsContainer.appendChild(card);
        });
    }

    // 4. RENDERIZADO PANTALLA 2 (CANCIONES)
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
                <span style="color:#ffffff; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${track.title}</span>
            `;

            item.addEventListener('click', () => {
                loadTrack(index);
                playTrack();
                showScreen(screen3);
            });

            songListContainer.appendChild(item);
        });
    }

    // 5. CAMBIO ENTRE PANTALLAS
    function showScreen(targetScreen) {
        if (!targetScreen) return;
        screen1.classList.remove('active');
        if (screen2) screen2.classList.remove('active');
        screen3.classList.remove('active');

        targetScreen.classList.add('active');
    }

    if (footerScreen2) footerScreen2.addEventListener('click', () => showScreen(screen1));
    if (footerScreen3) footerScreen3.addEventListener('click', () => showScreen(currentAlbum ? screen2 : screen1));

    // 6. CONTROLES DE REPRODUCCIÓN (PANTALLA 3)
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
        audio.play().then(() => updatePlayButton(true)).catch(e => console.log('Error reproduciendo:', e));
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

    // Inicialización de la aplicación
    await requestPermissions();
    await scanFolders();
});
