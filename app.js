document.addEventListener('DOMContentLoaded', () => {
    // Referencias a las 3 pantallas
    const s1 = document.getElementById('screen-albums');
    const s2 = document.getElementById('screen-songs');
    const s3 = document.getElementById('screen-player');

    // Botones de navegación
    const btnBackToAlbums = s2.querySelector('.btn-back-footer');
    const btnBackToSongs = s3.querySelector('.btn-back-footer');

    // Elementos de la interfaz
    const albumsList = s1.querySelector('.list-container');
    const songsList = s2.querySelector('.list-container');
    const songsHeaderTitle = document.getElementById('songs-header-title');

    // Elementos del reproductor
    const playerTitle = s3.querySelector('.player-song-title');
    const playerArtistAlbum = s3.querySelector('.player-artist-album');
    const btnPrev = s3.querySelectorAll('.btn-ctrl')[0];
    const btnPlayPause = s3.querySelector('.btn-ctrl-main');
    const btnNext = s3.querySelectorAll('.btn-ctrl')[1];

    // Elemento Audio HTML5
    const audioElement = new Audio();

    // Estado global
    let albumsMap = {};
    let currentPlaylist = [];
    let currentIndex = -1;
    let isPlaying = false;

    // Ruta fija nativa
    const TARGET_PATH = '/storage/emulated/0/MiMusica';
    const AUDIO_EXTENSIONS = /\.(mp3|m4a|flac|wav|ogg|opus|aac|wma)$/i;

    // Control de pantallas
    function goToScreen(targetScreen) {
        [s1, s2, s3].forEach(s => s.classList.remove('active'));
        targetScreen.classList.add('active');
    }

    if (btnBackToAlbums) btnBackToAlbums.addEventListener('click', () => goToScreen(s1));
    if (btnBackToSongs) btnBackToSongs.addEventListener('click', () => goToScreen(s2));

    initApp();

    async function initApp() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            await readAbsolutePath();
        } else {
            renderDemoData();
        }
    }

    // Extraer el nombre visible del álbum o canción
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

    // Lectura nativa directa usando URI de Android
    async function readAbsolutePath() {
        try {
            const { Filesystem } = window.Capacitor.Plugins;

            try {
                await Filesystem.requestPermissions();
            } catch (e) {
                console.log('Permisos solicitados');
            }

            albumsMap = {};
            let globalIdx = 0;

            // 1. Leer la carpeta principal /storage/emulated/0/MiMusica
            const rootDir = await Filesystem.readdir({ path: TARGET_PATH }).catch(() => null);

            if (!rootDir || !rootDir.files || rootDir.files.length === 0) {
                albumsList.innerHTML = `
                    <div style="padding: 30px 20px; text-align: center;">
                        <p style="color: #ffffff; font-weight: bold;">No se encontró la carpeta MiMusica</p>
                        <p style="color: #a0a0a0; font-size: 14px;">Asegúrate de tener la carpeta /storage/emulated/0/MiMusica en tu memoria interna.</p>
                    </div>`;
                return;
            }

            // 2. Recorrer cada subcarpeta (Álbum) usando su URI nativa
            for (const item of rootDir.files) {
                const folderName = parseItemName(item);
                if (!folderName) continue;

                // Usamos la URI directa o la ruta limpia decodificada
                const subPath = (typeof item === 'object' && item.uri) ? item.uri : `${TARGET_PATH}/${folderName}`;

                try {
                    const subDir = await Filesystem.readdir({ path: subPath });

                    if (subDir && subDir.files && subDir.files.length > 0) {
                        subDir.files.forEach(fileInfo => {
                            const fileName = parseItemName(fileInfo);
                            if (fileName && fileName.match(AUDIO_EXTENSIONS)) {
                                // Obtener URI o ruta del archivo de audio
                                const filePath = (typeof fileInfo === 'object' && fileInfo.uri) 
                                    ? fileInfo.uri 
                                    : `${TARGET_PATH}/${folderName}/${fileName}`;

                                const track = {
                                    id: globalIdx++,
                                    title: fileName.replace(/\.[^/.]+$/, ""),
                                    folder: folderName,
                                    url: window.Capacitor.convertFileSrc(filePath)
                                };

                                if (!albumsMap[folderName]) albumsMap[folderName] = [];
                                albumsMap[folderName].push(track);
                            }
                        });
                    }
                } catch (subErr) {
                    console.log('Error leyendo subcarpeta:', subErr);
                }
            }

            if (Object.keys(albumsMap).length === 0) {
                albumsList.innerHTML = `
                    <div style="padding: 30px 20px; text-align: center;">
                        <p style="color: #ffffff; font-weight: bold;">Sin canciones de audio</p>
                        <p style="color: #a0a0a0; font-size: 14px;">No se encontraron canciones dentro de las carpetas de tus álbumes.</p>
                    </div>`;
                return;
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
                { id: 1, title: "01 - Canción 1", folder: "Álbum Ejemplo", url: "" }
            ]
        };
        renderAlbums();
    }

    // PANTALLA 1: Lista de Álbumes
    function renderAlbums() {
        albumsList.innerHTML = '';
        const albumKeys = Object.keys(albumsMap);

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

    // PANTALLA 2: Lista de Canciones
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

    // PANTALLA 3: Reproductor
    function playTrack(track, playlist) {
        currentPlaylist = playlist;
        currentIndex = currentPlaylist.findIndex(t => t.id === track.id);

        if (track.url) {
            audioElement.src = track.url;
            audioElement.play().then(() => {
                isPlaying = true;
                btnPlayPause.textContent = '⏸';
            }).catch(e => console.log('Error al reproducir:', e));
        }

        playerTitle.textContent = track.title;
        playerArtistAlbum.textContent = track.folder;
    }

    // Controles del reproductor
    btnPlayPause.addEventListener('click', () => {
        if (!audioElement.src) return;
        if (isPlaying) {
            audioElement.pause();
            btnPlayPause.textContent = '▶';
            isPlaying = false;
        } else {
            audioElement.play();
            btnPlayPause.textContent = '⏸';
            isPlaying = true;
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

    audioElement.addEventListener('ended', () => btnNext.click());
});
