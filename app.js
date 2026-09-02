document.addEventListener('DOMContentLoaded', async () => {
    // Solicitar permisos en Capacitor si están disponibles
    async function requestAppPermissions() {
        if (window.Capacitor && window.Capacitor.Plugins) {
            const { Filesystem, Permissions } = window.Capacitor.Plugins;
            try {
                if (Filesystem && Filesystem.requestPermissions) {
                    await Filesystem.requestPermissions();
                }
            } catch (err) {
                console.log('Solicitud de permisos de almacenamiento finalizada:', err);
            }
        }
    }

    await requestAppPermissions();

    // Referencias a elementos
    const screen1 = document.getElementById('screen-1');
    const screen3 = document.getElementById('screen-3');

    const miniPlayerBar = document.getElementById('mini-player');
    const miniCover = document.getElementById('mini-cover');
    const miniTitle = document.getElementById('mini-title');
    const miniArtist = document.getElementById('mini-artist');
    const miniPlayBtn = document.getElementById('mini-play-btn');

    const fullCover = document.getElementById('full-cover');
    const fullTitle = document.getElementById('full-title');
    const fullArtist = document.getElementById('full-artist');
    const fullPlayBtn = document.getElementById('full-play-btn');

    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-btn');

    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    const DEFAULT_COVER = 'icon.png';

    // Estado del reproductor
    let audio = new Audio();
    let isPlaying = false;
    let currentTrackIndex = 0;

    // Lista de canciones / álbumes
    let playlist = [
        {
            title: 'Canción Ejemplo 1',
            artist: 'Artista Local',
            src: 'music/track1.mp3',
            cover: 'music/cover.jpg'
        },
        {
            title: 'Canción Ejemplo 2',
            artist: 'Artista Local',
            src: 'music/album2/track2.mp3',
            cover: 'music/album2/cover.jpg'
        }
    ];

    // Asignación de carátula con respaldo a icon.png
    function setCoverImage(element, srcPath) {
        if (!element) return;
        const img = new Image();
        img.src = srcPath;
        img.onload = () => {
            element.src = srcPath;
        };
        img.onerror = () => {
            element.src = DEFAULT_COVER;
        };
    }

    function loadTrack(index) {
        if (playlist.length === 0) return;
        currentTrackIndex = index;
        const track = playlist[currentTrackIndex];

        audio.src = track.src;

        if (miniTitle) miniTitle.textContent = track.title || 'Sin Título';
        if (miniArtist) miniArtist.textContent = track.artist || 'Artista Desconocido';
        if (fullTitle) fullTitle.textContent = track.title || 'Sin Título';
        if (fullArtist) fullArtist.textContent = track.artist || 'Artista Desconocido';

        const coverPath = track.cover || DEFAULT_COVER;
        setCoverImage(miniCover, coverPath);
        setCoverImage(fullCover, coverPath);

        updatePlayIcons(false);
    }

    function updatePlayIcons(playing) {
        isPlaying = playing;
        const playIconSVG = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        const pauseIconSVG = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

        const currentIcon = isPlaying ? pauseIconSVG : playIconSVG;

        if (miniPlayBtn) miniPlayBtn.innerHTML = currentIcon;
        if (fullPlayBtn) fullPlayBtn.innerHTML = currentIcon;
    }

    function togglePlay() {
        if (!audio.src) return;
        if (isPlaying) {
            audio.pause();
            updatePlayIcons(false);
        } else {
            audio.play().then(() => {
                updatePlayIcons(true);
            }).catch(err => {
                console.log('Error de reproducción:', err);
            });
        }
    }

    // Navegación entre pantallas
    if (miniPlayerBar) {
        miniPlayerBar.addEventListener('click', (e) => {
            if (e.target.closest('#mini-play-btn')) return;
            screen1.classList.remove('active');
            screen3.classList.add('active');
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            screen3.classList.remove('active');
            screen1.classList.add('active');
        });
    }

    // Controles
    if (miniPlayBtn) miniPlayBtn.addEventListener('click', togglePlay);
    if (fullPlayBtn) fullPlayBtn.addEventListener('click', togglePlay);

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            let nextIndex = currentTrackIndex - 1;
            if (nextIndex < 0) nextIndex = playlist.length - 1;
            loadTrack(nextIndex);
            togglePlay();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            let nextIndex = (currentTrackIndex + 1) % playlist.length;
            loadTrack(nextIndex);
            togglePlay();
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

    loadTrack(0);
});
