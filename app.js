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

    // Elemento Audio HTML5 en memoria
    const audioElement = new Audio();

    // Estado global de la app
    let albumsMap = {};
    let currentPlaylist = [];
    let currentIndex = -1;
    let isPlaying = false;

    // Control de pantallas
    function goToScreen(targetScreen) {
        [s1, s2, s3].forEach(s => s.classList.remove('active'));
        targetScreen.classList.add('active');
    }

    // Eventos de botones ATRÁS
    if (btnBackToAlbums) btnBackToAlbums.addEventListener('click', () => goToScreen(s1));
    if (btnBackToSongs) btnBackToSongs.addEventListener('click', () => goToScreen(s2));

    // Inicialización al abrir la app
    initApp();

    async function initApp() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            await readNativeMusicFolder();
        } else {
            renderDemoData(); // Datos de muestra si se abre en navegador PC
        }
    }

    // Lectura automática de música en Android
    async function readNativeMusicFolder() {
        try {
            const { Filesystem } = window.Capacitor.Plugins;

            // Solicitar permisos de almacenamiento
            const perm = await Filesystem.requestPermissions();
            if (perm.publicStorage !== 'granted') {
                albumsList.innerHTML = `<p style="padding: 20px; color: #a0a0a0; text-align: center;">Se requieren permisos de almacenamiento para ver tu música.</p>`;
                return;
            }

            // Escanear carpeta de música estándar de Android
            const result = await Filesystem.readdir({
                path: 'Music',
                directory: 'DOCUMENTS'
            }).catch(() => null);

            if (!result || !result.files || result.files.length === 0) {
                albumsList.innerHTML = `<p style="padding: 20px; color: #a0a0a0; text-align: center;">No se encontraron canciones en la carpeta Música.</p>`;
                return;
            }

            albumsMap = {};
            let globalIdx = 0;

            result.files.forEach(fileInfo => {
                const fileName = typeof fileInfo === 'string' ? fileInfo : fileInfo.name;
                if (fileName.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
                    const track = {
                        id: globalIdx++,
                        title: fileName.replace(/\.[^/.]+$/, ""),
                        folder: 'Música Local',
                        url: window.Capacitor.convertFileSrc(fileInfo.uri || fileName)
                    };

                    if (!albumsMap['Música Local']) albumsMap['Música Local'] = [];
                    albumsMap['Música Local'].push(track);
                }
            });

            renderAlbums();

        } catch (err) {
            console.error('Error al leer archivos:', err);
            renderDemoData();
        }
    }

    // Datos simulados para pruebas en navegador Web (PC)
    function renderDemoData() {
        albumsMap = {
            "Álbum de Prueba 1": [
                { id: 1, title: "01 - Canción de Ejemplo A", folder: "Álbum de Prueba 1", url: "" },
                { id: 2, title: "02 - Canción de Ejemplo B", folder: "Álbum de Prueba 1", url: "" }
            ],
            "Álbum de Prueba 2": [
                { id: 3, title: "01 - Tema Instrumental", folder: "Álbum de Prueba 2", url: "" }
            ]
        };
        renderAlbums();
    }

    // Render PANTALLA 1 (Álbumes)
    function renderAlbums() {
        albumsList.innerHTML = '';
        const albumKeys = Object.keys(albumsMap);

        if (albumKeys.length === 0) {
            albumsList.innerHTML = `<p style="padding: 20px; color: #a0a0a0; text-align: center;">No hay álbumes disponibles.</p>`;
            return;
        }

        albumKeys.forEach(folderName => {
            const tracks = albumsMap[folderName];
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="album-cover-placeholder">🎵</div>
                <div class="album-text">
                    <h4>${folderName}</h4>
                    <p>${tracks.length} canciones</p>
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

    // Render PANTALLA 2 (Canciones del Álbum)
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

    // Render PANTALLA 3 (Reproductor)
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

    // Controles del Reproductor
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
