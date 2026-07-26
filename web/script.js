/* ==========================================
   DotVerse - Complete Game Logic (script.js)
   ========================================== */

const PLAYER_COLORS = [
    "#38bdf8", "#ef4444", "#22c55e", "#f59e0b", "#a855f7",
    "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
    "#eab308", "#6366f1", "#d946ef", "#10b981", "#f43f5e",
    "#8b5cf6", "#0284c7", "#f472b6", "#34d399", "#fbbf24"
];

const PLAYER_ANIMALS = [
    "🦁", "🦊", "🐻", "🐼", "🐯",
    "🐰", "🐺", "🐵", "🦄", "🐸",
    "🐮", "🦉", "🦅", "🐧", "🐙",
    "🐝", "🦋", "🐬", "🐢", "🐿️"
];

const urlParams = new URLSearchParams(window.location.search);
const gridSize = parseInt(urlParams.get('size')) || 8;

let boardState = {
    size: gridSize,
    lines: {},
    squares: [],
    players: [],
    currentTurnIndex: 0,
    timer: 20,
    timerInterval: null
};

document.addEventListener('DOMContentLoaded', () => {
    const welcomeOverlay = document.getElementById('welcome-overlay');
    const startBtnModal = document.getElementById('start-game-modal-btn');

    // تنظیمات تلگرام وب‌اپ
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }

    // رویداد کلیک روی دکمه شروع بازی در پیام شناور
    if (startBtnModal) {
        startBtnModal.addEventListener('click', () => {
            // مخفی کردن پیام خوش‌آمدگویی
            if (welcomeOverlay) {
                welcomeOverlay.classList.add('hidden');
            }
            // شروع بازی و تایمر
            initGame();
        });
    }

    setupDrawer();
    window.addEventListener('resize', renderBoard);
});

function initGame() {
    const rawPlayers = [
        { id: 101, name: "علی" },
        { id: 102, name: "رضا" }
    ];

    boardState.players = rawPlayers.map((p, idx) => ({
        ...p,
        color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
        animal: PLAYER_ANIMALS[idx % PLAYER_ANIMALS.length],
        score: 0
    }));

    updateUI();
    renderBoard();
    startTimer();
}

function renderBoard() {
    const container = document.getElementById('board-container');
    if (!container) return;

    container.innerHTML = '';

    const screenWidth = window.innerWidth;
    const maxContainerWidth = screenWidth >= 1024 ? 640 : Math.min(screenWidth - 32, 500);
    const padding = 20;
    const availableWidth = maxContainerWidth - (padding * 2);
    
    const spacing = availableWidth / (gridSize - 1);

    let dotSize = Math.max(8, Math.floor(spacing * 0.26));
    let lineThickness = Math.max(3, Math.floor(dotSize * 0.38));

    if (screenWidth >= 1024) {
        dotSize = Math.floor(dotSize * 1.25);
        lineThickness = Math.floor(lineThickness * 1.25);
    }

    document.documentElement.style.setProperty('--dot-size', `${dotSize}px`);
    document.documentElement.style.setProperty('--line-thickness', `${lineThickness}px`);

    container.style.width = `${maxContainerWidth}px`;
    container.style.height = `${maxContainerWidth}px`;

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
    if (boardState.lines[lineId]) return;

    const currentPlayer = boardState.players[boardState.currentTurnIndex];

    boardState.lines[lineId] = {
        defaultColor: currentPlayer.color,
        squares: []
    };

    lineElement.classList.add('drawn');
    lineElement.style.background = currentPlayer.color;

    const newSquaresCount = checkForCompletedSquares(currentPlayer);

    if (newSquaresCount === 0) {
        nextTurn();
    } else {
        resetTimer();
        updateUI();
        renderBoard();
    }
}

function checkForCompletedSquares(player) {
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

    if (count > 0) {
        updateUI();
    }

    return count;
}

function addSquareToLine(lineId, player, timestamp) {
    if (boardState.lines[lineId]) {
        const exists = boardState.lines[lineId].squares.some(s => s.player === player.id && s.timestamp === timestamp);
        if (!exists) {
            boardState.lines[lineId].squares.push({
                player: player.id,
                color: player.color,
                timestamp: timestamp
            });
        }
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
        squareEl.style.fontSize = `${Math.floor(spacing * 0.48)}px`;

        container.appendChild(squareEl);
    });
}

function startTimer() {
    clearInterval(boardState.timerInterval);
    boardState.timer = 20;
    updateTimerUI();

    boardState.timerInterval = setInterval(() => {
        boardState.timer--;
        updateTimerUI();

        if (boardState.timer <= 0) {
            nextTurn();
        }
    }, 1000);
}

function resetTimer() {
    startTimer();
}

function updateTimerUI() {
    const timerEl = document.getElementById('floating-timer');
    if (timerEl) {
        timerEl.textContent = `⏳ زمان باقی‌مانده: ${boardState.timer}s`;
        if (boardState.timer <= 5) {
            timerEl.classList.add('warning');
        } else {
            timerEl.classList.remove('warning');
        }
    }

    const miniTimerEl = document.getElementById('active-player-timer');
    if (miniTimerEl) {
        miniTimerEl.textContent = `⏳ ${boardState.timer}s`;
    }
}

function nextTurn() {
    boardState.currentTurnIndex = (boardState.currentTurnIndex + 1) % boardState.players.length;
    updateUI();
    resetTimer();
}

function updateUI() {
    const banner = document.getElementById('turn-banner');
    const currentPlayer = boardState.players[boardState.currentTurnIndex];
    if (banner) {
        banner.innerHTML = `نوبت بازی: <span style="color:${currentPlayer.color}; font-weight:900;">${currentPlayer.animal} ${currentPlayer.name}</span>`;
    }

    const listContainer = document.getElementById('players-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    boardState.players.forEach((player, idx) => {
        const isCurrent = idx === boardState.currentTurnIndex;
        const item = document.createElement('div');
        item.className = `player-item ${isCurrent ? 'active-turn' : ''}`;
        
        item.innerHTML = `
            <div class="player-info">
                <span class="player-badge" style="background:${player.color};">${player.animal}</span>
                <div>
                    <div><b>${player.name}</b> ${isCurrent ? '📌' : ''}</div>
                    ${isCurrent ? `<div class="player-timer-mini" id="active-player-timer">⏳ ${boardState.timer}s</div>` : ''}
                </div>
            </div>
            <b>امتیاز: ${player.score}</b>
        `;

        listContainer.appendChild(item);
    });
}

function setupDrawer() {
    const menuToggle = document.getElementById('menu-toggle');
    const drawer = document.getElementById('side-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const closeBtn = document.getElementById('drawer-close');

    function toggleDrawer() {
        drawer.classList.toggle('open');
        overlay.classList.toggle('active');
    }

    if (menuToggle) menuToggle.addEventListener('click', toggleDrawer);
    if (closeBtn) closeBtn.addEventListener('click', toggleDrawer);
    if (overlay) overlay.addEventListener('click', toggleDrawer);
}