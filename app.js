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

    // Ruta fija nativa única
    const TARGET_PATH = '/storage/emulated/0/MiMusica';

    // Extensiones de audio soportadas
    const AUDIO_EXTENSIONS = /\.(mp3|m4a|flac|wav|ogg|opus|aac|wma)$/i;

    // Control de pantallas
    function goToScreen(targetScreen) {
        [s1, s2, s3].forEach(s => s.classList.remove('active'));
        targetScreen.classList.add('active');
    }

    // Eventos de navegación ATRÁS
    if (btnBackToAlbums) btnBackToAlbums.addEventListener('click', () => goToScreen(s1));
    if (btnBackToSongs) btnBackToSongs.addEventListener('click', () => goToScreen(s2));

    // Inicialización
    initApp();

    async function initApp() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            await readAbsolutePath();
        } else {
            renderDemoData();
        }
    }

    // Extraer el nombre exacto de carpetas o archivos en Android
    function getItemName(item) {
        if (typeof item === 'string') return item;
        if (item && item.name) return item.name;
        if (item && item.path) {
            const parts = item.path.split('/');
            return parts[parts.length - 1];
        }
        return '';
    }

    // Escaneo estricto de /storage/emulated/0/MiMusica
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

            // 1. Obtener los álbumes (subcarpetas dentro de /MiMusica)
            const rootDir = await Filesystem.readdir({ path: TARGET_PATH }).catch(() => null);

            if (!rootDir || !rootDir.files || rootDir.files.length === 0) {
                albumsList.innerHTML = `
                    <div style="padding: 30px 20px; text-align: center;">
                        <p style="color: #ffffff; font-weight: bold; font-size: 16px; margin-bottom: 8px;">No hay álbumes</p>
                        <p style="color: #a0a0a0; font-size: 14px;">Crea carpetas dentro de <b>/storage/emulated/0/MiMusica</b> con tus canciones.</p>
                    </div>`;
                return;
            }

            // 2. Recorrer cada carpeta de Álbum de forma estricta
            for (const item of rootDir.files) {
                const folderName = getItemName(item);
                if (!folderName) continue;

                const albumFolderPath = `${TARGET_PATH}/${folderName}`;

                try {
                    // Leer directamente las canciones de esta subcarpeta (Álbum)
                    const subDir = await Filesystem.readdir({ path: albumFolderPath });

                    if (subDir && subDir.files) {
                        subDir.files.forEach(fileInfo => {
                            const fileName = getItemName(fileInfo);
                            if (fileName && fileName.match(AUDIO_EXTENSIONS)) {
                                const filePath = `${albumFolderPath}/${fileName}`;
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
                } catch (errSub) {
                    // Si no es carpeta se ignora (cumpliendo tu regla de orden estricto)
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
            console.error('Error al acceder al almacenamiento:', err);
            renderDemoData();
        }
    }

    // Datos simulados para navegador PC
    function renderDemoData() {
        albumsMap = {
            "Álbum Ejemplo": [
                { id: 1, title: "01 - Canción 1", folder: "Álbum Ejemplo", url: "" },
                { id: 2, title: "02 - Canción 2", folder: "Álbum Ejemplo", url: "" }
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

    // PANTALLA 2: Lista de Canciones del Álbum
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
            }).catch(e => console.log('Error de reproducción:', e));
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
