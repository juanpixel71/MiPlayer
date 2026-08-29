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

    // Lectura nativa con fallback de rutas
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

            // 2. Recorrer cada subcarpeta (Álbum)
            for (const item of rootDir.files) {
                const folderName = parseItemName(item);
                if (!folderName) continue;

                // Construimos la ruta en texto plano decodificado
                const cleanFolderPath = `${TARGET_PATH}/${folderName}`;
                
                let subDir = null;

                // Intento 1: Leer mediante ruta en texto limpio decodificado
                try {
                    subDir = await Filesystem.readdir({ path: cleanFolderPath });
                } catch (e1) {
                    // Intento 2: Si falla, intentar usando la URI directa de Android
                    if (typeof item === 'object' && item.uri) {
                        try {
                            subDir = await Filesystem.readdir({ path: item.uri });
                        } catch (e2) {
                            subDir = null;
                        }
                    }
                }

                if (subDir && subDir.files && subDir.files.length > 0) {
                    subDir.files.forEach(fileInfo => {
                        const fileName = parseItemName(fileInfo);
                        
                        // Si el elemento no es vacío y no es una carpeta oculta de sistema (que empiece por .)
                        if (fileName && !fileName.startsWith('.')) {
                            // Ruta para el reproductor de audio
                            const rawFilePath = (typeof fileInfo === 'object' && fileInfo.uri) 
                                ? fileInfo.uri 
                                : `${cleanFolderPath}/${fileName}`;

                            const track = {
                                id: globalIdx++,
                                title: fileName.replace(/\.[^/.]+$/, ""),
                                folder: folderName,
                                url: window.Capacitor.convertFileSrc(rawFilePath)
                            };

                            if (!albumsMap[folderName]) albumsMap[folderName] = [];
                            albumsMap[folderName].push(track);
                        }
                    });
                }
            }

            if (Object.keys(albumsMap).length === 0) {
                albumsList.innerHTML = `
                    <div style="padding: 30px 20px; text-align: center;">
                        <p style="color: #ffffff; font-weight: bold;">Sin canciones detectadas</p>
                        <p style="color: #a0a0a0; font-size: 14px;">Revisa las canciones dentro de tus carpetas.</p>
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
