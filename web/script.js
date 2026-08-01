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
let gameStartedByHost = false; 

// 20 پالت رنگی کاملاً متمایز، روشن و پررنگ
const PLAYER_COLORS = [
    '#38bdf8', '#22c55e', '#ef4444', '#ec4899', '#eab308', 
    '#a855f7', '#1d4ed8', '#f97316', '#14b8a6', '#84cc16', 
    '#6366f1', '#d946ef', '#10b981', '#f43f5e', '#0284c7', 
    '#8b5cf6', '#f59e0b', '#06b6d4', '#8b5cf6', '#fb7185'
];

// نمادهای حیوانات برای بازیکنان
const ANIMAL_SYMBOLS = ['🐶', '🐱', '🦊', '🐼', '🦁', '🐯', '🐰', '🐨', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛'];

let boardState = {
    size: 6,
    lines: {},
    squares: [],
    players: [], 
    currentTurnIndex: 0,
    turnTimer: 20, 
    gameStarted: false,
    settingsOpened: false,
    creatorId: null
};

class GameTimerManager {
    constructor() {
        this.intervalId = null;
        this.alertTimeoutId = null;
        this.sequenceTimeoutId = null;
    }

    start(onTimeout) {
        this.stop();
        if (!gameStartedByHost) return;
        boardState.turnTimer = 20;
        updateTimerUI();
        updateUI();

        this.intervalId = setInterval(() => {
            const currentPlayer = boardState.players[boardState.currentTurnIndex];
            if (!currentPlayer || currentPlayer.isEliminated) {
                this.switchToNextValidPlayer();
                return;
            }

            boardState.turnTimer--;
            if (currentPlayer.totalTime > 0) {
                currentPlayer.totalTime--;
            }

            updateTimerUI();
            updateUI();

            if (boardState.turnTimer <= 5 && boardState.turnTimer > 0) {
                const banner = document.getElementById('turn-banner');
                if (banner) banner.innerHTML = "";
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

    switchToNextValidPlayer() {
        if (boardState.players.length === 0) return;
        let startIndex = boardState.currentTurnIndex;
        do {
            boardState.currentTurnIndex = (boardState.currentTurnIndex + 1) % boardState.players.length;
        } while (boardState.players[boardState.currentTurnIndex].isEliminated && boardState.currentTurnIndex !== startIndex);
    }
}

const timerManager = new GameTimerManager();

document.addEventListener('DOMContentLoaded', () => {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('chat_id') || 'default_room';

    registerCurrentTelegramUser(chatId);
    setupDrawer();
    loadGameDataFromFirebase();
    setupZoomAndPan();
    
    window.addEventListener('resize', () => {
        renderBoard();
    });
});

// ثبت‌نام کاربر واقعی بر اساس نام پروفایل تلگرام
function registerCurrentTelegramUser(chatId) {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!tgUser) return;

    const userId = String(tgUser.id);
    const userName = tgUser.first_name || "بازیکن";

    const playerRef = db.ref(`rooms/${chatId}/players/${userId}`);
    playerRef.once('value', (snapshot) => {
        if (!snapshot.exists()) {
            let randomColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
            let randomAnimal = ANIMAL_SYMBOLS[Math.floor(Math.random() * ANIMAL_SYMBOLS.length)];
            
            playerRef.set({
                id: userId,
                name: userName,
                color: randomColor,
                animal: randomAnimal,
                score: 0,
                totalTime: 180,
                isEliminated: false
            });
        }
    });
}

function loadGameDataFromFirebase() {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('chat_id') || 'default_room';

    db.ref(`rooms/${chatId}`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            if (data.size) {
                gridSize = data.size;
                boardState.size = gridSize;
            }
            if (data.creatorId) {
                boardState.creatorId = String(data.creatorId);
            }
            if (data.players) {
                let rawPlayers = Object.values(data.players);
                
                // مرتب‌سازی برای اینکه سازنده همیشه بالاترین جایگاه را داشته باشد
                rawPlayers.sort((a, b) => {
                    if (String(a.id) === String(boardState.creatorId)) return -1;
                    if (String(b.id) === String(boardState.creatorId)) return 1;
                    return 0;
                });

                boardState.players = rawPlayers.map((p, idx) => ({
                    id: String(p.id),
                    name: p.name,
                    color: p.color || PLAYER_COLORS[idx % PLAYER_COLORS.length],
                    animal: p.animal || ANIMAL_SYMBOLS[idx % ANIMAL_SYMBOLS.length],
                    score: p.score || 0,
                    totalTime: p.totalTime !== undefined ? p.totalTime : 180,
                    isCreator: String(p.id) === String(boardState.creatorId),
                    isEliminated: p.isEliminated || false
                }));
            } else {
                boardState.players = [];
            }
            if (data.gameStartedByHost !== undefined) {
                gameStartedByHost = data.gameStartedByHost;
                boardState.gameStarted = gameStartedByHost;
                if (gameStartedByHost && !timerManager.intervalId) {
                    startTurnTimer();
                }
            }
            if (data.lines) {
                boardState.lines = data.lines;
            }
            if (data.squares) {
                boardState.squares = data.squares;
            }
        } else {
            boardState.players = [];
        }

        renderBoard();
        updateUI();
        checkGameWinnerCondition();
    });
}

// قابلیت زوم و پن (پویش) صفحه
function setupZoomAndPan() {
    const container = document.getElementById('board-container');
    if (!container) return;

    let scale = 1;
    let panning = false;
    let pointX = 0;
    let pointY = 0;
    let startX = 0;
    let startY = 0;

    container.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('line') || e.target.classList.contains('dot')) return;
        panning = true;
        startX = e.clientX - pointX;
        startY = e.clientY - pointY;
        container.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        panning = false;
        container.style.cursor = 'default';
    });

    window.addEventListener('mousemove', (e) => {
        if (!panning) return;
        e.preventDefault();
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        container.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    });

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            scale *= 1.1;
        } else {
            scale /= 1.1;
        }
        scale = Math.min(Math.max(1, scale), 3.5);
        container.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    }, { passive: false });
}

function renderBoard() {
    const container = document.getElementById('board-container');
    if (!container) return;

    container.innerHTML = '';

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    const availableWidth = Math.min(screenWidth - 24, screenHeight * 0.60, 500);
    const padding = 20;
    const innerWidth = availableWidth - (padding * 2);
    
    const spacing = innerWidth / (gridSize - 1);

    let dotSize = Math.max(5, Math.floor(spacing * 0.20));
    let lineThickness = Math.max(2, Math.floor(dotSize * 0.40));

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
    if (!gameStartedByHost) {
        showFloatingAlert('بازی هنوز توسط سازنده شروع نشده است!', 1500);
        return;
    }
    const currentPlayer = boardState.players[boardState.currentTurnIndex];
    if (!currentPlayer || currentPlayer.isEliminated) return;
    if (boardState.lines[lineId]) return;

    boardState.lines[lineId] = {
        defaultColor: currentPlayer.color,
        squares: []
    };

    lineElement.classList.add('drawn');
    lineElement.style.background = currentPlayer.color;

    const newSquaresCount = checkForCompletedSquares(currentPlayer, lineId);
    const hasBonusTurn = newSquaresCount > 0;

    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('chat_id') || 'default_room';
    db.ref(`rooms/${chatId}`).update({
        lines: boardState.lines,
        squares: boardState.squares,
        players: boardState.players
    });

    if (!hasBonusTurn) {
        timerManager.switchToNextValidPlayer();
        startTurnTimer();
    } else {
        startTurnTimer();
    }
    updateUI();
    checkGameWinnerCondition();
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
    const currentPlayer = boardState.players[boardState.currentTurnIndex];
    if (!currentPlayer) return;

    currentPlayer.isEliminated = true;
    showFloatingAlert(`${currentPlayer.name} از بازی حذف شد`, 2000);

    timerManager.switchToNextValidPlayer();
    startTurnTimer();
    updateUI();
    checkGameWinnerCondition();
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

function checkGameWinnerCondition() {
    const totalPossibleSquares = (gridSize - 1) * (gridSize - 1);
    const activePlayers = boardState.players.filter(p => !p.isEliminated);

    if (boardState.squares.length === totalPossibleSquares || activePlayers.length <= 1) {
        timerManager.stop();
        let winner = activePlayers.reduce((max, p) => p.score > max.score ? p : max, activePlayers[0] || boardState.players[0]);
        if (winner) {
            showPersistentAlert(`🏆 ${winner.name} برنده بازی شد!`);
        }
    }
}

function updateUI() {
    const banner = document.getElementById('turn-banner');
    if (gameStartedByHost && boardState.players.length > 0) {
        const currentPlayer = boardState.players[boardState.currentTurnIndex];
        if (banner && currentPlayer) {
            banner.innerHTML = `نوبت بازی: <span style="color:${currentPlayer.color}; font-weight:900;">${currentPlayer.animal} ${currentPlayer.name}</span>`;
        }
    } else {
        if (banner) banner.textContent = "در انتظار شروع بازی توسط سازنده...";
    }

    const playerCountSpan = document.getElementById('player-count');
    if (playerCountSpan) {
        playerCountSpan.textContent = boardState.players.length;
    }

    const listContainer = document.getElementById('players-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // دکمه شروع بازی در بالای لیست (فقط برای سازنده نمایش داده می‌شود)
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const currentUserId = tgUser ? String(tgUser.id) : null;
    const isUserCreator = currentUserId && boardState.creatorId && currentUserId === String(boardState.creatorId);

    if (isUserCreator && !gameStartedByHost) {
        const startBtnDiv = document.createElement('div');
        startBtnDiv.style.cssText = 'margin-bottom: 12px; text-align: center;';
        startBtnDiv.innerHTML = `
            <button id="host-start-game-btn" style="width: 100%; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; box-shadow: 0 4px 10px rgba(34, 197, 94, 0.3);">
                🚀 شروع بازی
            </button>
        `;
        listContainer.appendChild(startBtnDiv);

        setTimeout(() => {
            const btn = document.getElementById('host-start-game-btn');
            if (btn) {
                btn.onclick = () => {
                    gameStartedByHost = true;
                    const urlParams = new URLSearchParams(window.location.search);
                    const chatId = urlParams.get('chat_id') || 'default_room';
                    db.ref(`rooms/${chatId}`).update({ gameStartedByHost: true });
                    startTurnTimer();
                    updateUI();
                };
            }
        }, 50);
    }

    let sortedDisplayPlayers = [...boardState.players];
    sortedDisplayPlayers.sort((a, b) => {
        if (a.isCreator) return -1;
        if (b.isCreator) return 1;
        return 0;
    });

    sortedDisplayPlayers.forEach((player) => {
        const originalIdx = boardState.players.findIndex(p => String(p.id) === String(player.id));
        const isCurrent = originalIdx === boardState.currentTurnIndex && gameStartedByHost && !player.isEliminated;
        
        const item = document.createElement('div');
        item.className = `player-item ${isCurrent && gameStartedByHost ? 'active-turn' : ''} ${player.isEliminated ? 'eliminated-player' : ''}`;
        
        if (player.isEliminated) {
            item.style.opacity = '0.5';
        }

        const mins = Math.floor(player.totalTime / 60);
        const secs = player.totalTime % 60;
        const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        const playerInfoDiv = document.createElement('div');
        playerInfoDiv.className = 'player-info';
        playerInfoDiv.style.cssText = 'display:flex; align-items:center; gap:8px; position:relative;';
        
        let creatorStar = player.isCreator ? ' ⭐' : '';
        let eliminatedBadge = player.isEliminated ? '<span style="font-size:10px; background:#ef4444; color:white; padding:1px 5px; border-radius:4px; margin-right:5px;">حذف شده</span>' : '';

        playerInfoDiv.innerHTML = `
            <span class="player-badge" style="background:${player.color}; padding:4px 8px; border-radius:4px;">${player.animal}</span>
            <div>
                <div><b>${player.name}</b>${creatorStar} ${isCurrent && gameStartedByHost ? '📌' : ''} ${eliminatedBadge}</div>
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