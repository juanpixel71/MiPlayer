document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const btnSelectFolder = document.getElementById('btn-select-folder');
    const btnChangeFolder = document.getElementById('btn-change-folder');
    const fileInput = document.getElementById('file-input');
    
    const screenWelcome = document.getElementById('screen-welcome');
    const screenMain = document.getElementById('screen-main');
    
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const albumsGrid = document.getElementById('albums-grid');
    const artistsList = document.getElementById('artists-list');
    const songsList = document.getElementById('songs-list');
    
    const viewDetail = document.getElementById('view-detail');
    const detailTitle = document.getElementById('detail-title');
    const detailSongsList = document.getElementById('detail-songs-list');
    const btnBack = document.getElementById('btn-back');

    // Reproductor
    const miniPlayer = document.getElementById('mini-player');
    const audioElement = document.getElementById('audio-element');
    const playerTitle = document.getElementById('player-title');
    const playerArtist = document.getElementById('player-artist');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    // Estado global
    let tracks = [];
    let albumsMap = {};
    let artistsMap = {};
    let currentPlaylist = [];
    let currentIndex = -1;
    let isPlaying = false;

    // --- EVENTOS DE INICIO Y CARPETA ---
    btnSelectFolder.addEventListener('click', () => fileInput.click());
    btnChangeFolder.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const audioFiles = files.filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i));

        if (audioFiles.length === 0) {
            alert('No se encontraron archivos de audio en la carpeta seleccionada.');
            return;
        }

        processAudioFiles(audioFiles);
        screenWelcome.classList.remove('active');
        screenMain.classList.add('active');
    });

    // --- PROCESAMIENTO DE ARCHIVOS ---
    function processAudioFiles(files) {
        tracks = [];
        albumsMap = {};
        artistsMap = {};

        files.forEach((file, index) => {
            // Extraer la estructura de carpetas (Ejemplo: "NombreArtista/NombreAlbum/Cancion.mp3")
            const pathParts = (file.webkitRelativePath || file.name).split('/');
            
            let albumName = 'Varios / Desconocido';
            let artistName = 'Artista Desconocido';

            if (pathParts.length >= 3) {
                artistName = pathParts[pathParts.length - 3];
                albumName = pathParts[pathParts.length - 2];
            } else if (pathParts.length === 2) {
                albumName = pathParts[0];
            }

            // Limpiar el título de la canción quitando extensión
            const songTitle = file.name.replace(/\.[^/.]+$/, "");

            const track = {
                id: index,
                file: file,
                title: songTitle,
                album: albumName,
                artist: artistName,
                url: URL.createObjectURL(file)
            };

            tracks.push(track);

            // Agrupar por Álbum
            if (!albumsMap[albumName]) albumsMap[albumName] = [];
            albumsMap[albumName].push(track);

            // Agrupar por Artista
            if (!artistsMap[artistName]) artistsMap[artistName] = [];
            artistsMap[artistName].push(track);
        });

        renderAlbums();
        renderArtists();
        renderSongs();
    }

    // --- RENDERIZADO DE INTERFAZ ---
    function renderAlbums() {
        albumsGrid.innerHTML = '';
        Object.keys(albumsMap).forEach(albumName => {
            const albumTracks = albumsMap[albumName];
            const card = document.createElement('div');
            card.className = 'album-card';
            card.innerHTML = `
                <div class="album-cover">🎵</div>
                <div class="album-info">
                    <h4>${albumName}</h4>
                    <p>${albumTracks[0].artist}</p>
                    <span class="count">${albumTracks.length} canciones</span>
                </div>
            `;
            card.addEventListener('click', () => showDetailView(albumName, albumTracks));
            albumsGrid.appendChild(card);
        });
    }

    function renderArtists() {
        artistsList.innerHTML = '';
        Object.keys(artistsMap).forEach(artistName => {
            const artistTracks = artistsMap[artistName];
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="item-icon">👤</div>
                <div class="item-info">
                    <h4>${artistName}</h4>
                    <p>${artistTracks.length} canciones</p>
                </div>
            `;
            item.addEventListener('click', () => showDetailView(artistName, artistTracks));
            artistsList.appendChild(item);
        });
    }

    function renderSongs() {
        songsList.innerHTML = '';
        tracks.forEach(track => {
            const item = createSongListItem(track, tracks);
            songsList.appendChild(item);
        });
    }

    function createSongListItem(track, playlistContext) {
        const item = document.createElement('div');
        item.className = 'list-item song-item';
        item.innerHTML = `
            <div class="item-icon">▶</div>
            <div class="item-info">
                <h4>${track.title}</h4>
                <p>${track.artist} - ${track.album}</p>
            </div>
        `;
        item.addEventListener('click', () => {
            playTrack(track, playlistContext);
        });
        return item;
    }

    // --- VISTA DETALLE ---
    function showDetailView(title, trackList) {
        detailTitle.textContent = title;
        detailSongsList.innerHTML = '';
        trackList.forEach(track => {
            const item = createSongListItem(track, trackList);
            detailSongsList.appendChild(item);
        });

        // Ocultar pestañas y mostrar vista detalle
        tabContents.forEach(c => c.classList.remove('active'));
        viewDetail.classList.remove('hidden');
    }

    btnBack.addEventListener('click', () => {
        viewDetail.classList.add('hidden');
        // Volver a la pestaña activa
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        document.getElementById(`tab-${activeTab}`).classList.add('active');
    });

    // --- NAVEGACIÓN POR PESTAÑAS ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            viewDetail.classList.add('hidden');

            tab.classList.add('active');
            const tabId = `tab-${tab.dataset.tab}`;
            document.getElementById(tabId).classList.add('active');
        });
    });

    // --- REPRODUCTOR DE AUDIO ---
    function playTrack(track, playlist) {
        currentPlaylist = playlist;
        currentIndex = currentPlaylist.findIndex(t => t.id === track.id);

        audioElement.src = track.url;
        audioElement.play();
        isPlaying = true;

        playerTitle.textContent = track.title;
        playerArtist.textContent = track.artist;
        btnPlayPause.textContent = '⏸';

        miniPlayer.classList.remove('hidden');
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
