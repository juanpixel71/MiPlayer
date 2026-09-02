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

    // Imagen de sustitución cuando un álbum no tiene cover.jpg
    const DEFAULT_COVER =
        '<div class="music-note-placeholder">🎵</div>';

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
    // CARGAR COVER.JPG FORZANDO BASE64 PURO
    // =========================================

    async function loadCoverAsDataUrl(
        Filesystem,
        absolutePath,
        fallbackUri = null,
        mimeType = 'image/jpeg'
    ) {
        // Obligamos a Android a leer los bytes crudos de la imagen y transformarlos a Base64 text
        try {
            const result = await Filesystem.readFile({
                path: absolutePath
            });

            if (result && result.data) {
                return `data:${mimeType};base64,${result.data}`;
            }
        } catch (error) {
            console.log(
                'Error leyendo por ruta absoluta, probando Uri alternativa:',
                absolutePath
            );
        }

        if (fallbackUri) {
            try {
                const result = await Filesystem.readFile({
                    path: fallbackUri
                });

                if (result && result.data) {
                    return `data:${mimeType};base64,${result.data}`;
                }
            } catch (error) {
                console.log(
                    'No se pudo leer la cover por URI:',
                    fallbackUri
                );
            }
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

                if (!folderName) {
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
                // VARIABLES DEL ÁLBUM
                // =================================

                let coverUrl = null;

                const tracks = [];

                // =================================
                // RECORRER ARCHIVOS
                // =================================

                for (const fileInfo of subDir.files) {

                    const fileName =
                        parseItemName(fileInfo);

                    if (
                        !fileName ||
                        fileName.startsWith('.')
                    ) {
                        continue;
