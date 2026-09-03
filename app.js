document.addEventListener('DOMContentLoaded', () => {
    // Pantallas
    const s1 = document.getElementById('screen-albums');
    const s2 = document.getElementById('screen-songs');
    const s3 = document.getElementById('screen-player');

    // Botones Volver
    const btnBackToAlbums = document.getElementById('btn-back-to-albums');
    const btnBackToSongs = document.getElementById('btn-back-to-songs');

    // Listas y títulos
    const albumsList = s1.querySelector('.albums-grid');
    const songsList = s2.querySelector('.list-container');
    const songsHeaderTitle = document.getElementById('songs-header-title');

    // Elementos del Reproductor
    const playerCover = document.getElementById('player-cover');
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
    const COVERS_PATH = `${TARGET_PATH}/COVERS`;

    // Plantilla visual para cuando un álbum NO tiene imagen
    function getFallbackCoverHTML(albumName) {
        return `<div class="album-title-placeholder"><span>${albumName}</span></div>`;
    }

    // El botón conserva siempre su círculo exterior.
    // Solo cambia el icono interior mediante CSS.
    function setPlayPauseIcon(isPlaying) {
        if (!btnPlayPause) return;

        const icon =
            btnPlayPause.querySelector('.play-pause-icon');

        if (icon) {
            icon.classList.toggle('is-playing', isPlaying);
        }

        btnPlayPause.setAttribute(
            'aria-label',
            isPlaying ? 'Pausar' : 'Reproducir'
        );
    }

    // =========================================
    // NAVEGACIÓN ENTRE PANTALLAS
    // =========================================

    function goToScreen(targetScreen) {
        [s1, s2, s3].forEach(s => s.classList.remove('active'));
        targetScreen.classList.add('active');
    }

    if (btnBackToAlbums) {
        btnBackToAlbums.addEventListener('click', () => {
            goToScreen(s1);
        });
    }

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

        setPlayPauseIcon(false);

        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'none';
        }
    }

    // =========================================
    // INICIO
    // =========================================

    initApp();

    async function initApp() {

        if (window.Capacitor && window.Capacitor.Plugins) {

            await requestAppPermissions();

            await readAbsolutePath();

        } else {

            renderDemoData();
        }
    }

    // =========================================
    // PERMISOS DEL SISTEMA
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
                'Error pidiendo permisos filesystem:',
                e
            );
        }

        // Permiso de notificaciones
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
    // OBTENER NOMBRE DE ARCHIVO/CARPETA
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
                parts[parts.length - 2] ||
                ''
            );
        }

        return '';
    }

    // =========================================
    // CARGAR COVER DESDE LA CARPETA COVERS
    // =========================================

    async function loadExternalCover(Filesystem, albumName) {
        const extensions = ['jpg', 'jpeg', 'png'];

        for (const ext of extensions) {
            const absolutePath = `${COVERS_PATH}/${albumName}.${ext}`;

            // Intento 1: Convertir la ruta absoluta directamente con Capacitor
            if (window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function') {
                try {
                    const converted = window.Capacitor.convertFileSrc(absolutePath);
                    if (converted) return converted;
                } catch (e) {}
            }

            // Intento 2: Leer el archivo como Base64 por si no permite convertFileSrc
            try {
                const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
                const result = await Filesystem.readFile({ path: absolutePath });
                if (result && result.data) {
                    return `data:${mimeType};base64,${result.data}`;
                }
            } catch (e) {}
        }

        return null;
    }

    // =========================================
    // LEER MiMusica
    // =========================================

    async function readAbsolutePath() {

        try {

            const { Filesystem } =
                window.Capacitor.Plugins;

            albumsMap = {};

            let globalIdx = 0;

            const rootDir =
                await Filesystem
                    .readdir({
                        path: TARGET_PATH
                    })
                    .catch(() => null);

            // =====================================
            // NO HAY CARPETAS
            // =====================================

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
            // RECORRER CADA ÁLBUM
            // =====================================

            for (const item of rootDir.files) {

                const folderName =
                    parseItemName(item);

                // Omitir nombres vacíos, ocultos o la propia carpeta COVERS
                if (!folderName || folderName.startsWith('.') || folderName.toUpperCase() === 'COVERS') {
                    continue;
                }

                const cleanFolderPath =
                    `${TARGET_PATH}/${folderName}`;

                let subDir = null;

                // =================================
                // LEER CARPETA DEL ÁLBUM
                // =================================

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

                        } catch (e2) {

                            console.log(
                                'No se pudo leer carpeta:',
                                folderName
                            );
                        }
                    }
                }

                if (
                    !subDir ||
                    !subDir.files ||
                    subDir.files.length === 0
                ) {
                    continue;
                }

                // =================================
                // BUSCAR COVER EN /MiMusica/COVERS
                // =================================

                let coverUrl = await loadExternalCover(Filesystem, folderName);

                const tracks = [];

                // =================================
                // RECORRER ARCHIVOS DE AUDIO
                // =================================

                for (const fileInfo of subDir.files) {

                    const fileName =
                        parseItemName(fileInfo);

                    if (
                        !fileName ||
                        fileName.startsWith('.')
                    ) {
                        continue;
                    }

                    const rawFilePath =
                        (
                            typeof fileInfo === 'object' &&
                            fileInfo.uri
                        )
                            ? fileInfo.uri
                            : `${cleanFolderPath}/${fileName}`;

                    // =================================
                    // CANCIONES
                    // =================================

                    if (
                        fileName.match(
                            /\.(mp3|flac|wav|m4a|ogg)$/i
                        )
                    ) {

                        tracks.push({

                            id:
                                globalIdx++,

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
                }

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

                        cover:
                            coverUrl,

                        tracks:
                            tracks
                    };
                }
            }

            // =====================================
            // MOSTRAR ÁLBUMES
            // =====================================

            renderAlbums();

        } catch (err) {

            console.error(
                'Error general leyendo MiMusica:',
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

            "Álbum Ejemplo": {

                cover: null,

                tracks: [

                    {
                        id: 1,
                        title: "01 - Canción 1",
                        fileName: "01 - Canción 1.mp3",
                        folder: "Álbum Ejemplo",
                        url: ""
                    },

                    {
                        id: 2,
                        title: "02 - Canción 2",
                        fileName: "02 - Canción 2.mp3",
                        folder: "Álbum Ejemplo",
                        url: ""
                    }

                ]
            }
        };

        renderAlbums();
    }

    // =========================================
    // PANTALLA 1: ÁLBUMES
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
            // SI HAY COVER USAMOS LA IMAGEN, SI NO EL TÍTULO
            // =====================================

            const coverHTML =
                albumData.cover

                    ? `
                        <img
                            src="${albumData.cover}"
                            class="album-cover-img"
                            alt="Cover"
                        />
                    `

                    : getFallbackCoverHTML(folderName);

            item.innerHTML = `
                <div class="album-cover-box">
                    ${coverHTML}
                </div>
            `;

            // =====================================
            // ABRIR ÁLBUM
            // =====================================

            item.addEventListener(
                'click',
                () => {

                    songsHeaderTitle.textContent =
                        folderName;

                    renderSongs(
                        albumData
                    );

                    goToScreen(s2);
                }
            );

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
                    <h4>
                        ${track.title}
                    </h4>
                </div>
            `;

            item.addEventListener(
                'click',
                () => {

                    playTrack(
                        track,
                        albumData
                    );

                    goToScreen(s3);
                }
            );

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
        // COVER DEL REPRODUCTOR
        // =====================================

        if (albumData.cover) {

            playerCover.innerHTML = `
                <img
                    src="${albumData.cover}"
                    class="player-cover-img"
                    alt="Cover"
                />
            `;

        } else {

            playerCover.innerHTML =
                getFallbackCoverHTML(track.folder);
        }

        // =====================================
        // REPRODUCCIÓN
        // =====================================

        if (track.url) {

            audioElement.src =
                track.url;

            audioElement
                .play()
                .catch(
                    e =>
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
                () =>
                    audioElement.play()
            );

            navigator.mediaSession.setActionHandler(
                'pause',
                () =>
                    audioElement.pause()
            );

            navigator.mediaSession.setActionHandler(
                'previoustrack',
                () =>
                    btnPrev.click()
            );

            navigator.mediaSession.setActionHandler(
                'nexttrack',
                () =>
                    btnNext.click()
            );
        }
    }

    // =========================================
    // FORMATO DE TIEMPO
    // =========================================

    function formatTime(seconds) {

        if (
            isNaN(seconds) ||
            seconds === Infinity
        ) {
            return "0:00";
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

            setPlayPauseIcon(true);

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

            setPlayPauseIcon(false);

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

            const nextTrack =
                currentPlaylist[
                    currentIndex
                ];

            playTrack(
                nextTrack,
                albumsMap[
                    nextTrack.folder
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

            const previousTrack =
                currentPlaylist[
                    currentIndex
                ];

            playTrack(
                previousTrack,
                albumsMap[
                    previousTrack.folder
                ]
            );
        }
    );

    // =========================================
    // AL TERMINAR UNA CANCIÓN
    // =========================================

    audioElement.addEventListener(
        'ended',
        () => {
            btnNext.click();
        }
    );
});
