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

    // Eventos de botones ATRÁS
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

    // Función auxiliar para obtener el nombre del archivo/carpeta de forma segura en Android
    function getItemName(item) {
        if (typeof item === 'string') return item;
        if (item && item.name) return item.name;
        if (item && item.path) {
            const parts = item.path.split('/');
            return parts[parts.length - 1];
        }
        return '';
    }

    // Lectura nativa y profunda de /storage/emulated/0/MiMusica
    async function readAbsolutePath() {
        try {
            const { Filesystem } = window.Capacitor.Plugins;

            // Solicitar permisos de almacenamiento
            try {
                await Filesystem.requestPermissions();
            } catch (e) {
                console.log('Permisos solicitados');
            }

            albumsMap = {};
            let globalIdx = 0;

            // 1. Leer la carpeta raíz /storage/emulated/0/MiMusica
            const rootDir = await Filesystem.readdir({ path: TARGET_PATH }).catch(() => null);

            if (!rootDir || !rootDir.files || rootDir.files.length === 0) {
                albumsList.innerHTML = `
                    <div style="padding: 30px 20px; text-align: center;">
                        <p style="color: #ffffff; font-weight: bold; font-size: 16px; margin-bottom: 8px;">No se encontró la carpeta MiMusica</p>
                        <p style="color: #a0a0a0; font-size: 14px; line-height: 1.4;">
                            Asegúrate de tener creada la carpeta:<br>
                            <b style="color: #4caf50;">/storage/emulated/0/MiMusica</b><br>
                            en la memoria interna y guarda ahí tus álbumes.
                        </p>
                    </div>`;
                return;
            }

            // 2. Procesar todos los elementos dentro de MiMusica de forma asíncrona síncrona
            for (const item of rootDir.files) {
                const itemName = getItemName(item);
                if (!itemName) continue;

                const albumFolderPath = `${TARGET_PATH}/${itemName}`;

                try {
                    // Intentar leer como subcarpeta (Álbum)
                    const subDir = await Filesystem.readdir({ path: albumFolderPath });

                    if (subDir && subDir.files && subDir.files.length > 0) {
                        subDir.files.forEach(fileInfo => {
                            const fileName = getItemName(fileInfo);
                            if (fileName && fileName.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
                                const filePath = `${albumFolderPath}/${fileName}`;
                                const track = {
                                    id: globalIdx++,
                                    title: fileName.replace(/\.[^/.]+$/, ""),
                                    folder: itemName,
                                    url: window.Capacitor.convertFileSrc(filePath)
                                };

                                if (!albumsMap[itemName]) albumsMap[itemName] = [];
                                albumsMap[itemName].push(track);
                            }
                        });
                    }
                } catch (subErr) {
                    // Si no es subcarpeta, verificar si es un archivo de música en la raíz de MiMusica
                    if (itemName.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
                        const filePath = `${TARGET_PATH}/${itemName}`;
                        const track = {
                            id: globalIdx++,
                            title: itemName.replace(/\.[^/.]+$/, ""),
                            folder: 'Varios',
                            url: window.Capacitor.convertFileSrc(filePath)
                        };

                        if (!albumsMap['Varios']) albumsMap['Varios'] = [];
                        albumsMap['Varios'].push(track);
                    }
                }
            }

            // 3. Comprobar resultado final del escaneo
            if (Object.keys(albumsMap).length === 0) {
                albumsList.innerHTML = `
                    <div style="padding: 30px 20px; text-align: center;">
                        <p style="color: #ffffff; font-weight: bold; font-size: 16px; margin-bottom: 8px;">Carpeta "MiMusica" detectada</p>
                        <p style="color: #a0a0a0; font-size: 14px; line-height: 1.4;">
                            No se encontraron archivos audio dentro.<br>
                            Asegúrate de que tus archivos tengan extensión <b>.mp3</b>.
                        </p>
                    </div>`;
                return;
            }

            renderAlbums();

        } catch (err) {
            console.error('Error al acceder a la ruta nativa:', err);
            renderDemoData();
        }
    }

    // Datos simulados para navegador de PC
    function renderDemoData() {
        albumsMap = {
            "Rock Clásico": [
                { id: 1, title: "01 - Song One", folder: "Rock Clásico", url: "" },
                { id: 2, title: "02 - Song Two", folder: "Rock Clásico", url: "" }
            ]
        };
        renderAlbums();
    }

    // Render PANTALLA 1 (Álbumes)
    function renderAlbums() {
        albumsList.innerHTML = '';
        const albumKeys = Object.keys(albumsMap);

        if (albumKeys.length === 0) return;

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

    // Render PANTALLA 2 (Canciones)
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
