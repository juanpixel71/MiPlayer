const btnOpen = document.getElementById('btn-open');
const fileTree = document.getElementById('file-tree');
const audio = document.getElementById('audio-element');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const trackTitle = document.getElementById('track-title');
const trackAlbum = document.getElementById('track-album');

let playlist = [];
let currentIndex = -1;

btnOpen.addEventListener('click', async () => {
  try {
    const dirHandle = await window.showDirectoryPicker();
    playlist = [];
    fileTree.innerHTML = '';
    await readDirectory(dirHandle);
    renderPlaylist();
  } catch (err) {
    console.log('Error o cancelación al abrir directorio:', err);
  }
});

async function readDirectory(dirHandle, path = '') {
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      const file = await entry.getFile();
      playlist.push({
        file,
        name: entry.name,
        album: path || 'Raíz'
      });
    } else if (entry.kind === 'directory') {
      await readDirectory(entry, entry.name);
    }
  }
}

function renderPlaylist() {
  if (playlist.length === 0) {
    fileTree.innerHTML = '<p class="placeholder">No se encontraron archivos de audio.</p>';
    return;
  }

  const grouped = {};
  playlist.forEach((item, index) => {
    if (!grouped[item.album]) grouped[item.album] = [];
    grouped[item.album].push({ ...item, index });
  });

  fileTree.innerHTML = '';
  for (const [album, songs] of Object.entries(grouped)) {
    const container = document.createElement('div');
    container.className = 'album-group';
    container.innerHTML = `<div class="album-title">📁 ${album}</div>`;

    songs.forEach(song => {
      const el = document.createElement('div');
      el.className = 'song-item';
      el.textContent = song.name;
      el.onclick = () => playSong(song.index);
      container.appendChild(el);
    });

    fileTree.appendChild(container);
  }
}

function playSong(index) {
  if (index < 0 || index >= playlist.length) return;
  currentIndex = index;
  const item = playlist[currentIndex];
  audio.src = URL.createObjectURL(item.file);
  audio.play();
  trackTitle.textContent = item.name;
  trackAlbum.textContent = item.album;
  btnPlay.textContent = '⏸';
}

btnPlay.onclick = () => {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
    btnPlay.textContent = '⏸';
  } else {
    audio.pause();
    btnPlay.textContent = '▶';
  }
};

btnNext.onclick = () => playSong(currentIndex + 1);
btnPrev.onclick = () => playSong(currentIndex - 1);
audio.onended = () => playSong(currentIndex + 1);