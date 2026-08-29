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
            await readSpecificFolder();
        } else {
            renderDemoData(); // Datos de muestra para navegador de PC
        }
    }

    // Lectura enfocada EXCLUSIVAMENTE en la carpeta "MiMusica"
    async function readSpecificFolder() {
        try {
            const { Filesystem } = window.Capacitor.Plugins;

            // Pedir permisos de almacenamiento
            try {
                await Filesystem.requestPermissions();
            } catch (e) {
                console.log('Permisos solicitados');
            }

            albumsMap = {};
            let globalIdx = 0;

            // Probar variantes comunes del nombre de la carpeta raíz
            const targetFolders = ['MiMusica', 'Mi Musica', 'Music/MiMusica'];
            let foundFolder = false;

            for (const folderName of targetFolders) {
                try {
                    // Intentar leer el contenido de la carpeta MiMusica
                    const rootDir = await Filesystem.readdir({
                        path: folderName,
                        directory: 'DOCUMENTS'
                    });

                    if (rootDir && rootDir.files) {
                        foundFolder = true;

                        for (const item of rootDir.files) {
                            const itemName = typeof item === 'string' ? item : item.name;

                            // Si es una subcarpeta (un Álbum), leemos sus canciones
                            try {
                                const subDir = await Filesystem.readdir({
                                    path: `${folderName}/${itemName}`,
                                    directory: 'DOCUMENTS'
                                });

                                if (subDir && subDir.files) {
                                    subDir.files.forEach(fileInfo => {
                                        const fileName = typeof fileInfo === 'string' ? fileInfo : fileInfo.name;
                                        if (fileName && fileName.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
                                            const track = {
                                                id: globalIdx++,
                                                title: fileName.replace(/\.[^/.]+$/, ""),
                                                folder: itemName,
                                                url: window.Capacitor.convertFileSrc(fileInfo.uri || `${folderName}/${itemName}/${fileName}`)
                                            };

                                            if (!albumsMap[itemName]) albumsMap[itemName] = [];
                                            albumsMap[itemName].push(track);
                                        }
                                    });
                                }
                            } catch (subErr) {
                                // Si es un archivo de audio directamente suelto dentro de MiMusica
                                if (itemName && itemName.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
                                    const track = {
                                        id: globalIdx++,
                                        title: itemName.replace(/\.[^/.]+$/, ""),
                                        folder: 'Varios',
                                        url: window.Capacitor.convertFileSrc(item.uri || `${folderName}/${itemName}`)
                                    };

                                    if (!albumsMap['Varios']) albumsMap['Varios'] = [];
                                    albumsMap['Varios'].push(track);
                                }
                            }
                        }
                        break; // Si encontró la carpeta MiMusica, no sigue buscando en las variantes
                    }
                } catch (err) {
                    continue;
                }
            }

            if (!foundFolder || Object.keys(albumsMap).length === 0) {
                albumsList.innerHTML = `
                    <div style="padding: 30px 20px; text-align: center;">
                        <p style="color: #ffffff; font-weight: bold; font-size: 16px; margin-bottom: 8px;">No se encontró la carpeta "MiMusica"</p>
                        <p style="color: #a0a0a0; font-size: 14px;">Crea una carpeta llamada <b style="color:#fff;">MiMusica</b> en la memoria de tu teléfono y guarda dentro tus carpetas de álbumes.</p>
                    </div>`;
                return;
            }

            renderAlbums();

        } catch (err) {
            console.error('Error al acceder a MiMusica:', err);
            renderDemoData();
        }
    }

    // Datos simulados para pruebas en navegador Web (PC)
    function renderDemoData() {
        albumsMap = {
            "Rock Clásico": [
                { id: 1, title: "01 - Song One", folder: "Rock Clásico", url: "" },
                { id: 2, title: "02 - Song Two", folder: "Rock Clásico", url: "" }
            ],
            "Jazz Session": [
                { id: 3, title: "01 - Smooth Track", folder: "Jazz Session", url: "" }
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
