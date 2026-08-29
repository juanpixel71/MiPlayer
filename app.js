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
    const AUDIO_EXTENSIONS = /\.(mp3|m4a|flac|wav|ogg|opus|aac|wma)$/i;

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
            await readAbsolutePathWithDebug();
        } else {
            renderDemoData();
        }
    }

    // Extraer el nombre probando todas las estructuras posibles de Capacitor
    function parseItemName(item) {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (item.name) return item.name;
        if (item.uri) {
            const parts = item.uri.split('/');
            return parts[parts.length - 1] || parts[parts.length - 2];
        }
        if (item.path) {
            const parts = item.path.split('/');
            return parts[parts.length - 1] || parts[parts.length - 2];
        }
        return JSON.stringify(item);
    }

    async function readAbsolutePathWithDebug() {
        const debugLog = [];
        const log = (msg) => debugLog.push(msg);

        try {
            const { Filesystem } = window.Capacitor.Plugins;

            try {
                await Filesystem.requestPermissions();
            } catch (e) {
                log('Warn permisos: ' + e.message);
            }

            albumsMap = {};
            let globalIdx = 0;

            log(`1. Leyendo carpeta: ${TARGET_PATH}`);
            const rootDir = await Filesystem.readdir({ path: TARGET_PATH }).catch(err => {
                log(`Error readdir raíz: ${err.message}`);
                return null;
            });

            if (!rootDir || !rootDir.files) {
                log('Error: rootDir o rootDir.files es null/undefined');
                showDebugScreen(albumsList, debugLog);
                return;
            }

            log(`2. Elementos en MiMusica: ${rootDir.files.length}`);

            for (let i = 0; i < rootDir.files.length; i++) {
                const rawItem = rootDir.files[i];
                const folderName = parseItemName(rawItem);
                
                log(`- Item [${i}]: type=${typeof rawItem}, parsedName="${folderName}"`);
                log(`  Raw: ${JSON.stringify(rawItem)}`);

                if (!folderName) continue;

                // Construcción de la ruta a la subcarpeta
                const subFolderPath = `${TARGET_PATH}/${folderName}`;
                
                try {
                    const subDir = await Filesystem.readdir({ path: subFolderPath });
                    log(`  -> Leída subcarpeta. Archivos en su interior: ${subDir && subDir.files ? subDir.files.length : 0}`);

                    if (subDir && subDir.files) {
                        subDir.files.forEach(fileInfo => {
                            const fileName = parseItemName(fileInfo);
                            log(`     * Archivo detectado: "${fileName}"`);
                            if (fileName && fileName.match(AUDIO_EXTENSIONS)) {
                                const filePath = `${subFolderPath}/${fileName}`;
                                const track = {
                                    id: globalIdx++,
                                    title: fileName.replace(/\.[^/.]+$/, ""),
                                    folder: folderName,
                                    url: window.Capacitor.convertFileSrc(filePath)
                                };

                                if (!albumsMap[folderName]) albumsMap[folderName] = [];
                                albumsMap[folderName].push(track);
                            }
                        });
                    }
                } catch (subErr) {
                    log(`  -> Error leyendo subcarpeta (${subFolderPath}): ${subErr.message}`);
                }
            }

            const foundAlbums = Object.keys(albumsMap);
            log(`3. Total Álbumes válidos procesados: ${foundAlbums.length}`);

            if (foundAlbums.length === 0) {
                showDebugScreen(albumsList, debugLog);
            } else {
                renderAlbums();
            }

        } catch (err) {
            log(`CRITICAL ERR: ${err.message}`);
            showDebugScreen(albumsList, debugLog);
        }
    }

    // Mostrar el informe de diagnóstico directamente en la pantalla del móvil
    function showDebugScreen(container, logs) {
        container.innerHTML = `
            <div style="padding: 15px; background: #121212; color: #00ff66; font-family: monospace; font-size: 11px; text-align: left; word-break: break-all; line-height: 1.4;">
                <h3 style="color: #ffffff; margin-top: 0; font-size: 14px;">🔍 INFORME DE DIAGNÓSTICO</h3>
                <hr style="border-color: #333;">
                ${logs.map(l => `<p style="margin: 4px 0;">${l}</p>`).join('')}
            </div>
        `;
    }

    function renderDemoData() {
        albumsMap = {
            "Álbum Ejemplo": [
                { id: 1, title: "01 - Canción 1", folder: "Álbum Ejemplo", url: "" }
            ]
        };
        renderAlbums();
    }

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
