// Pantallas
const screen1 = document.getElementById('screen-1');
const screen2 = document.getElementById('screen-2');
const screen3 = document.getElementById('screen-3');
const screen4 = document.getElementById('screen-4');

// Elementos
const folderInput = document.getElementById('folder-input');
const albumsList = document.getElementById('albums-list');
const songsList = document.getElementById('songs-list');
const screen3Title = document.getElementById('screen-3-title');

const audio = document.getElementById('audio-element');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const progressBar = document.getElementById('progress-bar');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const btnPlay = document.getElementById('btn-play');

// Botones Atrás
document.getElementById('btn-back-mimus').onclick = () => showScreen(screen1);
document.getElementById('btn-back-albums').onclick = () => showScreen(screen2);
document.getElementById('btn-back-songs').onclick = () => showScreen(screen3);

// Datos
let albumsData = {};
let currentPlaylist = [];
let currentIndex = -1;

function showScreen(screenToShow) {
  [screen1, screen2, screen3, screen4].forEach(s => s.classList.add('hidden'));
  screenToShow.classList.remove('hidden');
}

// Cargar música desde carpeta
folderInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  albumsData = {};

  files.forEach(file => {
    if (file.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
      const parts = file.webkitRelativePath.split('/');
      let album = parts.length > 2 ? parts[parts.length - 2] : (parts[0] || 'Varios');
      
      if (!albumsData[album]) albumsData[album] = [];
      albumsData[album].push({
        file: file,
        name: file.name.replace(/\.[^/.]+$/, "")
      });
    }
  });

  if (Object.keys(albumsData).length > 0) {
    renderAlbums();
    showScreen(screen2);
  }
});

// Renderizar 2ª Pantalla (Álbumes)
function renderAlbums() {
  albumsList.innerHTML = '';
  Object.keys(albumsData).forEach(albumName => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="item-thumb">📁</div>
      <div class="item-text">
        <div class="item-title">${albumName}</div>
        <div class="item-sub">${albumsData[albumName].length} canciones</div>
      </div>
    `;
    row.onclick = () => renderSongs(albumName);
    albumsList.appendChild(row);
  });
}

// Renderizar 3ª Pantalla (Canciones)
function renderSongs(albumName) {
  screen3Title.textContent = albumName;
  songsList.innerHTML = '';
  currentPlaylist = albumsData[albumName];

  currentPlaylist.forEach((song, idx) => {
    const num = (idx + 1).toString().padStart(2, '0');
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div class="item-thumb">${num}</div>
      <div class="item-text">
        <div class="item-title">${song.name}</div>
        <div class="item-sub">${albumName}</div>
      </div>
    `;
    row.onclick = () => playTrack(idx, albumName);
    songsList.appendChild(row);
  });

  showScreen(screen3);
}

// 4ª Pantalla (Reproductor)
function playTrack(idx, albumName) {
  currentIndex = idx;
  const song = currentPlaylist[currentIndex];
  const num = (currentIndex + 1).toString().padStart(2, '0');

  audio.src = URL.createObjectURL(song.file);
  audio.play();

  playerTitle.textContent = `${num} - ${song.name}`;
  playerArtist.textContent = albumName;
  btnPlay.textContent = '⏸';

  showScreen(screen4);
}

// Controles Reproductor
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

document.getElementById('btn-next').onclick = () => {
  if (currentIndex + 1 < currentPlaylist.length) {
    playTrack(currentIndex + 1, playerArtist.textContent);
  }
};

document.getElementById('btn-prev').onclick = () => {
  if (currentIndex - 1 >= 0) {
    playTrack(currentIndex - 1, playerArtist.textContent);
  }
};

audio.onended = () => {
  if (currentIndex + 1 < currentPlaylist.length) {
    playTrack(currentIndex + 1, playerArtist.textContent);
  }
};

audio.ontimeupdate = () => {
  if (audio.duration) {
    progressBar.value = (audio.currentTime / audio.duration) * 100;
    timeCurrent.textContent = formatTime(audio.currentTime);
    timeTotal.textContent = formatTime(audio.duration);
  }
};

progressBar.oninput = () => {
  if (audio.duration) {
    audio.currentTime = (progressBar.value / 100) * audio.duration;
  }
};

function formatTime(sec) {
  if (isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
