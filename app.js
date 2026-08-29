document.addEventListener('DOMContentLoaded', () => {
    // Referencias a las 4 pantallas
    const screen1 = document.getElementById('screen-welcome');
    const screen2 = document.getElementById('screen-albums');
    const screen3 = document.getElementById('screen-songs');
    const screen4 = document.getElementById('screen-player');

    // Botones de Abrir y Seleccionar
    const btnSelectFolder = document.getElementById('btn-select-folder');
    const btnChangeFolder = document.getElementById('btn-change-folder-albums');
    const fileInput = document.getElementById('file-input');

    // Listas y Contenedores
    const albumsList = document.getElementById('albums-list');
    const songsList = document.getElementById('songs-list');
    const songsAlbumTitle = document.getElementById('songs-album-title');

    // Elementos del Reproductor (4ª Pantalla)
    const playerTitle = document.getElementById('player-title');
    const playerArtistAlbum = document.getElementById('player-artist-album');
    const audioElement = document.getElementById('audio-element');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    // Botones de navegación ATRÁS
    const btnBackToWelcome = document.getElementById('btn-back-to-welcome');
    const btnBackToAlbums = document.getElementById('btn-back-to-albums');
    const btnBackToSongs = document.getElementById('btn-back-to-songs');

    // Estado interno
    let foldersMap = {};
    let currentPlaylist = [];
    let currentIndex = -1;
    let isPlaying = false;

    // Función limpia para cambiar de pantalla
    function goToScreen(target) {
        screen1.classList.remove('active');
        screen2.classList.remove('active');
        screen3.classList.remove('active');
        screen4.classList.remove('active');
        target.classList.add('active');
    }

    // --- ACCIONES DE LOS BOTONES ATRÁS ---
    btnBackToWelcome.addEventListener('click', () => goToScreen(screen1));
    btnBackToAlbums.addEventListener('click', () => goToScreen(screen2));
    btnBackToSongs.addEventListener('click', () => goToScreen(screen3));

    // --- SELECCIÓN DE CARPETA ---
    btnSelectFolder.addEventListener('click', () => fileInput.click());
    if (btnChangeFolder) btnChangeFolder.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const audioFiles = files.filter(f => f.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i));

        if (audioFiles.length === 0) {
            alert('No se encontraron canciones en la carpeta seleccionada.');
            return;
        }

        foldersMap = {};
        audioFiles.forEach((file, index) => {
            // Extraer el nombre de la carpeta real donde está la canción
            const parts = (file.webkitRelativePath || file.name).split('/');
            let folderName = parts.length > 1 ? parts[parts.length - 2] : 'Música Suelta';

            const track = {
                id: index,
                title: file.name.replace(/\.[^/.]+$/, ""),
                folder: folderName,
                url: URL.createObjectURL(file)
            };

            if (!foldersMap[folderName]) foldersMap[folderName] = [];
            foldersMap[folderName].push(track);
        });

        renderAlbumsScreen();
        goToScreen(screen2); // Ir a la 2ª Pantalla (Álbumes)
    });

    // --- 2ª PANTALLA: MOSTRAR ÁLBUMES / CARPETAS ---
    function renderAlbumsScreen() {
        albumsList.innerHTML = '';
        Object.keys(foldersMap).forEach(folderName => {
            const tracks = foldersMap[folderName];
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="album-icon">📁</div>
                <div class="album-info">
                    <h4 class="album-title">${folderName}</h4>
                    <p style="font-size:12px; color:#aaa;">${tracks.length} canciones</p>
                </div>
            `;
            item.addEventListener('click', () => {
                songsAlbumTitle.textContent = folderName;
                renderSongsScreen(tracks);
                goToScreen(screen3); // Ir a la 3ª Pantalla (Canciones)
            });
            albumsList.appendChild(item);
        });
    }

    // --- 3ª PANTALLA: MOSTRAR CANCIONES DEL ÁLBUM ---
    function renderSongsScreen(tracks) {
        songsList.innerHTML = '';
        tracks.forEach(track => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="song-checkbox"></div>
                <h4 class="song-title">${track.title}</h4>
            `;
            item.addEventListener('click', () => {
                playSong(track, tracks);
                goToScreen(screen4); // Ir a la 4ª Pantalla (Reproductor)
            });
            songsList.appendChild(item);
        });
    }

    // --- 4ª PANTALLA: REPRODUCCIÓN Y CONTROLES ---
    function playSong(track, playlist) {
        currentPlaylist = playlist;
        currentIndex = currentPlaylist.findIndex(t => t.id === track.id);

        audioElement.src = track.url;
        audioElement.play();
        isPlaying = true;

        playerTitle.textContent = track.title;
        playerArtistAlbum.textContent = track.folder;
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
        playSong(currentPlaylist[currentIndex], currentPlaylist);
    });

    btnPrev.addEventListener('click', () => {
        if (currentPlaylist.length === 0 || currentIndex === -1) return;
        currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        playSong(currentPlaylist[currentIndex], currentPlaylist);
    });

    audioElement.addEventListener('ended', () => btnNext.click());
});
