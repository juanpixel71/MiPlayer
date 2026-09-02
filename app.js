document.addEventListener('DOMContentLoaded', () => {
    // =========================================
    // PANTALLAS
    // =========================================

    const s1 = document.getElementById('screen-albums');
    const s2 = document.getElementById('screen-songs');
    const s3 = document.getElementById('screen-player');

    // =========================================
    // BOTONES VOLVER
    // =========================================

    const btnBackToAlbums =
        document.getElementById('btn-back-to-albums');

    const btnBackToSongs =
        document.getElementById('btn-back-to-songs');

    // =========================================
    // LISTAS Y TÍTULOS
    // =========================================

    const albumsList =
        s1.querySelector('.albums-grid');

    const songsList =
        s2.querySelector('.list-container');

    const songsHeaderTitle =
        document.getElementById('songs-header-title');

    // =========================================
    // REPRODUCTOR
    // =========================================

    const playerCover =
        document.getElementById('player-cover');

    const playerTitle =
        s3.querySelector('.player-song-title');

    const playerArtistAlbum =
        s3.querySelector('.player-artist-album');

    const btnPrev =
        document.getElementById('btn-prev');

    const btnPlayPause =
        document.getElementById('btn-play-pause');

    const btnNext =
        document.getElementById('btn-next');

    const seekBar =
        document.getElementById('seek-bar');

    const currentTimeEl =
        document.getElementById('current-time');

    const totalDurationEl =
        document.getElementById('total-duration');

    // =========================================
    // AUDIO
    // =========================================

    const audioElement = new Audio();

    // =========================================
    // ESTADO
    // =========================================

    let albumsMap = {};
    let currentPlaylist = [];
    let currentIndex = -1;
    let isSeeking = false;

    const TARGET_PATH =
        '/storage/emulated/0/MiMusica';

    // =========================================
    // IMAGEN TEMPORAL
    //
    // De momento NO intentamos cargar cover.jpg.
    // La zona queda preparada para la carátula
    // cuadrada y mostramos la nota musical.
    // =========================================

    const DEFAULT_COVER =
        '<div class="music-note-placeholder">🎵</div>';

    // =========================================
    // CAMBIO DE PANTALLA
    // =========================================

    function goToScreen(targetScreen) {
        [s1, s2, s3].forEach(screen => {
            screen.classList.remove('active');
        });

        targetScreen.classList.add('active');
    }

    // =========================================
    // VOLVER A ÁLBUMES
    // =========================================

    if (btnBackToAlbums) {
        btnBackToAlbums.addEventListener('click', () => {
            goToScreen(s1);
        });
    }

    // =========================================
    // VOLVER A CANCIONES
    // =========================================

    if (btnBackToSongs) {
        btnBackToSongs.addEventListener('click', () => {
            stopAudio();
            goToScreen(s2);
        });
    }

    // =========================================
    // PARAR AUDIO
    // =========================================

    function stopAudio() {
        audioElement.pause();
        audioElement.currentTime = 0;

        btnPlayPause.textContent = '▶';

        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'none';
        }
    }

    // =========================================
    // INICIO
    // =========================================

    initApp();

    async function initApp() {
        if (
            window.Capacitor &&
            window.Capacitor.Plugins
        ) {
            await requestAppPermissions();
            await readAbsolutePath();
        } else {
            renderDemoData();
        }
    }

    // =========================================
    // PERMISOS
    // =========================================

    async function requestAppPermissions() {
        const { Filesystem } =
            window.Capacitor.Plugins;

        try {
            if (
                Filesystem &&
                Filesystem.requestPermissions
            ) {
                await Filesystem.requestPermissions();
            }
        } catch (e) {
            console.log(
                'Error pidiendo permisos filesystem'
            );
        }

        if (
            'Notification' in window &&
            Notification.permission !== 'granted'
        ) {
            try {
                await Notification.requestPermission();
            } catch (e) {}
        }
    }

    // =========================================
    // OBTENER NOMBRE
    // =========================================

    function parseItemName(item) {

        if (!item) {
            return '';
        }

        if (typeof item === 'string') {
            return decodeURIComponent(item);
        }

        if (item.name) {
            return item.name;
        }

        if (item.uri || item.path) {

            const rawPath =
                item.uri || item.path;

            const decoded =
                decodeURIComponent(rawPath);

            const parts =
                decoded.split('/');

            return (
                parts[parts.length - 1] ||
                parts[parts.length - 2]
            );
        }

        return '';
    }

    // =========================================
    // LEER MiMusica
    //
    // ESTA PARTE SE MANTIENE COMO LA VERSIÓN
    // QUE YA SABÍAMOS QUE FUNCIONABA.
    // =========================================

    async function readAbsolutePath() {

        try {

            const { Filesystem } =
                window.Capacitor.Plugins;

            albumsMap = {};

            let globalIdx = 0;

            const rootDir =
                await Filesystem.readdir({
                    path: TARGET_PATH
                }).catch(() => null);

            if (
                !rootDir ||
                !rootDir.files ||
                rootDir.files.length === 0
            ) {

                albumsList.innerHTML = `
                    <p style="
                        grid-column:1/-1;
                        padding:20px;
                        text-align:center;
                        color:#aaa;
                    ">
                        No se encontraron álbumes.
                    </p>
                `;

                return;
            }

            // =====================================
            // RECORRER CARPETAS
            // =====================================

            for (const item of rootDir.files) {

                const folderName =
                    parseItemName(item);

                if (!folderName) {
                    continue;
                }

                const cleanFolderPath =
                    `${TARGET_PATH}/${folderName}`;

                let subDir = null;

                try {

                    subDir =
                        await Filesystem.readdir({
                            path: cleanFolderPath
                        });

                } catch (e1) {

                    if (
                        typeof item === 'object' &&
                        item.uri
                    ) {

                        try {

                            subDir =
                                await Filesystem.readdir({
                                    path: item.uri
                                });

                        } catch (e2) {}
                    }
                }

                // =================================
                // SI LA CARPETA TIENE ARCHIVOS
                // =================================

                if (
                    subDir &&
                    subDir.files &&
                    subDir.files.length > 0
                ) {

                    const tracks = [];

                    // =================================
                    // LEER ARCHIVOS
                    // =================================

                    subDir.files.forEach(fileInfo => {

                        const fileName =
                            parseItemName(fileInfo);

                        if (
                            !fileName ||
                            fileName.startsWith('.')
                        ) {
                            return;
                        }

                        const rawFilePath =
                            (
                                typeof fileInfo === 'object' &&
                                fileInfo.uri
                            )
                                ? fileInfo.uri
                                : `${cleanFolderPath}/${fileName}`;

                        // =================================
                        // COVER
                        //
                        // IMPORTANTE:
                        // DE MOMENTO LA IGNORAMOS.
                        //
                        // Esto nos permite comprobar que
                        // los álbumes y las canciones vuelven
                        // a funcionar independientemente
                        // del problema de cover.jpg.
                        // =================================

                        if (
                            fileName.toLowerCase() === 'cover.jpg' ||
                            fileName.toLowerCase() === 'cover.jpeg' ||
                            fileName.toLowerCase() === 'cover.png'
                        ) {

                            return;
                        }

                        // =================================
                        // CANCIONES
                        // =================================

                        if (
                            fileName.match(
                                /\.(mp3|flac|wav|m4a|ogg)$/i
                            )
                        ) {

                            tracks.push({

                                id: globalIdx++,

                                title:
                                    fileName.replace(
                                        /\.[^/.]+$/,
                                        ''
                                    ),

                                fileName:
                                    fileName,

                                folder:
                                    folderName,

                                url:
                                    window.Capacitor.convertFileSrc(
                                        rawFilePath
                                    )
                            });
                        }

                    });

                    // =================================
                    // CREAR ÁLBUM
                    // =================================

                    if (tracks.length > 0) {

                        tracks.sort(
                            (a, b) =>
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

                            // De momento nota musical
                            cover: null,

                            tracks: tracks
                        };
                    }
                }
            }

            // =================================
            // MOSTRAR ÁLBUMES
            // =================================

            renderAlbums();

        } catch (err) {

            console.error(
                'Error general:',
                err
            );

            renderDemoData();
        }
    }

    // =========================================
    // DATOS DE DEMOSTRACIÓN
    // =========================================

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

    // =========================================
    // PANTALLA 1: ÁLBUMES
    //
    // 2 COLUMNAS
    // ORDEN A-Z
    // SIN TEXTO DEBAJO
    // =========================================

    function renderAlbums() {

        albumsList.innerHTML = '';

        const albumKeys =
            Object.keys(albumsMap).sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        undefined,
                        {
                            sensitivity: 'base'
                        }
                    )
            );

        albumKeys.forEach(folderName => {

            const albumData =
                albumsMap[folderName];

            const item =
                document.createElement('div');

            item.className =
                'album-card';

            // =====================================
            // SOLO LA ZONA CUADRADA
            // =====================================

            item.innerHTML = `
                <div class="album-cover-box">
                    ${DEFAULT_COVER}
                </div>
            `;

            // =====================================
            // ABRIR ÁLBUM
            // =====================================

            item.addEventListener('click', () => {

                songsHeaderTitle.textContent =
                    folderName;

                renderSongs(albumData);

                goToScreen(s2);
            });

            albumsList.appendChild(item);
        });
    }

    // =========================================
    // PANTALLA 2: CANCIONES
    // =========================================

    function renderSongs(albumData) {

        songsList.innerHTML = '';

        albumData.tracks.forEach(track => {

            const item =
                document.createElement('div');

            item.className =
                'list-item';

            item.innerHTML = `
                <div class="song-text">
                    <h4>${track.title}</h4>
                </div>
            `;

            item.addEventListener('click', () => {

                playTrack(
                    track,
                    albumData
                );

                goToScreen(s3);
            });

            songsList.appendChild(item);
        });
    }

    // =========================================
    // PANTALLA 3: REPRODUCTOR
    // =========================================

    function playTrack(
        track,
        albumData
    ) {

        currentPlaylist =
            albumData.tracks;

        currentIndex =
            currentPlaylist.findIndex(
                t => t.id === track.id
            );

        playerTitle.textContent =
            track.title;

        playerArtistAlbum.textContent =
            track.folder;

        // =====================================
        // DE MOMENTO NOTA MUSICAL
        // =====================================

        playerCover.innerHTML =
            DEFAULT_COVER;

        // =====================================
        // REPRODUCCIÓN
        // =====================================

        if (track.url) {

            audioElement.src =
                track.url;

            audioElement
                .play()
                .catch(e =>
                    console.log(
                        'Error de reproducción:',
                        e
                    )
                );
        }

        // =====================================
        // MEDIA SESSION
        // =====================================

        if ('mediaSession' in navigator) {

            navigator.mediaSession.metadata =
                new MediaMetadata({

                    title:
                        track.title,

                    artist:
                        track.folder,

                    album:
                        track.folder
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
        }
    }

    // =========================================
    // FORMATO TIEMPO
    // =========================================

    function formatTime(seconds) {

        if (
            isNaN(seconds) ||
            seconds === Infinity
        ) {
            return '0:00';
        }

        const mins =
            Math.floor(seconds / 60);

        const secs =
            Math.floor(seconds % 60);

        return (
            `${mins}:` +
            `${secs < 10 ? '0' : ''}` +
            `${secs}`
        );
    }

    // =========================================
    // AUDIO PLAY
    // =========================================

    audioElement.addEventListener(
        'play',
        () => {

            btnPlayPause.textContent =
                '⏸';

            if ('mediaSession' in navigator) {

                navigator.mediaSession.playbackState =
                    'playing';
            }
        }
    );

    // =========================================
    // AUDIO PAUSE
    // =========================================

    audioElement.addEventListener(
        'pause',
        () => {

            btnPlayPause.textContent =
                '▶';

            if ('mediaSession' in navigator) {

                navigator.mediaSession.playbackState =
                    'paused';
            }
        }
    );

    // =========================================
    // PROGRESO
    // =========================================

    audioElement.addEventListener(
        'timeupdate',
        () => {

            if (
                !isSeeking &&
                audioElement.duration
            ) {

                const progress =
                    (
                        audioElement.currentTime /
                        audioElement.duration
                    ) * 100;

                seekBar.value =
                    progress;

                currentTimeEl.textContent =
                    formatTime(
                        audioElement.currentTime
                    );

                totalDurationEl.textContent =
                    formatTime(
                        audioElement.duration
                    );
            }
        }
    );

    // =========================================
    // METADATOS AUDIO
    // =========================================

    audioElement.addEventListener(
        'loadedmetadata',
        () => {

            totalDurationEl.textContent =
                formatTime(
                    audioElement.duration
                );
        }
    );

    // =========================================
    // SEEK
    // =========================================

    seekBar.addEventListener(
        'input',
        () => {
            isSeeking = true;
        }
    );

    seekBar.addEventListener(
        'change',
        () => {

            if (audioElement.duration) {

                audioElement.currentTime =
                    (
                        seekBar.value / 100
                    ) *
                    audioElement.duration;
            }

            isSeeking = false;
        }
    );

    // =========================================
    // PLAY / PAUSE
    // =========================================

    btnPlayPause.addEventListener(
        'click',
        () => {

            if (!audioElement.src) {
                return;
            }

            if (audioElement.paused) {

                audioElement.play();

            } else {

                audioElement.pause();
            }
        }
    );

    // =========================================
    // SIGUIENTE
    // =========================================

    btnNext.addEventListener(
        'click',
        () => {

            if (
                currentPlaylist.length === 0 ||
                currentIndex === -1
            ) {
                return;
            }

            currentIndex =
                (
                    currentIndex + 1
                ) %
                currentPlaylist.length;

            playTrack(
                currentPlaylist[currentIndex],
                albumsMap[
                    currentPlaylist[currentIndex]
                        .folder
                ]
            );
        }
    );

    // =========================================
    // ANTERIOR
    // =========================================

    btnPrev.addEventListener(
        'click',
        () => {

            if (
                currentPlaylist.length === 0 ||
                currentIndex === -1
            ) {
                return;
            }

            currentIndex =
                (
                    currentIndex -
                    1 +
                    currentPlaylist.length
                ) %
                currentPlaylist.length;

            playTrack(
                currentPlaylist[currentIndex],
                albumsMap[
                    currentPlaylist[currentIndex]
                        .folder
                ]
            );
        }
    );

    // =========================================
    // AL TERMINAR CANCIÓN
    // =========================================

    audioElement.addEventListener(
        'ended',
        () => {
            btnNext.click();
        }
    );
});
