document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENTOS DE LAS 3 PANTALLAS ---
    const screen1 = document.getElementById('screen-1');
    const screen2 = document.getElementById('screen-2');
    const screen3 = document.getElementById('screen-3');

    // Footers de navegación
    const footerScreen2 = document.querySelector('#screen-2 footer') || document.getElementById('footer-screen-2');
    const footerScreen3 = document.querySelector('#screen-3 footer') || document.getElementById('footer-screen-3');

    // Elementos Pantalla 2
    const albumTitleScreen2 = document.querySelector('#screen-2 header h1') || document.getElementById('album-title');
    const songListContainer = document.querySelector('#screen-2 .song-list') || document.getElementById('song-list') || document.querySelector('#screen-2 .songs-container');

    // Elementos Pantalla 3 (Reproductor)
    const coverScreen3 = document.querySelector('#screen-3 img') || document.getElementById('cover-screen3') || document.getElementById('full-cover');
    const trackTitleScreen3 = document.querySelector('#screen-3 .track-title') || document.getElementById('track-title');
    const playBtn = document.getElementById('play-btn') || document.querySelector('#screen-3 .btn-play') || document.getElementById('full-play-btn');
    const prevBtn = document.getElementById('prev-btn') || document.querySelector('#screen-3 .btn-prev');
    const nextBtn = document.getElementById('next-btn') || document.querySelector('#screen-3 .btn-next');
    const progressBar = document.getElementById('progress-bar') || document.querySelector('#screen-3 input[type="range"]');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    const DEFAULT_COVER = 'icon.png';

    // Estado de la aplicación
    let albumsData = [
        {
            name: 'Mi Primer Álbum',
            cover: 'music/cover.jpg',
            tracks: [
                { title: 'Canción de Ejemplo 1', src: 'music/track1.mp3' },
                { title: 'Canción de Ejemplo 2', src: 'music/track2.mp3' }
            ]
        },
        {
            name: 'Álbum de Prueba 2',
            cover: 'music/album2/cover.jpg',
            tracks: [
                { title: 'Pista Principal', src: 'music/album2/track3.mp3' }
            ]
        }
    ];

    let currentAlbum = null;
    let currentTrackIndex = 0;
    let audio = new Audio();
    let isPlaying = false;

    // 1. SOLICITAR PERMISOS EN ANDROID
    async function requestStoragePermissions() {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
            try {
                await window.Capacitor.Plugins.Filesystem.requestPermissions();
            } catch (err) {
                console.log('Permisos gestionados:', err);
            }
        }
    }
    await requestStoragePermissions();

    // 2. CARGAR Y RENDERIZAR PANTALLA 1: LISTADO DE ÁLBUMES
    function renderScreen1() {
        const container = document.querySelector('#screen-1 .album-grid') || document.querySelector('#screen-1 .albums-container') || document.getElementById('album-list') || document.querySelector('#screen-1');
        if (!container) return;

        // Limpiar contenedor preservando el header y footer si están dentro
        const existingGrid = container.querySelector('.album-grid, .albums-container, #album-list') || container;
        
        let targetList = existingGrid;
        if (targetList === container && !targetList.classList.contains('album-grid') && !targetList.classList.contains('albums-container')) {
            // Si es la pantalla entera, buscamos o creamos un div interno para las cards
            targetList = container.querySelector('.content-body') || document.createElement('div');
            if (!targetList.parentNode) {
                targetList.className = 'albums-container';
                container.appendChild(targetList);
            }
        }

        targetList.innerHTML = '';

        if (albumsData.length === 0) {
            targetList.innerHTML = `<div style="text-align: center; padding: 20px; color: #ffffff;">No hay álbumes disponibles</div>`;
            return;
        }

        albumsData.forEach((album) => {
            const card = document.createElement('div');
            card.className = 'album-item';
            card.style.cursor = 'pointer';
            card.style.margin = '10px';

            card.innerHTML = `
                <img src="${album.cover}" alt="${album.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;" onerror="this.src='${DEFAULT_COVER}'">
                <div class="album-name" style="color: #ffffff; margin-top: 5px; font-weight: bold;">${album.name}</div>
            `;

            card.addEventListener('click', () => {
                currentAlbum = album;
                renderScreen2();
                showScreen(screen2);
            });

            targetList.appendChild(card);
        });
    }

    // 3. PANTALLA 2: LISTADO DE CANCIONES (A-Z)
    function renderScreen2() {
        if (!currentAlbum) return;

        if (albumTitleScreen2) albumTitleScreen2.textContent = currentAlbum.name;
        if (!songListContainer) return;
        songListContainer.innerHTML = '';

        // Ordenar de la A a la Z
        currentAlbum.tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

        currentAlbum.tracks.forEach((track, index) => {
            const songRow = document.createElement('div');
            songRow.className = 'song-item';
            songRow.style.cursor = 'pointer';
            songRow.style.padding = '10px';
            songRow.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

            songRow.innerHTML = `
                <span class="song-number" style="margin-right: 10px; color: #94a3b8;">${index + 1}</span>
                <span class="song-title" style="color: #ffffff;">${track.title}</span>
            `;

            songRow.addEventListener('click', () => {
                loadTrack(index);
                playAudio();
                showScreen(screen3);
            });

            songListContainer.appendChild(songRow);
        });
    }

    // 4. NAVEGACIÓN Y FOOTERS
    function showScreen(targetScreen) {
        screen1.classList.remove('active');
        if (screen2) screen2.classList.remove('active');
        screen3.classList.remove('active');

        targetScreen.classList.add('active');
    }

    if (footerScreen2) {
        footerScreen2.addEventListener('click', () => {
            showScreen(screen1);
        });
    }

    if (footerScreen3) {
        footerScreen3.addEventListener('click', () => {
            if (currentAlbum) {
                showScreen(screen2);
            } else {
                showScreen(screen1);
            }
        });
    }

    // 5. PANTALLA 3: REPRODUCTOR
    function loadTrack(index) {
        if (!currentAlbum || currentAlbum.tracks.length === 0) return;
        currentTrackIndex = index;
        const track = currentAlbum.tracks[currentTrackIndex];

        audio.src = track.src;

        if (trackTitleScreen3) trackTitleScreen3.textContent = track.title;
        if (coverScreen3) {
            coverScreen3.src = currentAlbum.cover || DEFAULT_COVER;
            coverScreen3.onerror = () => { coverScreen3.src = DEFAULT_COVER; };
        }

        updatePlayButtonIcon(false);
    }

    function updatePlayButtonIcon(playing) {
        isPlaying = playing;
        const playIconSVG = `<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        const pauseIconSVG = `<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

        if (playBtn) {
            playBtn.innerHTML = isPlaying ? pauseIconSVG : playIconSVG;
        }
    }

    function playAudio() {
        if (!audio.src) return;
        audio.play().then(() => {
            updatePlayButtonIcon(true);
        }).catch(err => console.log('Reproducción pausada o bloqueada:', err));
    }

    function togglePlay() {
        if (!audio.src) return;
        if (isPlaying) {
            audio.pause();
            updatePlayButtonIcon(false);
        } else {
            playAudio();
        }
    }

    if (playBtn) playBtn.addEventListener('click', togglePlay);

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (!currentAlbum) return;
            let nextIndex = currentTrackIndex - 1;
            if (nextIndex < 0) nextIndex = currentAlbum.tracks.length - 1;
            loadTrack(nextIndex);
            playAudio();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (!currentAlbum) return;
            let nextIndex = (currentTrackIndex + 1) % currentAlbum.tracks.length;
            loadTrack(nextIndex);
            playAudio();
        });
    }

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            if (progressBar) progressBar.value = progress;
            if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
            if (totalTimeEl) totalTimeEl.textContent = formatTime(audio.duration);
        }
    });

    if (progressBar) {
        progressBar.addEventListener('input', () => {
            if (audio.duration) {
                audio.currentTime = (progressBar.value / 100) * audio.duration;
            }
        });
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Inicializar visualización de la Pantalla 1
    renderScreen1();
});
