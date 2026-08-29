document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const fileInput = document.getElementById('file-input');
    const btnSelectFolder = document.getElementById('btn-select-folder');
    const btnChangeFolderAlbums = document.getElementById('btn-change-folder-albums');

    // Pantallas
    const screens = {
        welcome: document.getElementById('screen-welcome'),
        albums: document.getElementById('screen-albums'),
        songs: document.getElementById('screen-songs'),
        player: document.getElementById('screen-player')
    };

    // Listas y Contenido
    const albumsList = document.getElementById('albums-list');
    const songsList = document.getElementById('songs-list');
    const songsAlbumTitle = document.getElementById('songs-album-title');

    // Reproductor
    const playerTitle = document.getElementById('player-title');
    const playerArtistAlbum = document.getElementById('player-artist-album');
    const audioElement = document.getElementById('audio-element');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    // Botones ATRÁS
    const btnBackToWelcome = document.getElementById('btn-back-to-welcome');
    const btnBackToAlbums = document.getElementById('btn-back-to-albums');
    const btnBackToSongs = document.getElementById('btn-back-to-songs');

    // --- ESTADO GLOBAL ---
    let albumsMap = {};
    let currentPlaylist = [];
    let currentIndex = -1;
    let isPlaying = false;

    // --- NAVEGACIÓN ---
    function showScreen(screenId) {
        // Ocultar todas las pantallas
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        // Mostrar la solicitada
        if (screens[screenId]) {
            screens[screenId].classList.add('active');
        } else {
            console.error('Error: Pantalla no encontrada:', screenId);
        }
    }

    // --- BOTONES ATRÁS ESPECÍFICOS DEL PAPEL ---
    btnBackToWelcome.addEventListener('click', () => {
        albumsList.innerHTML = '';
        showScreen('welcome');
    });

    btnBackToAlbums.addEventListener('click', () => {
        renderAlbums();
        showScreen('albums');
    });

    btnBackToSongs.addEventListener('click', () => {
        // Al volver, mostramos la lista de canciones actual
        songsList.innerHTML = '';
        renderSongs(currentPlaylist[0].album, currentPlaylist);
        showScreen('songs');
    });

    // --- SELECCIÓN DE CARPETA Y PROCESAMIENTO ---
    btnSelectFolder.addEventListener('click', () => fileInput.click());
    btnChangeFolderAlbums.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const audioFiles = files.filter(f => f.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i));

        if (audioFiles.length === 0) {
            alert('No se encontraron archivos de audio.');
            return;
        }

        processAudioFiles(audioFiles);
        showScreen('albums');
    });

    function processAudioFiles(files) {
        albumsMap = {};
        files.forEach((file, index) => {
            const pathParts = (file.webkitRelativePath || file.name).split('/');
            
            let albumName = 'Carpeta Única';
            let artistName = 'Artista Desconocido';

            if (pathParts.length >= 3) {
                artistName = pathParts[pathParts.length - 3];
                albumName = pathParts[pathParts.length - 2];
            } else if (pathParts.length === 2) {
                albumName = pathParts[0];
            }

            const track = {
                id: index,
                title: file.name.replace(/\.[^/.]+$/, ""),
                album: albumName,
                artist: artistName,
                url: URL.createObjectURL(file)
            };

            if (!albumsMap[albumName]) albumsMap[albumName] = [];
            albumsMap[albumName].push(track);
        });
        renderAlbums();
    }

    // --- PANTALLA 2º: RENDER ÁLBUMES ---
    function renderAlbums() {
        albumsList.innerHTML = '';
        Object.keys(albumsMap).forEach(albumName => {
            const albumTracks = albumsMap[albumName];
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="album-icon">🎵</div>
                <div class="album-info">
                    <h4 class="album-title">${albumName}</h4>
                    <p>${albumTracks.length} canciones</p>
                </div>
            `;
            item.addEventListener('click', () => {
                songsAlbumTitle.textContent = albumName;
                renderSongs(albumName, albumTracks);
                showScreen('songs');
            });
            albumsList.appendChild(item);
        });
    }

    // --- PANTALLA 3º: RENDER CANCIONES (DENTRO DE ÁLBUM) ---
    function renderSongs(albumName, tracksInAlbum) {
        songsList.innerHTML = '';
        tracksInAlbum.forEach(track => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="song-checkbox"></div>
                <h4 class="song-title">${track.title}</h4>
            `;
            item.addEventListener('click', () => {
                playTrack(track, tracksInAlbum);
                showScreen('player');
            });
            songsList.appendChild(item);
        });
    }

    // --- PANTALLA 4º: PANTALLA CANCIONES (REPRODUCTOR COMPLETO) ---
    function playTrack(track, playlist) {
        currentPlaylist = playlist;
        currentIndex = currentPlaylist.findIndex(t => t.id === track.id);

        audioElement.src = track.url;
        audioElement.play();
        isPlaying = true;

        playerTitle.textContent = track.title;
        playerArtistAlbum.textContent = `${track.artist} / ${track.album}`;
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

    audioElement.addEventListener('ended', () => {
        btnNext.click();
    });
});
