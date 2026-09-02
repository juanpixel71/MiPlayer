document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENTOS DE LAS 3 PANTALLAS ---
    const screen1 = document.getElementById('screen-1');
    const screen2 = document.getElementById('screen-2');
    const screen3 = document.getElementById('screen-3');

    // Footers de navegación
    const footerScreen2 = document.querySelector('#screen-2 footer') || document.getElementById('footer-screen-2');
    const footerScreen3 = document.querySelector('#screen-3 footer') || document.getElementById('footer-screen-3');

    // Elementos Pantalla 2
    const albumTitleScreen2 = document.querySelector('#screen-2 header h1') || document.getElementById('album-title');
    const songListContainer = document.querySelector('#screen-2 .song-list') || document.getElementById('song-list');

    // Elementos Pantalla 3 (Reproductor)
    const coverScreen3 = document.querySelector('#screen-3 img') || document.getElementById('cover-screen3');
    const trackTitleScreen3 = document.querySelector('#screen-3 .track-title') || document.getElementById('track-title');
    const playBtn = document.getElementById('play-btn') || document.querySelector('#screen-3 .btn-play');
    const prevBtn = document.getElementById('prev-btn') || document.querySelector('#screen-3 .btn-prev');
    const nextBtn = document.getElementById('next-btn') || document.querySelector('#screen-3 .btn-next');
    const progressBar = document.getElementById('progress-bar') || document.querySelector('#screen-3 input[type="range"]');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    const DEFAULT_COVER = 'icon.png';
    const MUSIC_FOLDER_NAME = 'MiMusica'; // Se busca en /storage/emulated/0/MiMusica

    // Estado de la aplicación
    let albumsData = []; // [{ name: 'NombreAlbum', cover: '...', tracks: [{ title, src }] }]
    let currentAlbum = null;
    let currentTrackIndex = 0;
    let audio = new Audio();
    let isPlaying = false;

    // 1. SOLICITAR PERMISOS EN ANDROID
    async function requestStoragePermissions() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            try {
                await window.Capacitor.Plugins.Filesystem.requestPermissions();
            } catch (err) {
                console.log('Permisos concedidos o no requeridos:', err);
            }
        }
    }
    await requestStoragePermissions();

    // 2. ESCANEAR LA CARPETA /storage/emulated/0/MiMusica
    async function scanMusicDirectory() {
        albumsData = [];

        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            const { Filesystem, Directory } = window.Capacitor.Plugins;
            try {
                // Leer la carpeta MiMusica de la raíz del almacenamiento
                const rootResult = await Filesystem.readdir({
                    path: MUSIC_FOLDER_NAME,
                    directory: Directory.ExternalStorage
                });

                if (rootResult && rootResult.files) {
                    for (const item of rootResult.files) {
                        const folderName = typeof item === 'string' ? item : item.name;
                        const isDirectory = item.type === 'directory' || (!folderName.includes('.') && folderName !== 'cover.jpg');

                        if (isDirectory) {
                            const albumPath = `${MUSIC_FOLDER_NAME}/${folderName}`;
                            const albumContent = await Filesystem.readdir({
                                path: albumPath,
                                directory: Directory.ExternalStorage
                            });

                            let coverUrl = DEFAULT_COVER;
                            let rawTracks = [];

                            if (albumContent && albumContent.files) {
                                for (const file of albumContent.files) {
                                    const fileName = typeof file === 'string' ? file : file.name;
                                    const filePath = `${albumPath}/${fileName}`;

                                    // Detectar cover.jpg o imágenes de portada
                                    if (fileName.toLowerCase().startsWith('cover.')) {
                                        const coverUriResult = await Filesystem.getUri({
                                            path: filePath,
                                            directory: Directory.ExternalStorage
                                        });
                                        coverUrl = Capacitor.convertFileSrc(coverUriResult.uri);
                                    } 
                                    // Detectar canciones de audio
                                    else if (fileName.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) {
                                        const audioUriResult = await Filesystem.getUri({
                                            path: filePath,
                                            directory: Directory.ExternalStorage
                                        });
                                        rawTracks.push({
                                            title: fileName.replace(/\.[^/.]+$/, ""),
                                            src: Capacitor.convertFileSrc(audioUriResult.uri)
                                        });
                                    }
                                }
                            }

                            // Ordenar canciones de la A a la Z
                            rawTracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

                            if (rawTracks.length > 0) {
                                albumsData.push({
                                    name: folderName,
                                    cover: coverUrl,
                                    tracks: rawTracks
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.log('Error escaneando almacenamiento:', error);
            }
        }

        // Ordenar álbumes de la A a la Z
        albumsData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        renderScreen1();
    }

    // 3. PANTALLA 1: LISTADO DE ÁLBUMES
    function renderScreen1() {
        const container = document.querySelector('#screen-1 .album-grid') || document.querySelector('#screen-1 .albums-container') || document.getElementById('album-list');
        if (!container) return;
        container.innerHTML = '';

        if (albumsData.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #ffffff;">No se han encontrado carpetas con música en /MiMusica</div>`;
            return;
        }

        albumsData.forEach((album) => {
            const card = document.createElement('div');
            card.className = 'album-card';
            card.style.cursor = 'pointer';

            card.innerHTML = `
                <img src="${album.cover}" alt="${album.name}" onerror="this.src='${DEFAULT_COVER}'">
                <div class="album-name">${album.name}</div>
            `;

            card.addEventListener('click', () => {
                currentAlbum = album;
                renderScreen2();
                showScreen(screen2);
            });

            container.appendChild(card);
        });
    }

    // 4. PANTALLA 2: LISTADO DE CANCIONES (A-Z)
    function renderScreen2() {
        if (!currentAlbum) return;

        if (albumTitleScreen2) albumTitleScreen2.textContent = currentAlbum.name;
        if (!songListContainer) return;
        songListContainer.innerHTML = '';

        currentAlbum.tracks.forEach((track, index) => {
            const songRow = document.createElement('div');
            songRow.className = 'song-item';
            songRow.style.cursor = 'pointer';

            songRow.innerHTML = `
                <span class="song-number">${index + 1}</span>
                <span class="song-title">${track.title}</span>
            `;

            songRow.addEventListener('click', () => {
                loadTrack(index);
                playAudio();
                showScreen(screen3);
            });

            songListContainer.appendChild(songRow);
        });
    }

    // 5. NAVEGACIÓN Y FOOTERS
    function showScreen(targetScreen) {
        screen1.classList.remove('active');
        if (screen2) screen2.classList.remove('active');
        screen3.classList.remove('active');

        targetScreen.classList.add('active');
    }

    // Footer Pantalla 2 -> Volver a álbumes (Pantalla 1)
    if (footerScreen2) {
        footerScreen2.addEventListener('click', () => {
            showScreen(screen1);
        });
    }

    // Footer Pantalla 3 -> Volver a canciones (Pantalla 2)
    if (footerScreen3) {
        footerScreen3.addEventListener('click', () => {
            if (currentAlbum) {
                showScreen(screen2);
            } else {
                showScreen(screen1);
            }
        });
    }

    // 6. PANTALLA 3: REPRODUCTOR
    function loadTrack(index) {
        if (!currentAlbum || currentAlbum.tracks.length === 0) return;
        currentTrackIndex = index;
        const track = currentAlbum.tracks[currentTrackIndex];

        audio.src = track.src;

        if (trackTitleScreen3) trackTitleScreen3.textContent = track.title;
        if (coverScreen3) {
            coverScreen3.src = currentAlbum.cover || DEFAULT_COVER;
            coverScreen3.onerror = () => { coverScreen3.src = DEFAULT_COVER; };
        }

        updatePlayButtonIcon(false);
    }

    function updatePlayButtonIcon(playing) {
        isPlaying = playing;
        const playIconSVG = `<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        const pauseIconSVG = `<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

        if (playBtn) {
            playBtn.innerHTML = isPlaying ? pauseIconSVG : playIconSVG;
        }
    }

    function playAudio() {
        if (!audio.src) return;
        audio.play().then(() => {
            updatePlayButtonIcon(true);
        }).catch(err => console.log('Error al reproducir audio:', err));
    }

    function togglePlay() {
        if (!audio.src) return;
        if (isPlaying) {
            audio.pause();
            updatePlayButtonIcon(false);
        } else {
            playAudio();
        }
    }

    if (playBtn) playBtn.addEventListener('click', togglePlay);

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (!currentAlbum) return;
            let nextIndex = currentTrackIndex - 1;
            if (nextIndex < 0) nextIndex = currentAlbum.tracks.length - 1;
            loadTrack(nextIndex);
            playAudio();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (!currentAlbum) return;
            let nextIndex = (currentTrackIndex + 1) % currentAlbum.tracks.length;
            loadTrack(nextIndex);
            playAudio();
        });
    }

    // Progreso y tiempos
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

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Iniciar escaneo
    await scanMusicDirectory();
});
