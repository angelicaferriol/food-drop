/* JONIGIRI Food Drop Game Logic */

// --- Game State Constants ---
const CONTROLS = {
  DRAG: 'drag',
  TELEPORT: 'teleport',
  KEYBOARD: 'keyboard'
};

const SPRITE_STATES = {
  IDLE: 'idle',
  LOOKING_UP: 'looking-up',
  CATCH_OPEN: 'catch-open-wide',
  MUNCH_OPEN: 'munch-open',
  MUNCH_CLOSED: 'munch-closed',
  HAPPY: 'happy',
  ATE_BAD: 'ate-bad',
  CRY: 'cry'
};

// --- Asset Configurations ---
const FOOD_ASSETS = [
  'assets/foods/foods.png',
  ...Array.from({ length: 20 }, (_, i) => `assets/foods/foods (${i + 1}).png`)
];

const THING_ASSETS = [
  'assets/things/book.png',
  'assets/things/bulb.png',
  'assets/things/camera.png',
  'assets/things/console.png',
  'assets/things/game.png',
  'assets/things/hammer.png',
  'assets/things/pencils.png',
  'assets/things/plant.png',
  'assets/things/tumbler.png',
  'assets/things/umbrella.png'
];

const STRIPE_ASSETS = {
  'idle': 'assets/stripes/idle.png',
  'looking-up': 'assets/stripes/looking-up.png',
  'catch-open-wide': 'assets/stripes/catch-open-wide.png',
  'munch-open': 'assets/stripes/munch-open.png',
  'munch-closed': 'assets/stripes/munch-closed.png',
  'happy': 'assets/stripes/happy.png',
  'ate-bad': 'assets/ate-bad.png',
  'cry': 'assets/cry.png'
};

// --- Sound effects using Web Audio API ---
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playEat() {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playHitBad() {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playMiss() {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playBtnClick() {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.setValueAtTime(900, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }
}

const soundManager = new SoundManager();

// --- Game Engine Variables ---
let canvas, ctx;
let gameActive = false;
let isPaused = false;
let currentScore = 0;
const maxLives = 8;
let currentLives = 8;
let lastTime = 0;

// Spawning and speeds
const fallSpeedBase = 2.8;
let speedMultiplier = 1;
let spawnInterval = 1200; // ms
let lastSpawnTime = 0;

// Collections
let fallingItems = [];
const foodsPool = [];
const thingsPool = [];
const spritesMap = {};

// Player object
const player = {
  x: 0,
  y: 0,
  width: 110,
  height: 110,
  targetX: 0,
  speed: 12,
  state: SPRITE_STATES.IDLE,
  stateTimer: 0,
  inputKeys: { left: false, right: false }
};

// --- DOM Elements ---
const screens = {
  welcome: document.getElementById('screen-welcome'),
  game: document.getElementById('screen-game'),
  gameover: document.getElementById('screen-gameover'),
  leaderboard: document.getElementById('screen-leaderboard')
};

const overlays = {
  pause: document.getElementById('overlay-pause'),
  settings: document.getElementById('overlay-settings')
};

// UI Components
const scoreVal = document.getElementById('score-val');
const missGaugeFill = document.getElementById('stamina-fill');
const gameoverChar = document.getElementById('gameover-char');
const playerNameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');

// Settings States
let currentControlType = CONTROLS.DRAG;

// --- Asset Preloader ---
function preloadAssets(onComplete) {
  let loadedCount = 0;
  const totalAssets = FOOD_ASSETS.length + THING_ASSETS.length + Object.keys(STRIPE_ASSETS).length;

  function itemLoaded() {
    loadedCount++;
    if (loadedCount === totalAssets) {
      onComplete();
    }
  }

  // Load Foods
  FOOD_ASSETS.forEach(src => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      foodsPool.push(img);
      itemLoaded();
    };
    img.onerror = itemLoaded;
  });

  // Load Things
  THING_ASSETS.forEach(src => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      thingsPool.push(img);
      itemLoaded();
    };
    img.onerror = itemLoaded;
  });

  // Load Sprites/Stripes
  Object.entries(STRIPE_ASSETS).forEach(([key, src]) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      spritesMap[key] = img;
      itemLoaded();
    };
    img.onerror = itemLoaded;
  });
}

// --- Screen Switching ---
let welcomeAnimInterval = null;
let gameLoopId = null;

function startWelcomeAnimation() {
  const welcomeChar = document.getElementById('welcome-char');
  if (!welcomeChar) return;

  const welcomeSprites = [
    'assets/stripes/idle.png',
    'assets/stripes/looking-up.png',
    'assets/stripes/munch-open.png',
    'assets/stripes/munch-closed.png',
    'assets/stripes/munch-open.png',
    'assets/stripes/munch-closed.png',
    'assets/stripes/happy.png'
  ];
  let index = 0;

  welcomeChar.src = welcomeSprites[0];

  if (welcomeAnimInterval) clearInterval(welcomeAnimInterval);
  welcomeAnimInterval = setInterval(() => {
    index = (index + 1) % welcomeSprites.length;
    welcomeChar.src = welcomeSprites[index];
  }, 800);
}

function showScreen(screenKey) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenKey].classList.add('active');

  if (welcomeAnimInterval) {
    clearInterval(welcomeAnimInterval);
    welcomeAnimInterval = null;
  }

  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }

  // Update device frame aspect ratio dynamically based on active screen background size
  const deviceFrame = document.querySelector('.device-frame');
  if (deviceFrame) {
    if (screenKey === 'gameover' || screenKey === 'leaderboard') {
      deviceFrame.classList.remove('ratio-tall');
      deviceFrame.classList.add('ratio-square');
    } else {
      deviceFrame.classList.remove('ratio-square');
      deviceFrame.classList.add('ratio-tall');
    }
  }

  if (screenKey === 'welcome') {
    startWelcomeAnimation();
  } else if (screenKey === 'game') {
    resizeCanvas();
    startGame();
  } else {
    gameActive = false;
  }
}

function showOverlay(overlayKey) {
  overlays[overlayKey].classList.add('active');
  if (overlayKey === 'pause') {
    isPaused = true;
  }
}

function hideOverlay(overlayKey) {
  overlays[overlayKey].classList.remove('active');
  if (overlayKey === 'pause') {
    isPaused = false;
    lastTime = performance.now();
  }
}

// --- Leaderboard functionality ---
function getLeaderboard() {
  const data = localStorage.getItem('jonigiri_leaderboard');
  return data ? JSON.parse(data) : [
    // Empty for now
  ];
}

function saveLeaderboard(name, score) {
  if (!name.trim()) return;
  const list = getLeaderboard();
  list.push({ name: name.trim(), score: parseInt(score) });
  list.sort((a, b) => b.score - a.score);
  list.splice(15);
  localStorage.setItem('jonigiri_leaderboard', JSON.stringify(list));
}

function renderLeaderboard() {
  leaderboardList.innerHTML = '';
  const list = getLeaderboard();
  list.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'leaderboard-item';

    let badgeClass = 'rank-other';
    if (index === 0) badgeClass = 'rank-1';
    else if (index === 1) badgeClass = 'rank-2';
    else if (index === 2) badgeClass = 'rank-3';

    li.innerHTML = `
      <div class="leaderboard-rank-name">
        <span class="rank-badge ${badgeClass}">${index + 1}</span>
        <span class="player-name">${item.name}</span>
      </div>
      <span class="leaderboard-score">${item.score.toLocaleString()}</span>
    `;
    leaderboardList.appendChild(li);
  });
}

// Canvas Resize
function resizeCanvas() {
  if (!canvas) return;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  // Set player dimensions dynamically to match desktop proportions exactly on mobile
  if (window.innerWidth < 600) {
    player.width = Math.round(canvas.width * 0.27);
    player.height = Math.round(canvas.width * 0.27);
  } else {
    player.width = 110;
    player.height = 110;
  }

  // Set player Y position near bottom
  player.y = canvas.height - player.height - 8;
  if (player.x === 0) {
    player.x = (canvas.width - player.width) / 2;
    player.targetX = player.x;
  }
}

// Game Logic
function startGame() {
  currentScore = 0;
  currentLives = maxLives;
  scoreVal.textContent = '0';
  updateMissGauge();

  fallingItems = [];
  speedMultiplier = 1;
  spawnInterval = 1200;

  player.x = (canvas.width - player.width) / 2;
  player.targetX = player.x;
  player.state = SPRITE_STATES.IDLE;
  player.stateTimer = 0;

  gameActive = true;
  isPaused = false;
  lastTime = performance.now();
  lastSpawnTime = lastTime;

  gameLoopId = requestAnimationFrame(gameLoop);
}

function updateMissGauge() {
  const percentage = (currentLives / maxLives) * 84;
  if (missGaugeFill) {
    missGaugeFill.style.height = `${percentage}%`;
  }
}

function spawnItem() {
  const isGood = Math.random() < 0.75;
  const pool = isGood ? foodsPool : thingsPool;
  if (pool.length === 0) return;

  const img = pool[Math.floor(Math.random() * pool.length)];

  // Set item size dynamically to match desktop proportions on mobile
  let size = 60;
  if (window.innerWidth < 600) {
    size = Math.round(canvas.width * 0.15);
  }

  const margin = 20;
  const x = margin + Math.random() * (canvas.width - size - margin * 2);

  fallingItems.push({
    x: x,
    y: -size,
    size: size,
    img: img,
    isGood: isGood,
    speed: (fallSpeedBase + Math.random() * 1.5) * speedMultiplier
  });
}

function gameLoop(timestamp) {
  if (!gameActive) return;
  if (isPaused) {
    gameLoopId = requestAnimationFrame(gameLoop);
    return;
  }

  const dt = timestamp - lastTime;
  lastTime = timestamp;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Very gradual speed progression (0.0035 multiplier increase per 10 points)
  speedMultiplier = 1 + (currentScore * 0.0035);

  // Spawn handling
  if (timestamp - lastSpawnTime > spawnInterval) {
    spawnItem();
    lastSpawnTime = timestamp;
    // Speed up spawn interval gradually
    spawnInterval = Math.max(650, 1200 - (currentScore * 2));
  }

  // Update Player Position
  updatePlayer(dt);

  // Update & Draw falling items
  updateItems(dt);

  // Draw Player
  drawPlayer();

  gameLoopId = requestAnimationFrame(gameLoop);
}

function updatePlayer(dt) {
  if (currentControlType === CONTROLS.KEYBOARD) {
    if (player.inputKeys.left) {
      player.x -= player.speed;
    }
    if (player.inputKeys.right) {
      player.x += player.speed;
    }
  } else {
    const dx = player.targetX - player.x;
    player.x += dx * 0.25;
  }

  // Bound player inside canvas
  const playerMargin = 10;
  if (player.x < playerMargin) player.x = playerMargin;
  if (player.x > canvas.width - player.width - playerMargin) player.x = canvas.width - player.width - playerMargin;

  // Handle Player Sprite timers
  if (player.stateTimer > 0) {
    player.stateTimer -= dt;
    if (player.stateTimer <= 0) {
      player.state = SPRITE_STATES.IDLE;
    }
  }

  // Scan nearest item above player mouth
  if (player.state === SPRITE_STATES.IDLE || player.state === SPRITE_STATES.LOOKING_UP) {
    let nearestItem = null;
    let nearestDist = Infinity;

    fallingItems.forEach(item => {
      const verticalDist = player.y - item.y;
      if (verticalDist > 0 && verticalDist < nearestDist) {
        nearestDist = verticalDist;
        nearestItem = item;
      }
    });

    if (nearestItem) {
      const itemCenterX = nearestItem.x + nearestItem.size / 2;
      const playerCenterX = player.x + player.width / 2;
      const horizontalDist = Math.abs(itemCenterX - playerCenterX);

      if (horizontalDist < player.width * 0.75 && nearestDist < 180) {
        if (nearestDist < 70) {
          player.state = SPRITE_STATES.CATCH_OPEN;
        } else {
          player.state = SPRITE_STATES.LOOKING_UP;
        }
      } else {
        player.state = SPRITE_STATES.IDLE;
      }
    } else {
      player.state = SPRITE_STATES.IDLE;
    }
  }
}

function updateItems(dt) {
  for (let i = fallingItems.length - 1; i >= 0; i--) {
    const item = fallingItems[i];
    item.y += item.speed;

    // Aspect Ratio Calculation to prevent stretching/distortion
    const ratio = item.img.naturalWidth / item.img.naturalHeight || 1;
    let drawW = item.size;
    let drawH = item.size;
    if (ratio > 1) {
      drawH = item.size / ratio;
    } else {
      drawW = item.size * ratio;
    }

    // Centered horizontal drawing relative to bounding box
    const drawX = item.x + (item.size - drawW) / 2;

    // Draw item
    ctx.drawImage(item.img, drawX, item.y, drawW, drawH);

    // Collision check
    const itemCenterX = item.x + item.size / 2;
    const playerCenterX = player.x + player.width / 2;

    const overlapX = Math.abs(itemCenterX - playerCenterX) < (player.width * 0.45);
    const overlapY = item.y + drawH >= player.y + 10 && item.y <= player.y + player.height * 0.6;

    if (overlapX && overlapY) {
      fallingItems.splice(i, 1);
      if (item.isGood) {
        triggerEatSuccess();
      } else {
        triggerHitBad(item.img.src);
      }
      continue;
    }

    // Miss check
    if (item.y > canvas.height) {
      fallingItems.splice(i, 1);
      if (item.isGood) {
        triggerMissFood();
      }
    }
  }
}

function drawPlayer() {
  const img = spritesMap[player.state] || spritesMap['idle'];
  if (img) {
    ctx.drawImage(img, player.x, player.y, player.width, player.height);
  }
}

// --- Game Actions ---
function triggerEatSuccess() {
  currentScore += 10;
  scoreVal.textContent = currentScore;
  soundManager.playEat();

  // Munch animations
  player.state = SPRITE_STATES.MUNCH_OPEN;
  player.stateTimer = 100;

  setTimeout(() => {
    if (player.state === SPRITE_STATES.MUNCH_OPEN) {
      player.state = SPRITE_STATES.MUNCH_CLOSED;
      player.stateTimer = 100;

      setTimeout(() => {
        if (player.state === SPRITE_STATES.MUNCH_CLOSED) {
          player.state = SPRITE_STATES.HAPPY;
          player.stateTimer = 400;
        }
      }, 100);
    }
  }, 100);
}

function triggerHitBad(imgSrc) {
  soundManager.playHitBad();
  gameActive = false;

  // Set Game Over screen character to ate-bad.png and change background image
  gameoverChar.src = 'assets/ate-bad.png';
  document.getElementById('screen-gameover').style.backgroundImage = "url('assets/backgrounds/gameover-badthing.png')";

  setTimeout(() => {
    showScreen('gameover');
  }, 500);
}

function triggerMissFood() {
  currentLives--;
  updateMissGauge();
  soundManager.playMiss();

  if (currentLives <= 0) {
    gameActive = false;

    // Set Game Over screen character to cry.png and change background image
    gameoverChar.src = 'assets/cry.png';
    document.getElementById('screen-gameover').style.backgroundImage = "url('assets/backgrounds/gameover-stamina.png')";

    setTimeout(() => {
      showScreen('gameover');
    }, 500);
  }
}

// --- Control Interactions ---
function handlePointerDown(e) {
  if (!gameActive || isPaused) return;
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clickX = clientX - rect.left;

  if (currentControlType === CONTROLS.TELEPORT) {
    player.x = clickX - player.width / 2;
    player.targetX = player.x;
  } else if (currentControlType === CONTROLS.DRAG) {
    player.targetX = clickX - player.width / 2;
  }
}

function handlePointerMove(e) {
  if (!gameActive || isPaused || currentControlType !== CONTROLS.DRAG) return;
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  player.targetX = clientX - rect.left - player.width / 2;
}

// --- Event Listeners Bindings ---
function initEvents() {
  // Navigation Buttons
  document.getElementById('btn-start').addEventListener('click', () => {
    soundManager.playBtnClick();
    showScreen('game');
  });

  const btnSettingsOpen = document.getElementById('btn-settings-open');
  if (btnSettingsOpen) {
    btnSettingsOpen.addEventListener('click', () => {
      soundManager.playBtnClick();
      showOverlay('settings');
    });
  }

  document.getElementById('btn-settings-close-confirm').addEventListener('click', () => {
    soundManager.playBtnClick();
    hideOverlay('settings');
  });

  const btnLeaderboardOpen = document.getElementById('btn-leaderboard-open');
  if (btnLeaderboardOpen) {
    btnLeaderboardOpen.addEventListener('click', () => {
      soundManager.playBtnClick();
      renderLeaderboard();
      showScreen('leaderboard');
    });
  }

  document.getElementById('btn-leaderboard-play').addEventListener('click', () => {
    soundManager.playBtnClick();
    showScreen('game');
  });

  document.getElementById('btn-leaderboard-home').addEventListener('click', () => {
    soundManager.playBtnClick();
    showScreen('welcome');
  });

  // Game UI Buttons
  document.getElementById('btn-pause').addEventListener('click', () => {
    soundManager.playBtnClick();
    showOverlay('pause');
  });

  document.getElementById('btn-resume').addEventListener('click', () => {
    soundManager.playBtnClick();
    hideOverlay('pause');
  });

  document.getElementById('btn-pause-home').addEventListener('click', () => {
    soundManager.playBtnClick();
    hideOverlay('pause');
    showScreen('welcome');
  });

  // Game Over Action Buttons
  document.getElementById('btn-restart').addEventListener('click', () => {
    soundManager.playBtnClick();
    showScreen('game');
  });

  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      soundManager.playBtnClick();
      showScreen('welcome');
    });
  }

  // Save Score
  document.getElementById('btn-save-score').addEventListener('click', () => {
    const name = playerNameInput.value || 'Player';
    saveLeaderboard(name, currentScore);
    playerNameInput.value = '';
    renderLeaderboard();
    showScreen('leaderboard');
  });

  // Setting Changes
  document.getElementById('setting-sound').addEventListener('change', (e) => {
    soundManager.enabled = e.target.checked;
  });

  document.getElementById('setting-controls').addEventListener('change', (e) => {
    currentControlType = e.target.value;
  });

  // Canvas Interactions (Mouse)
  canvas.addEventListener('mousedown', handlePointerDown);
  canvas.addEventListener('mousemove', handlePointerMove);

  // Canvas Interactions (Touch)
  canvas.addEventListener('touchstart', handlePointerDown);
  canvas.addEventListener('touchmove', handlePointerMove, { passive: true });

  // Keyboard Inputs
  window.addEventListener('keydown', (e) => {
    if (!gameActive || isPaused) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      player.inputKeys.left = true;
      currentControlType = CONTROLS.KEYBOARD;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      player.inputKeys.right = true;
      currentControlType = CONTROLS.KEYBOARD;
    }
    if (e.key === 'Escape') {
      showOverlay('pause');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      player.inputKeys.left = false;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      player.inputKeys.right = false;
    }
  });

  window.addEventListener('resize', resizeCanvas);
}

// --- Initialize App ---
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  preloadAssets(() => {
    initEvents();
    showScreen('welcome');
  });
});
