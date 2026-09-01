```javascript
document.addEventListener('DOMContentLoaded', () => {
    // =========================
    // PANTALLAS
    // =========================
    const s1 = document.getElementById('screen-albums');
    const s2 = document.getElementById('screen-songs');
    const s3 = document.getElementById('screen-player');

    // =========================
    // BOTONES VOLVER
    // =========================
    const btnBackToAlbums = document.getElementById('btn-back-to-albums');
    const btnBackToSongs = document.getElementById('btn-back-to-songs');

    // =========================
    // LISTAS Y TÍTULOS
    // =========================
    const albumsList = s1.querySelector('.albums-grid');
    const songsList = s2.querySelector('.list-container');
    const songsHeaderTitle = document.getElementById('songs-header-title');

    // =========================
    // ELEMENTOS DEL REPRODUCTOR
    // =========================
    const playerCover = document.getElementById('player-cover');
    const playerTitle = s3.querySelector('.player-song-title');
    const playerArtistAlbum = s3.querySelector('.player-artist-album');
    const btnPrev = document.getElementById('btn-prev');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnNext = document.getElementById('btn-next');
    const seekBar = document.getElementById('seek-bar');
    const currentTimeEl = document.getElementById('current-time');
    const totalDurationEl = document.getElementById('total-duration');

    // =========================
    // AUDIO
    // =========================
    const audioElement = new Audio();

    // =========================
    // ESTADO GLOBAL
    // =========================
    let albumsMap = {};
    let currentPlaylist = [];
    let currentIndex = -1;
    let isSeeking = false;

    const TARGET_PATH = '/storage/emulated/0/MiMusica';
    const DEFAULT_COVER = `
        <div class="music-note-placeholder" aria-label="Sin carátula">
            🎵
        </div>
    `;

    // =========================
    // NAVEGACIÓN
    // =========================
    function goToScreen(targetScreen) {
        [s1, s2, s3].forEach(screen => {
            screen.classList.remove('active');
        });

        targetScreen.classList.add('active');
    }

    // =========================
    // FOOTER VOLVER A ÁLBUMES
    // =========================
    if (btnBackToAlbums) {
        btnBackToAlbums.addEventListener('click', () => {
            goToScreen(s1);
        });
    }

    // =========================
    // FOOTER VOLVER A CANCIONES
    // =========================
    if (btnBackToSongs) {
        btnBackToSongs.addEventListener('click', () => {
            stopAudio();
            goToScreen(s2);
        });
    }

    // =========================
    // PARAR AUDIO
    // =========================
    function stopAudio() {
        audioElement.pause();
        audioElement.currentTime = 0;

        setPlayPauseState(false);

        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'none';
        }
    }

    // =========================
    // ESTADO DEL BOTÓN PLAY/PAUSE
    // Usamos una clase CSS para evitar
    // el pequeño "salto" visual entre ▶ y ⏸
    // =========================
    function setPlayPauseState(isPlaying) {
        if (!btnPlayPause) return;

        btnPlayPause.classList.toggle('is-playing', isPlaying);
        btnPlayPause.setAttribute(
            'aria-label',
            isPlaying ? 'Pausar' : 'Reproducir'
        );
    }

    // =========================
    // INICIO DE LA APP
    // =========================
    initApp();

    async function initApp() {
        if (window.Capacitor && window.Capacitor.Plugins) {
            await requestAppPermissions();
            await readAbsolutePath();
        } else {
            renderDemoData();
        }
    }

    // =========================
    // PERMISOS
    // =========================
    async function requestAppPermissions() {
        const { Filesystem } = window.Capacitor.Plugins;

        try {
            if (Filesystem && Filesystem.requestPermissions) {
                await Filesystem.requestPermissions();
            }
        } catch (e) {
            console.log('Error pidiendo permisos de filesystem:', e);
        }

        if ('Notification' in window && Notification.permission !== 'granted') {
            try {
                await Notification.requestPermission();
            } catch (e) {
                console.log('Permiso de notificaciones no disponible');
            }
        }
    }

    // =========================
    // OBTENER NOMBRE DE UN ITEM
    // =========================
    function parseItemName(item) {
        if (!item) return '';

        if (typeof item === 'string') {
            try {
                return decodeURIComponent(item);
            } catch (e) {
                return item;
            }
        }

        if (item.name) {
            return item.name;
        }

        if (item.uri || item.path) {
            const rawPath = item.uri || item.path;

            try {
                const decoded = decodeURIComponent(rawPath);
                const parts = decoded.split('/');
                return parts[parts.length - 1] || parts[parts.length - 2] || '';
            } catch (e) {
                const parts = rawPath.split('/');
                return parts[parts.length - 1] || '';
            }
        }

        return '';
    }

    // =========================
    // LEER COVER.JPG
    //
    // En lugar de usar convertFileSrc()
    // para la imagen, la leemos directamente
    // como Base64. Esto evita problemas del
    // WebView con rutas externas de Android.
    // =========================
    async function loadCoverImage(Filesystem, coverPath) {
        try {
            const result = await Filesystem.readFile({
                path: coverPath
            });

            if (!result || !result.data) {
                return null;
            }

            return `data:image/jpeg;base64,${result.data}`;
        } catch (error) {
            console.log('No se pudo leer cover.jpg:', coverPath, error);
            return null;
        }
    }

    // =========================
    // LEER MÚSICA Y ÁLBUMES
    // =========================
    async function readAbsolutePath() {
        try {
            const { Filesystem } = window.Capacitor.Plugins;

            albumsMap = {};
            let globalIdx = 0;

            const rootDir = await Filesystem
                .readdir({ path: TARGET_PATH })
                .catch(() => null);

            if (!rootDir || !rootDir.files || rootDir.files.length === 0) {
                albumsList.innerHTML = `
                    <p class="empty-message">
                        No se encontraron álbumes.
                    </p>
                `;
                return;
            }

            for (const item of rootDir.files) {
                const folderName = parseItemName(item);

                if (!folderName || folderName.startsWith('.')) {
                    continue;
                }

                const cleanFolderPath = `${TARGET_PATH}/${folderName}`;
                let subDir = null;

                try {
                    subDir = await Filesystem.readdir({
                        path: cleanFolderPath
                    });
                } catch (e1) {
                    if (typeof item === 'object' && item.uri) {
                        try {
                            subDir = await Filesystem.readdir({
                                path: item.uri
                            });
                        } catch (e2) {
                            console.log(
                                'No se pudo abrir la carpeta:',
                                folderName
                            );
                        }
                    }
                }

                if (!subDir || !subDir.files || subDir.files.length === 0) {
                    continue;
                }

                let coverUrl = null;
                const tracks = [];

                // -------------------------------------
                // Buscar cover.jpg y archivos de audio
                // -------------------------------------
                for (const fileInfo of subDir.files) {
                    const fileName = parseItemName(fileInfo);

                    if (!fileName || fileName.startsWith('.')) {
                        continue;
                    }

                    const lowerName = fileName.toLowerCase();

                    let rawFilePath;

                    if (typeof fileInfo === 'object' && fileInfo.uri) {
                        rawFilePath = fileInfo.uri;
                    } else {
                        rawFilePath = `${cleanFolderPath}/${fileName}`;
                    }

                    // COVER.JPG
                    if (lowerName === 'cover.jpg') {
                        coverUrl = await loadCoverImage(
                            Filesystem,
                            rawFilePath
                        );

                        continue;
                    }

                    // ARCHIVOS DE AUDIO
                    if (/\.(mp3|flac|wav|m4a|ogg)$/i.test(fileName)) {
                        tracks.push({
                            id: globalIdx++,
                            title: fileName.replace(/\.[^/.]+$/, ''),
                            fileName: fileName,
                            folder: folderName,
                            url: window.Capacitor.convertFileSrc(rawFilePath)
                        });
                    }
                }

                // -------------------------------------
                // Solo consideramos álbumes con canciones
                // -------------------------------------
                if (tracks.length > 0) {
                    tracks.sort((a, b) =>
                        a.fileName.localeCompare(
                            b.fileName,
                            undefined,
                            {
                                numeric: true,
                                sensitivity: 'base'
                            }
                        )
                    );

                    albumsMap[folderName] = {
                        cover: coverUrl,
                        tracks: tracks
                    };
                }
            }

            renderAlbums();

        } catch (err) {
            console.error('Error general leyendo MiMusica:', err);
            renderDemoData();
        }
    }

    // =========================
    // DATOS DE DEMOSTRACIÓN
    // =========================
    function renderDemoData() {
        albumsMap = {
            'Álbum Ejemplo': {
                cover: null,
                tracks: [
                    {
                        id: 1,
                        title: '01 - Canción 1',
                        fileName: '01 - Canción 1.mp3',
                        folder: 'Álbum Ejemplo',
                        url: ''
                    },
                    {
                        id: 2,
                        title: '02 - Canción 2',
                        fileName: '02 - Canción 2.mp3',
                        folder: 'Álbum Ejemplo',
                        url: ''
                    }
                ]
            }
        };

        renderAlbums();
    }

    // =========================
    // PANTALLA 1: ÁLBUMES
    // 2 COLUMNAS - A/Z
    // SIN TEXTO DEBAJO
    // =========================
    function renderAlbums() {
        albumsList.innerHTML = '';

        const albumKeys = Object.keys(albumsMap).sort((a, b) =>
            a.localeCompare(
                b,
                undefined,
                {
                    sensitivity: 'base'
                }
            )
        );

        if (albumKeys.length === 0) {
            albumsList.innerHTML = `
                <p class="empty-message">
                    No se encontraron álbumes.
                </p>
            `;
            return;
        }

        albumKeys.forEach(folderName => {
            const albumData = albumsMap[folderName];

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'album-card';
            item.setAttribute(
                'aria-label',
                `Abrir álbum ${folderName}`
            );

            const coverBox = document.createElement('div');
            coverBox.className = 'album-cover-box';

            if (albumData.cover) {
                const img = document.createElement('img');

                img.src = albumData.cover;
                img.className = 'album-cover-img';
                img.alt = folderName;
                img.loading = 'lazy';

                img.addEventListener('error', () => {
                    coverBox.innerHTML = DEFAULT_COVER;
                });

                coverBox.appendChild(img);
            } else {
                coverBox.innerHTML = DEFAULT_COVER;
            }

            // SOLO LA CARÁTULA.
            // No mostramos el nombre del álbum debajo.
            item.appendChild(coverBox);

            item.addEventListener('click', () => {
                songsHeaderTitle.textContent = folderName;
                renderSongs(albumData);
                goToScreen(s2);
            });

            albumsList.appendChild(item);
        });
    }

    // =========================
    // PANTALLA 2: CANCIONES
    // =========================
    function renderSongs(albumData) {
        songsList.innerHTML = '';

        albumData.tracks.forEach(track => {
            const item = document.createElement('button');

            item.type = 'button';
            item.className = 'list-item';

            const text = document.createElement('span');
            text.className = 'song-text';
            text.textContent = track.title;

            item.appendChild(text);

            item.addEventListener('click', () => {
                playTrack(track, albumData);
                goToScreen(s3);
            });

            songsList.appendChild(item);
        });
    }

    // =========================
    // PANTALLA 3: REPRODUCTOR
    // =========================
    function playTrack(track, albumData) {
        currentPlaylist = albumData.tracks;

        currentIndex = currentPlaylist.findIndex(
            t => t.id === track.id
        );

        playerTitle.textContent = track.title;
        playerArtistAlbum.textContent = track.folder;

        // -------------------------------------
        // CARÁTULA DEL ÁLBUM
        // -------------------------------------
        if (albumData.cover) {
            playerCover.innerHTML = '';

            const img = document.createElement('img');

            img.src = albumData.cover;
            img.className = 'player-cover-img';
            img.alt = track.folder;

            img.addEventListener('error', () => {
                playerCover.innerHTML = DEFAULT_COVER;
            });

            playerCover.appendChild(img);
        } else {
            playerCover.innerHTML = DEFAULT_COVER;
        }

        // -------------------------------------
        // REPRODUCCIÓN
        // -------------------------------------
        if (track.url) {
            audioElement.src = track.url;

            audioElement
                .play()
                .catch(error => {
                    console.log(
                        'Error de reproducción:',
                        error
                    );
                });
        }

        // -------------------------------------
        // MEDIA SESSION
        // -------------------------------------
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.metadata =
                    new MediaMetadata({
                        title: track.title,
                        artist: track.folder,
                        album: track.folder
                    });

                navigator.mediaSession.setActionHandler(
                    'play',
                    () => audioElement.play()
                );

                navigator.mediaSession.setActionHandler(
                    'pause',
                    () => audioElement.pause()
                );

                navigator.mediaSession.setActionHandler(
                    'previoustrack',
                    () => btnPrev.click()
                );

                navigator.mediaSession.setActionHandler(
                    'nexttrack',
                    () => btnNext.click()
                );
            } catch (error) {
                console.log(
                    'MediaSession no disponible:',
                    error
                );
            }
        }
    }

    // =========================
    // FORMATO DEL TIEMPO
    // =========================
    function formatTime(seconds) {
        if (
            Number.isNaN(seconds) ||
            seconds === Infinity ||
            seconds < 0
        ) {
            return '0:00';
        }

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // =========================
    // EVENTO PLAY
    // =========================
    audioElement.addEventListener('play', () => {
        setPlayPauseState(true);

        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    });

    // =========================
    // EVENTO PAUSE
    // =========================
    audioElement.addEventListener('pause', () => {
        setPlayPauseState(false);

        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
        }
    });

    // =========================
    // PROGRESO
    // =========================
    audioElement.addEventListener('timeupdate', () => {
        if (!isSeeking && audioElement.duration) {
            const progress =
                (audioElement.currentTime /
                    audioElement.duration) * 100;

            seekBar.value = progress;

            currentTimeEl.textContent =
                formatTime(audioElement.currentTime);

            totalDurationEl.textContent =
                formatTime(audioElement.duration);
        }
    });

    // =========================
    // METADATOS CARGADOS
    // =========================
    audioElement.addEventListener('loadedmetadata', () => {
        totalDurationEl.textContent =
            formatTime(audioElement.duration);
    });

    // =========================
    // SEEK: EMPEZAR
    // =========================
    seekBar.addEventListener('input', () => {
        isSeeking = true;
    });

    // =========================
    // SEEK: FINALIZAR
    // =========================
    seekBar.addEventListener('change', () => {
        if (audioElement.duration) {
            audioElement.currentTime =
                (seekBar.value / 100) *
                audioElement.duration;
        }

        isSeeking = false;
    });

    // =========================
    // PLAY / PAUSE
    // =========================
    btnPlayPause.addEventListener('click', () => {
        if (!audioElement.src) return;

        if (audioElement.paused) {
            audioElement
                .play()
                .catch(error => {
                    console.log(
                        'No se pudo reanudar:',
                        error
                    );
                });
        } else {
            audioElement.pause();
        }
    });

    // =========================
    // SIGUIENTE
    // =========================
    btnNext.addEventListener('click', () => {
        if (
            currentPlaylist.length === 0 ||
            currentIndex === -1
        ) {
            return;
        }

        currentIndex =
            (currentIndex + 1) %
            currentPlaylist.length;

        const nextTrack =
            currentPlaylist[currentIndex];

        playTrack(
            nextTrack,
            albumsMap[nextTrack.folder]
        );
    });

    // =========================
    // ANTERIOR
    // =========================
    btnPrev.addEventListener('click', () => {
        if (
            currentPlaylist.length === 0 ||
            currentIndex === -1
        ) {
            return;
        }

        currentIndex =
            (currentIndex - 1 +
                currentPlaylist.length) %
            currentPlaylist.length;

        const previousTrack =
            currentPlaylist[currentIndex];

        playTrack(
            previousTrack,
            albumsMap[previousTrack.folder]
        );
    });

    // =========================
    // AL TERMINAR UNA CANCIÓN
    // =========================
    audioElement.addEventListener('ended', () => {
        btnNext.click();
    });
});
```
