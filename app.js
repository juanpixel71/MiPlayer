document.addEventListener('DOMContentLoaded', () => {
    // Pantallas
    const s1 = document.getElementById('screen-albums');
    const s2 = document.getElementById('screen-songs');
    const s3 = document.getElementById('screen-player');

    // Botones Volver
    const btnBackToAlbums = s2.querySelector('.btn-back-footer');
    const btnBackToSongs = document.getElementById('btn-back-to-songs');

    // Listas y títulos
    const albumsList = s1.querySelector('.list-container');
    const songsList = s2.querySelector('.list-container');
    const songsHeaderTitle = document.getElementById('songs-header-title');

    // Controles del reproductor
    const playerTitle = s3.querySelector('.player-song-title');
    const playerArtistAlbum = s3.querySelector('.player-artist-album');
    const btnPrev = document.getElementById('btn-prev');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnNext = document.getElementById('btn-next');
    const seekBar = document.getElementById('seek-bar');
    const currentTimeEl = document.getElementById('current-time');
    const totalDurationEl = document.getElementById('total-duration');

    // Elemento Audio HTML5
    const audioElement = new Audio();

    // Estado global
    let albumsMap = {};
    let currentPlaylist = [];
    let currentIndex = -1;
    let isSeeking = false;

    const TARGET_PATH = '/storage/emulated/0/MiMusica';

    // Navegación entre pantallas
    function goToScreen(targetScreen) {
        [s1, s2, s3].forEach(s => s.classList.remove('active'));
        targetScreen.classList.add('active');
    }

    if (btnBackToAlbums) btnBackToAlbums.addEventListener('click', () => goToScreen(s1));

    // BOTÓN VOLVER A CANCIONES: Pausa y limpia totalmente la reproducción
    if (btnBackToSongs) {
        btnBackToSongs.addEventListener('click', () => {
            stopAudio();
            goToScreen(s2);
        });
    }

    function stopAudio() {
        audioElement.pause();
        audioElement.currentTime = 0;
        btnPlayPause.textContent = '▶';
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "none";
        }
    }

    initApp();

    async function initApp() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            await readAbsolutePath();
        } else {
            renderDemoData();
        }
    }

    function parseItemName(item) {
        if (!item) return '';
        if (typeof item === 'string') return decodeURIComponent(item);
        if (item.name) return item.name;
        if (item.uri || item.path) {
            const rawPath = item.uri || item.path;
            const decoded = decodeURIComponent(rawPath);
            const parts = decoded.split('/');
            return parts[parts.length - 1] || parts[parts.length - 2];
        }
        return '';
    }

    async function readAbsolutePath() {
        try {
            const { Filesystem } = window.Capacitor.Plugins;
            try { await Filesystem.requestPermissions(); } catch (e) {}

            albumsMap = {};
            let globalIdx = 0;

            const rootDir = await Filesystem.readdir({ path: TARGET_PATH }).catch(() => null);

            if (!rootDir || !rootDir.files || rootDir.files.length === 0) {
                albumsList.innerHTML = `<p style="padding:20px; text-align:center; color:#aaa;">No se encontraron álbumes.</p>`;
                return;
            }

            for (const item of rootDir.files) {
                const folderName = parseItemName(item);
                if (!folderName) continue;

                const cleanFolderPath = `${TARGET_PATH}/${folderName}`;
                let subDir = null;

                try {
                    subDir = await Filesystem.readdir({ path: cleanFolderPath });
                } catch (e1) {
                    if (typeof item === 'object' && item.uri) {
                        try { subDir = await Filesystem.readdir({ path: item.uri }); } catch (e2) {}
                    }
                }

                if (subDir && subDir.files && subDir.files.length > 0) {
                    subDir.files.forEach(fileInfo => {
                        const fileName = parseItemName(fileInfo);
                        if (fileName && !fileName.startsWith('.')) {
                            const rawFilePath = (typeof fileInfo === 'object' && fileInfo.uri) 
                                ? fileInfo.uri 
                                : `${cleanFolderPath}/${fileName}`;

                            const track = {
                                id: globalIdx++,
                                title: fileName.replace(/\.[^/.]+$/, ""),
                                fileName: fileName,
                                folder: folderName,
                                url: window.Capacitor.convertFileSrc(rawFilePath)
                            };

                            if (!albumsMap[folderName]) albumsMap[folderName] = [];
                            albumsMap[folderName].push(track);
                        }
                    });

                    // ORDENACIÓN DE CANCIONES (01, 02, 03...)
                    if (albumsMap[folderName]) {
                        albumsMap[folderName].sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' }));
                    }
                }
            }

            renderAlbums();

        } catch (err) {
            console.error('Error general:', err);
            renderDemoData();
        }
    }

    function renderDemoData() {
        albumsMap = {
            "Álbum Ejemplo": [
                { id: 1, title: "01 - Canción 1", fileName: "01 - Canción 1.mp3", folder: "Álbum Ejemplo", url: "" },
                { id: 2, title: "02 - Canción 2", fileName: "02 - Canción 2.mp3", folder: "Álbum Ejemplo", url: "" }
            ]
        };
        renderAlbums();
    }

    // PANTALLA 1: Álbumes (A - Z)
    function renderAlbums() {
        albumsList.innerHTML = '';
        const albumKeys = Object.keys(albumsMap).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        albumKeys.forEach(folderName => {
            const tracks = albumsMap[folderName];
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="album-cover-placeholder">🎵</div>
                <div class="album-text">
                    <h4>${folderName}</h4>
                    <p>${tracks.length} canción${tracks.length === 1 ? '' : 'es'}</p>
                </div>
            `;
            item.addEventListener('click', () => {
                songsHeaderTitle.textContent = folderName;
                renderSongs(tracks);
                goToScreen(s2);
            });
            albumsList.appendChild(item);
        });
    }

    // PANTALLA 2: Canciones
    function renderSongs(tracks) {
        songsList.innerHTML = '';
        tracks.forEach(track => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="song-text">
                    <h4>${track.title}</h4>
                </div>
            `;
            item.addEventListener('click', () => {
                playTrack(track, tracks);
                goToScreen(s3);
            });
            songsList.appendChild(item);
        });
    }

    // PANTALLA 3: Reproductor con MediaSession
    function playTrack(track, playlist) {
        currentPlaylist = playlist;
        currentIndex = currentPlaylist.findIndex(t => t.id === track.id);

        playerTitle.textContent = track.title;
        playerArtistAlbum.textContent = track.folder;

        if (track.url) {
            audioElement.src = track.url;
            audioElement.play().catch(e => console.log('Error de reproducción:', e));
        }

        // Configuración de la pantalla de bloqueo (MediaSession API)
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.folder,
                album: track.folder
            });

            navigator.mediaSession.setActionHandler('play', () => audioElement.play());
            navigator.mediaSession.setActionHandler('pause', () => audioElement.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => btnPrev.click());
            navigator.mediaSession.setActionHandler('nexttrack', () => btnNext.click());
        }
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    audioElement.addEventListener('play', () => {
        btnPlayPause.textContent = '⏸';
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
    });

    audioElement.addEventListener('pause', () => {
        btnPlayPause.textContent = '▶';
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
    });

    audioElement.addEventListener('timeupdate', () => {
        if (!isSeeking && audioElement.duration) {
            const progress = (audioElement.currentTime / audioElement.duration) * 100;
            seekBar.value = progress;
            currentTimeEl.textContent = formatTime(audioElement.currentTime);
            totalDurationEl.textContent = formatTime(audioElement.duration);
        }
    });

    audioElement.addEventListener('loadedmetadata', () => {
        totalDurationEl.textContent = formatTime(audioElement.duration);
    });

    seekBar.addEventListener('input', () => { isSeeking = true; });

    seekBar.addEventListener('change', () => {
        if (audioElement.duration) {
            audioElement.currentTime = (seekBar.value / 100) * audioElement.duration;
        }
        isSeeking = false;
    });

    btnPlayPause.addEventListener('click', () => {
        if (!audioElement.src) return;
        if (audioElement.paused) {
            audioElement.play();
        } else {
            audioElement.pause();
        }
    });

    btnNext.addEventListener('click', () => {
        if (currentPlaylist.length === 0 || currentIndex === -1) return;
        currentIndex = (currentIndex + 1) % currentPlaylist.length;
        playTrack(currentPlaylist[currentIndex], currentPlaylist);
    });

    btnPrev.addEventListener('click', () => {
        if (currentPlaylist.length === 0 || currentIndex === -1) return;
        currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        playTrack(currentPlaylist[currentIndex], currentPlaylist);
    });

    // Salto a la siguiente canción automático en segundo plano / pantalla apagada
    audioElement.addEventListener('ended', () => {
        btnNext.click();
    });
});
