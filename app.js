document.addEventListener('DOMContentLoaded', () => {
    // Referencias a pantallas
    const s1 = document.getElementById('screen-welcome');
    const s2 = document.getElementById('screen-albums');
    const s3 = document.getElementById('screen-songs');
    const s4 = document.getElementById('screen-player');

    // Botones
    const btnSelectFolder = document.getElementById('btn-select-folder');
    const btnChangeFolder = document.getElementById('btn-change-folder');
    const fileInput = document.getElementById('file-input');

    const btnBackToWelcome = document.getElementById('btn-back-to-welcome');
    const btnBackToAlbums = document.getElementById('btn-back-to-albums');
    const btnBackToSongs = document.getElementById('btn-back-to-songs');

    // Listas y Textos
    const albumsList = document.getElementById('albums-list');
    const songsList = document.getElementById('songs-list');
    const songsHeaderTitle = document.getElementById('songs-header-title');

    // Reproductor
    const playerTitle = document.getElementById('player-title');
    const playerArtistAlbum = document.getElementById('player-artist-album');
    const audioElement = document.getElementById('audio-element');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    // Estado de la app
    let albumsMap = {};
    let currentPlaylist = [];
    let currentIndex = -1;
    let isPlaying = false;

    // Control de navegación entre las 4 pantallas
    function goToScreen(targetScreen) {
        [s1, s2, s3, s4].forEach(s => s.classList.remove('active'));
        targetScreen.classList.add('active');
    }

    // Botones ATRÁS
    btnBackToWelcome.addEventListener('click', () => goToScreen(s1));
    btnBackToAlbums.addEventListener('click', () => goToScreen(s2));
    btnBackToSongs.addEventListener('click', () => goToScreen(s3));

    // Eventos del Selector de Carpetas
    btnSelectFolder.addEventListener('click', triggerFolderPicker);
    if (btnChangeFolder) btnChangeFolder.addEventListener('click', triggerFolderPicker);

    function triggerFolderPicker() {
        // Si estamos en la APK nativa con Capacitor Filesystem
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            readNativeDirectory();
        } else {
            // Fallback para pruebas en navegador Web PC
            fileInput.click();
        }
    }

    // Lógica para Navegador Web (PC)
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        processFilesList(files);
    });

    function processFilesList(files) {
        const audioFiles = files.filter(f => f.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i));

        if (audioFiles.length === 0) {
            alert('No se encontraron canciones en esta carpeta.');
            return;
        }

        albumsMap = {};
        audioFiles.forEach((file, idx) => {
            const parts = (file.webkitRelativePath || file.name).split('/');
            let folderName = parts.length > 1 ? parts[parts.length - 2] : 'Álbum Único';

            const track = {
                id: idx,
                title: file.name.replace(/\.[^/.]+$/, ""),
                folder: folderName,
                url: URL.createObjectURL(file)
            };

            if (!albumsMap[folderName]) albumsMap[folderName] = [];
            albumsMap[folderName].push(track);
        });

        renderAlbums();
        goToScreen(s2);
    }

    // Lógica para App Nativa Android (Capacitor)
    async function readNativeDirectory() {
        try {
            const { Filesystem } = window.Capacitor.Plugins;
            
            // Solicitar permisos de lectura en Android
            const perm = await Filesystem.requestPermissions();
            if (perm.publicStorage !== 'granted') {
                alert('Se requieren permisos para acceder a tus archivos de audio.');
                return;
            }

            // Seleccionar carpeta o leer directorio de música por defecto
            const result = await Filesystem.readdir({
                path: 'Music',
                directory: 'DOCUMENTS'
            }).catch(() => null);

            if (!result || !result.files) {
                // Fallback al selector HTML si el directorio por defecto está vacío
                fileInput.click();
                return;
            }

            // Procesar los archivos devueltos por Android
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

            if (Object.keys(albumsMap).length === 0) {
                fileInput.click(); // Abrir fallback si no hay audios en la ruta predeterminada
                return;
            }

            renderAlbums();
            goToScreen(s2);

        } catch (err) {
            console.error('Error al leer carpetas nativas:', err);
            fileInput.click(); // En caso de fallo en Android, usamos el selector del sistema
        }
    }

    // Render PANTALLA 2 (Álbumes)
    function renderAlbums() {
        albumsList.innerHTML = '';
        Object.keys(albumsMap).forEach(folderName => {
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
                songsHeaderTitle.textContent = "CANCIONES";
                renderSongs(tracks);
                goToScreen(s3);
            });
            albumsList.appendChild(item);
        });
    }

    // Render PANTALLA 3 (Canciones)
    function renderSongs(tracks) {
        songsList.innerHTML = '';
        tracks.forEach(track => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="song-checkbox"></div>
                <div class="song-text">
                    <h4>${track.title}</h4>
                </div>
            `;
            item.addEventListener('click', () => {
                playTrack(track, tracks);
                goToScreen(s4);
            });
            songsList.appendChild(item);
        });
    }

    // Render y Control PANTALLA 4 (Reproductor)
    function playTrack(track, playlist) {
        currentPlaylist = playlist;
        currentIndex = currentPlaylist.findIndex(t => t.id === track.id);

        audioElement.src = track.url;
        audioElement.play();
        isPlaying = true;

        playerTitle.textContent = track.title;
        playerArtistAlbum.textContent = `${track.folder}`;
        btnPlayPause.textContent = '⏸';
    }

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
