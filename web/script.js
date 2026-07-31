/* ==========================================
   DotVerse - Complete Production Game Logic (script.js)
   ========================================== */

const firebaseConfig = {
    apiKey: "AIzaSyDt-Yzy6S9VK3ucd-sVM9nTtfahcotFncc",
    authDomain: "dotverse-9850e.firebaseapp.com",
    databaseURL: "https://dotverse-9850e-default-rtdb.firebaseio.com",
    projectId: "dotverse-9850e",
    storageBucket: "dotverse-9850e.firebasestorage.app",
    messagingSenderId: "539684224862",
    appId: "1:539684224862:web:8aa2f7b4de430b9e4ad9cf"
};

try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.log("Firebase already initialized");
}
const db = firebase.database();

let gridSize = 6; 
let isCreator = false; 

// 20 پالت رنگی کاملاً متمایز، روشن، پررنگ و متضاد با تم گرافیت (آبی پررنگ، تفکیک دقیق قرمز و صورتی، بدون رنگ خاکستری)
const PLAYER_COLORS = [
    '#38bdf8', // آبی آسمانی روشن
    '#22c55e', // سبز چمنی
    '#ef4444', // قرمز خالص
    '#ec4899', // صورتی سرخابی (کاملاً جدا از قرمز)
    '#eab308', // زرد خالص 
    '#a855f7', // بنفش روشن
    '#1d4ed8', // آبی پررنگ (تیره و کاملاً متمایز از آبی روشن)
    '#f97316', // نارنجی پررنگ
    '#14b8a6', // فیروزه‌ای تیره/سبز آبی
    '#84cc16', // سبز لیمویی روشن
    '#6366f1', // نیلی / آبی مایل به بنفش
    '#d946ef', // ارغوانی
    '#10b981', // سبز زمردی
    '#f43f5e', // صورتی مرجانی
    '#0284c7', // آبی کاربنی متوسط
    '#8b5cf6', // بنفش بادمجانی
    '#f59e0b', // کهربایی گرم
    '#06b6d4', // سایان / آبی یخی پررنگ
    '#8b5cf6', // بنفش شاه‌توتی
    '#fb7185'  // صورتی روشن گرم
];

// نمادهای حیوانات برای بازیکنان (تا 20 نماد مجزا)
const ANIMAL_SYMBOLS = ['🐶', '🐱', '🦊', '🐼', '🦁', '🐯', '🐰', '🐨', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛'];

let boardState = {
    size: 6,
    lines: {},
    squares: [],
    players: [], 
    currentTurnIndex: 0,
    turnTimer: 20, 
    gameStarted: false,
    settingsOpened: false
};

class GameTimerManager {
    constructor() {
        this.intervalId = null;
        this.alertTimeoutId = null;
        this.sequenceTimeoutId = null;
    }

    start(onTimeout) {
        this.stop();
        boardState.turnTimer = 20;
        updateTimerUI();
        updateUI();

        this.intervalId = setInterval(() => {
            const currentPlayer = boardState.players[boardState.currentTurnIndex];
            if (!currentPlayer) return;

            boardState.turnTimer--;
            
            if (currentPlayer.totalTime > 0) {
                currentPlayer.totalTime--;
            }

            updateTimerUI();
            updateUI();

            if (boardState.turnTimer <= 5 && boardState.turnTimer > 0) {
                // مخفی کردن بنر نوبت بالای صفحه برای جلوگیری از تداخل متن‌ها
                const banner = document.getElementById('turn-banner');
                if (banner) banner.innerHTML = "";

                // نمایش ثابت هشدار بدون چشمک زدن
                showPersistentAlert(`${currentPlayer.name}: ${boardState.turnTimer} ثانیه تا حذف`);
            }

            if (boardState.turnTimer <= 0 || currentPlayer.totalTime <= 0) {
                this.stop();
                onTimeout();
            }
        }, 1000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    clearAlerts() {
        if (this.alertTimeoutId) clearTimeout(this.alertTimeoutId);
        if (this.sequenceTimeoutId) clearTimeout(this.sequenceTimeoutId);
        let alertEl = document.getElementById('custom-floating-alert');
        if (alertEl) alertEl.style.display = 'none';
    }

    triggerActionSequence(currentPlayer, nextPlayer, hasBonusTurn) {
        this.clearAlerts();
        showFloatingAlert(`${currentPlayer.name} حرکتش را انجام داد`, 1200);

        if (hasBonusTurn) {
            this.sequenceTimeoutId = setTimeout(() => {
                updateUI();
            }, 1300);
        } else if (nextPlayer) {
            this.sequenceTimeoutId = setTimeout(() => {
                showFloatingAlert(`نوبت ${nextPlayer.animal} ${nextPlayer.name} است`, 1500);
                updateUI();
            }, 1300);
        }
    }
}

const timerManager = new GameTimerManager();

document.addEventListener('DOMContentLoaded', () => {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }

    setupDrawer();
    calculateDynamicGridSize();
    
    window.addEventListener('resize', () => {
        calculateDynamicGridSize();
        renderBoard();
    });
    
    // حالت واقعی: منتظر شروع بازی توسط کاربر می‌مانیم یا از سرور می‌خوانیم
    initDefaultRealPlayers();
    renderBoard();
    updateUI();
});

// مقداردهی اولیه بازیکنان واقعی برای شروع بازی
function initDefaultRealPlayers() {
    let shuffledColors = [...PLAYER_COLORS].sort(() => Math.random() - 0.5);
    let shuffledAnimals = [...ANIMAL_SYMBOLS].sort(() => Math.random() - 0.5);

    boardState.players = [
        { id: 101, name: "بازیکن ۱", color: shuffledColors[0], animal: shuffledAnimals[0], score: 0, totalTime: 180 },
        { id: 102, name: "بازیکن ۲", color: shuffledColors[1], animal: shuffledAnimals[1], score: 0, totalTime: 180 }
    ];
    boardState.gameStarted = true;
    startTurnTimer();
}

function calculateDynamicGridSize() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const minDim = Math.min(screenWidth, screenHeight);
    if (minDim < 360) {
        gridSize = 5;
    } else if (minDim < 450) {
        gridSize = 6;
    } else if (minDim < 600) {
        gridSize = 7;
    } else {
        gridSize = 8;
    }
    boardState.size = gridSize;
}

function renderBoard() {
    const container = document.getElementById('board-container');
    if (!container) return;

    container.innerHTML = '';

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    const availableWidth = Math.min(screenWidth - 24, screenHeight * 0.60, 500);
    const padding = 16;
    const innerWidth = availableWidth - (padding * 2);
    
    const spacing = innerWidth / (gridSize - 1);

    let dotSize = Math.max(6, Math.floor(spacing * 0.22));
    let lineThickness = Math.max(2, Math.floor(dotSize * 0.35));

    document.documentElement.style.setProperty('--dot-size', `${dotSize}px`);
    document.documentElement.style.setProperty('--line-thickness', `${lineThickness}px`);

    container.style.width = `${availableWidth}px`;
    container.style.height = `${availableWidth}px`;

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const x = padding + (c * spacing);
            const y = padding + (r * spacing);

            if (c < gridSize - 1) {
                createLineElement(container, x, y, spacing, lineThickness, 'h', r, c);
            }
            if (r < gridSize - 1) {
                createLineElement(container, x, y, spacing, lineThickness, 'v', r, c);
            }
        }
    }

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const x = padding + (c * spacing);
            const y = padding + (r * spacing);

            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.style.left = `${x}px`;
            dot.style.top = `${y}px`;
            container.appendChild(dot);
        }
    }

    renderSquares(container, padding, spacing);
}

function createLineElement(container, x, y, spacing, thickness, type, r, c) {
    const line = document.createElement('div');
    const lineId = `${type}_${r}_${c}`;
    
    line.className = `line line-${type === 'h' ? 'horizontal' : 'vertical'}`;
    line.dataset.id = lineId;

    if (type === 'h') {
        line.style.left = `${x}px`;
        line.style.top = `${y}px`;
        line.style.width = `${spacing}px`;
    } else {
        line.style.left = `${x}px`;
        line.style.top = `${y}px`;
        line.style.height = `${spacing}px`;
    }

    const lineData = boardState.lines[lineId];
    if (lineData) {
        line.classList.add('drawn');
        applyLineStyle(line, lineData, type);
    } else {
        line.style.background = 'transparent';
        line.addEventListener('click', () => handleLineClick(lineId, line, type));
    }

    container.appendChild(line);
}

function applyLineStyle(lineElement, lineData, type) {
    const adjacentSquares = lineData.squares || [];
    const uniqueOwners = [];
    const seenPlayerIds = new Set();
    
    for (const sq of adjacentSquares) {
        if (!seenPlayerIds.has(sq.player)) {
            seenPlayerIds.add(sq.player);
            uniqueOwners.push({ player: sq.player, color: sq.color, timestamp: sq.timestamp });
        }
    }

    if (uniqueOwners.length === 1) {
        lineElement.style.background = uniqueOwners[0].color;
    } else if (uniqueOwners.length >= 2) {
        const sorted = [...uniqueOwners].sort((a, b) => a.timestamp - b.timestamp);
        const c1 = sorted[0].color; 
        const c2 = sorted[1].color; 

        if (type === 'h') {
            lineElement.style.background = `linear-gradient(to left, ${c1} 50%, ${c2} 50%)`;
        } else {
            lineElement.style.background = `linear-gradient(to bottom, ${c1} 50%, ${c2} 50%)`;
        }
    } else {
        lineElement.style.background = lineData.defaultColor;
    }
}

function handleLineClick(lineId, lineElement, type) {
    if (!boardState.gameStarted) return;
    if (boardState.lines[lineId]) return;

    const timerSnapshot = boardState.turnTimer;
    const currentPlayer = boardState.players[boardState.currentTurnIndex];

    boardState.lines[lineId] = {
        defaultColor: currentPlayer.color,
        squares: []
    };

    lineElement.classList.add('drawn');
    lineElement.style.background = currentPlayer.color;

    const newSquaresCount = checkForCompletedSquares(currentPlayer, lineId);
    const hasBonusTurn = newSquaresCount > 0;

    if (timerSnapshot <= 5) {
        timerManager.stop();
        const nextTempIndex = hasBonusTurn ? boardState.currentTurnIndex : (boardState.currentTurnIndex + 1) % boardState.players.length;
        const nextPlayerTemp = boardState.players[nextTempIndex];

        timerManager.triggerActionSequence(currentPlayer, nextPlayerTemp, hasBonusTurn);
    }

    if (!hasBonusTurn) {
        setTimeout(() => {
            nextTurn();
        }, timerSnapshot <= 5 ? 2500 : 0);
    } else {
        resetTurnTimer();
        updateUI();
        renderBoard();
    }
}

function checkForCompletedSquares(player, triggeredLineId) {
    let count = 0;
    const timestamp = Date.now();

    for (let r = 0; r < gridSize - 1; r++) {
        for (let c = 0; c < gridSize - 1; c++) {
            const topId = `h_${r}_${c}`;
            const bottomId = `h_${r + 1}_${c}`;
            const leftId = `v_${r}_${c}`;
            const rightId = `v_${r}_${c + 1}`;

            const top = boardState.lines[topId];
            const bottom = boardState.lines[bottomId];
            const left = boardState.lines[leftId];
            const right = boardState.lines[rightId];

            const squareId = `sq_${r}_${c}`;
            const exists = boardState.squares.some(sq => sq.id === squareId);

            if (top && bottom && left && right && !exists) {
                if (topId === triggeredLineId || bottomId === triggeredLineId || leftId === triggeredLineId || rightId === triggeredLineId) {
                    boardState.squares.push({
                        id: squareId,
                        r: r,
                        c: c,
                        player: player.id,
                        color: player.color,
                        animal: player.animal,
                        timestamp: timestamp
                    });
                    player.score += 1;
                    count++;

                    addSquareToLine(topId, player, timestamp);
                    addSquareToLine(bottomId, player, timestamp);
                    addSquareToLine(leftId, player, timestamp);
                    addSquareToLine(rightId, player, timestamp);
                }
            }
        }
    }

    if (count > 0) {
        updateUI();
    }

    return count;
}

function addSquareToLine(lineId, player, timestamp) {
    if (!boardState.lines[lineId]) return;
    if (!boardState.lines[lineId].squares) {
        boardState.lines[lineId].squares = [];
    }
    const exists = boardState.lines[lineId].squares.some(s => s.player === player.id && s.timestamp === timestamp);
    if (!exists) {
        boardState.lines[lineId].squares.push({
            player: player.id,
            color: player.color,
            timestamp: timestamp
        });
    }
}

function renderSquares(container, padding, spacing) {
    boardState.squares.forEach(sq => {
        const squareEl = document.createElement('div');
        squareEl.className = 'square';
        squareEl.style.left = `${padding + (sq.c * spacing)}px`;
        squareEl.style.top = `${padding + (sq.r * spacing)}px`;
        squareEl.style.width = `${spacing}px`;
        squareEl.style.height = `${spacing}px`;
        
        squareEl.textContent = sq.animal;
        squareEl.style.fontSize = `${Math.floor(spacing * 0.45)}px`;

        container.appendChild(squareEl);
    });
}

function startTurnTimer() {
    timerManager.start(() => { handlePlayerTimeout(); });
}

function resetTurnTimer() {
    startTurnTimer();
}

function showPersistentAlert(text) {
    let alertEl = document.getElementById('custom-floating-alert');
    if (!alertEl) {
        alertEl = document.createElement('div');
        alertEl.id = 'custom-floating-alert';
        alertEl.style.cssText = 'position:fixed; top:75px; left:50%; transform:translateX(-50%); background:rgba(15, 23, 42, 0.92); border: 1px solid rgba(56, 189, 248, 0.4); color:#38bdf8; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:bold; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.4); text-align:center; direction:rtl; pointer-events:none;';
        document.body.appendChild(alertEl);
    }
    alertEl.textContent = text;
    alertEl.style.display = 'block';
}

function showFloatingAlert(text, duration = 1500) {
    let alertEl = document.getElementById('custom-floating-alert');
    if (!alertEl) {
        alertEl = document.createElement('div');
        alertEl.id = 'custom-floating-alert';
        alertEl.style.cssText = 'position:fixed; top:75px; left:50%; transform:translateX(-50%); background:rgba(15, 23, 42, 0.92); border: 1px solid rgba(56, 189, 248, 0.4); color:#38bdf8; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:bold; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.4); text-align:center; direction:rtl; pointer-events:none;';
        document.body.appendChild(alertEl);
    }
    alertEl.textContent = text;
    alertEl.style.display = 'block';
    
    if (timerManager.alertTimeoutId) clearTimeout(timerManager.alertTimeoutId);
    timerManager.alertTimeoutId = setTimeout(() => {
        if (alertEl) alertEl.style.display = 'none';
    }, duration);
}

function handlePlayerTimeout() {
    if (boardState.players.length === 0) return;

    const timedOutPlayer = boardState.players[boardState.currentTurnIndex];
    showFloatingAlert(`${timedOutPlayer.name} از بازی حذف شد`, 2000);

    boardState.players.splice(boardState.currentTurnIndex, 1);

    if (boardState.players.length > 0) {
        boardState.currentTurnIndex = boardState.currentTurnIndex % boardState.players.length;
        startTurnTimer();
        const nextPlayer = boardState.players[boardState.currentTurnIndex];
        setTimeout(() => {
            showFloatingAlert(`نوبت ${nextPlayer.animal} ${nextPlayer.name} است`, 1500);
            updateUI();
        }, 2000);
    } else {
        boardState.gameStarted = false;
        showFloatingAlert('بازی به پایان رسید', 2000);
        updateUI();
    }
}

function updateTimerUI() {
    const timerEl = document.getElementById('floating-timer');
    if (timerEl) {
        timerEl.textContent = `⏳ ${boardState.turnTimer}s`;

        if (boardState.turnTimer <= 5) {
            timerEl.classList.add('warning');
        } else {
            timerEl.classList.remove('warning');
        }
    }
}

function nextTurn() {
    if (boardState.players.length === 0) return;
    boardState.currentTurnIndex = (boardState.currentTurnIndex + 1) % boardState.players.length;
    updateUI();
    resetTurnTimer();
}

function updateUI() {
    const banner = document.getElementById('turn-banner');
    if (boardState.gameStarted && boardState.players.length > 0) {
        const currentPlayer = boardState.players[boardState.currentTurnIndex];
        if (banner) {
            banner.innerHTML = `نوبت بازی: <span style="color:${currentPlayer.color}; font-weight:900;">${currentPlayer.animal} ${currentPlayer.name}</span>`;
        }
    } else {
        if (banner) banner.textContent = "در انتظار نوبت بازی...";
    }

    const playerCountSpan = document.getElementById('player-count');
    if (playerCountSpan) {
        playerCountSpan.textContent = boardState.players.length;
    }

    const listContainer = document.getElementById('players-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    boardState.players.forEach((player, idx) => {
        const isCurrent = idx === boardState.currentTurnIndex;
        const item = document.createElement('div');
        item.className = `player-item ${isCurrent && boardState.gameStarted ? 'active-turn' : ''}`;
        
        const mins = Math.floor(player.totalTime / 60);
        const secs = player.totalTime % 60;
        const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        const playerInfoDiv = document.createElement('div');
        playerInfoDiv.className = 'player-info';
        playerInfoDiv.style.cssText = 'display:flex; align-items:center; gap:8px;';
        playerInfoDiv.innerHTML = `
            <span class="player-badge" style="background:${player.color}; padding:4px 8px; border-radius:4px;">${player.animal}</span>
            <div>
                <div><b>${player.name}</b> ${isCurrent && boardState.gameStarted ? '📌' : ''}</div>
                <div style="font-size: 11px; color: #94a3b8;">زمان باقی‌مانده: ${timeFormatted}</div>
            </div>
        `;

        const playerRightDiv = document.createElement('div');
        playerRightDiv.style.cssText = 'display:flex; align-items:center;';
        playerRightDiv.innerHTML = `<b style="margin-left:8px;">امتیاز: ${player.score}</b>`;

        item.appendChild(playerInfoDiv);
        item.appendChild(playerRightDiv);
        listContainer.appendChild(item);
    });
}

function setupDrawer() {
    const menuToggle = document.getElementById('menu-toggle');
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const closeBtn = document.getElementById('drawer-close');

    function openDrawer() {
        if (drawer) drawer.classList.add('open');
        if (overlay) overlay.classList.add('active');
    }

    function closeDrawer() {
        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (drawer && drawer.classList.contains('open')) {
                closeDrawer();
            } else {
                openDrawer();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDrawer();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDrawer();
        });
    }
}