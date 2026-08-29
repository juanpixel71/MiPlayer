// Elementos DOM
const folderInput = document.getElementById('folder-input');
const listContainer = document.getElementById('list-container');
const placeholder = document.getElementById('placeholder');
const btnBack = document.getElementById('btn-back');
const headerTitle = document.getElementById('header-title');

const audio = document.getElementById('audio-element');
const btnPlay = document.getElementById('btn-play');
const btnStop = document.getElementById('btn-stop');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

const trackTitle = document.getElementById('track-title');
const trackAlbum = document.getElementById('track-album');
const progressBar = document.getElementById('progress-bar');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');

// Estado de la aplicación
let albums = {}; // Estructura: { 'NombreAlbum': [ {file, name, album}, ... ] }
let currentAlbumName = null;
let currentPlaylist = [];
let currentIndex = -1;
let wakeLock = null;

// Cargar carpeta con archivos
folderInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  albums = {};

  files.forEach(file => {
    if (file.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
      // Extraer nombre del álbum desde la ruta relativa
      const pathParts = file.webkitRelativePath.split('/');
      let albumName = 'Varios';
      
      if (pathParts.length > 2) {
        albumName = pathParts[pathParts.length - 2];
      } else if (pathParts.length === 2) {
        albumName = pathParts[0];
      }

      if (!albums[albumName]) albums[albumName] = [];
      albums[albumName].push({
        file: file,
        name: file.name.replace(/\.[^/.]+$/, ""), // Quitar extensión
        album: albumName
      });
    }
  });

  if (Object.keys(albums).length > 0) {
    placeholder.classList.add('hidden');
    showAlbumsView();
  } else {
    alert("No se encontraron archivos de audio en la carpeta seleccionada.");
  }
});

// Mostrar vista de Álbumes
function showAlbumsView() {
  currentAlbumName = null;
  headerTitle.textContent = "Álbumes";
  btnBack.classList.add('hidden');
  listContainer.innerHTML = '';

  Object.keys(albums).forEach(albumName => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-icon">📁</div>
      <div class="item-details">
        <div class="item-name">${albumName}</div>
        <div class="item-subtext">${albums[albumName].length} canciones</div>
      </div>
    `;
    card.onclick = () => showSongsView(albumName);
    listContainer.appendChild(card);
  });
}

// Mostrar vista de Canciones de un Álbum
function showSongsView(albumName) {
  currentAlbumName = albumName;
  headerTitle.textContent = albumName;
  btnBack.classList.remove('hidden');
  listContainer.innerHTML = '';

  albums[albumName].forEach((song, index) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-icon">🎵</div>
      <div class="item-details">
        <div class="item-name">${song.name}</div>
        <div class="item-subtext">${albumName}</div>
      </div>
    `;
    card.onclick = () => {
      currentPlaylist = albums[albumName];
      playSong(index);
    };
    listContainer.appendChild(card);
  });
}

// Botón Volver a Álbumes
btnBack.onclick = () => showAlbumsView();

// Reproducir Canción
function playSong(index) {
  if (index < 0 || index >= currentPlaylist.length) return;
  currentIndex = index;
  const song = currentPlaylist[currentIndex];

  audio.src = URL.createObjectURL(song.file);
  audio.play().catch(err => console.log(err));
  
  trackTitle.textContent = song.name;
  trackAlbum.textContent = song.album;
  btnPlay.textContent = '⏸';

  requestWakeLock(); // Activar pantalla siempre encendida
}

// Controles de Reproducción
btnPlay.onclick = () => {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
    btnPlay.textContent = '⏸';
    requestWakeLock();
  } else {
    audio.pause();
    btnPlay.textContent = '▶';
    releaseWakeLock();
  }
};

btnStop.onclick = () => {
  audio.pause();
  audio.currentTime = 0;
  btnPlay.textContent = '▶';
  releaseWakeLock();
};

btnNext.onclick = () => playSong(currentIndex + 1);
btnPrev.onclick = () => playSong(currentIndex - 1);
audio.onended = () => playSong(currentIndex + 1);

// Actualización de Barra de Progreso y Tiempo
audio.ontimeupdate = () => {
  if (audio.duration) {
    const pct = (audio.currentTime / audio.duration) * 100;
    progressBar.value = pct;
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

// Mantener pantalla encendida mientras suena música
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    console.log('Wake Lock no disponible:', err);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().then(() => { wakeLock = null; });
  }
}
