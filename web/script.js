/* ==========================================
    DotVerse - Production Game Logic (script.js)
    ========================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDt-Yzy6S9VK3ucd-sVM9nTtfahcotFncc",
    authDomain: "dotverse-9850e.firebaseapp.com",
    databaseURL: "https://dotverse-9850e-default-rtdb.firebaseio.com",
    projectId: "dotverse-9850e",
    storageBucket: "dotverse-9850e.firebasestorage.app",
    messagingSenderId: "539684224862",
    appId: "1:539684224862:web:8aa2f7b4de430b9e4ad9cf"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'default_room';
const roomRef = ref(db, 'rooms/' + roomId);

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

let gridSize = 6;
let isCreator = false; 
const maxPlayersLimit = 20;

let boardState = {
    size: 6,
    lines: {},
    squares: [],
    players: [], 
    currentTurnIndex: 0,
    timerSetting: 300, 
    timer: 300,
    timerInterval: null,
    gameStarted: false,
    settingsOpened: false
};

onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        boardState = data;
        gridSize = boardState.size || 6;
        updateUI();
        renderBoard();
        
        const welcomeOverlay = document.getElementById('welcome-overlay');
        const settingsOverlay = document.getElementById('settings-overlay');

        if (boardState.gameStarted) {
            if (welcomeOverlay) welcomeOverlay.classList.add('hidden');
            if (settingsOverlay) settingsOverlay.classList.add('hidden');
        } else if (boardState.settingsOpened) {
            if (welcomeOverlay) welcomeOverlay.classList.add('hidden');
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const welcomeOverlay = document.getElementById('welcome-overlay');
    const settingsOverlay = document.getElementById('settings-overlay');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const adminFinishJoinBtn = document.getElementById('admin-finish-join-btn');
    const gridSizeSelect = document.getElementById('grid-size-select');
    const timerModeSelect = document.getElementById('timer-mode-select');
    const adminStartBtn = document.getElementById('admin-start-btn');

    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }

    function getTelegramUser() {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            const u = window.Telegram.WebApp.initDataUnsafe.user;
            return {
                id: u.id,
                name: (u.first_name || '') + (u.last_name ? ' ' + u.last_name : '') || 'کاربر تلگرام'
            };
        }
        let storedId = localStorage.getItem('dotverse_user_id');
        if (!storedId) {
            storedId = Math.floor(Math.random() * 1000000);
            localStorage.setItem('dotverse_user_id', storedId);
        } else {
            storedId = parseInt(storedId);
        }
        return {
            id: storedId,
            name: `کاربر_${storedId.toString().slice(-4)}`
        };
    }

    function updateGridOptionsBasedOnPlayers() {
        if (!gridSizeSelect) return;
        const count = boardState.players.length;
        let options = [];

        if (count >= 1 && count <= 4) {
            options = [6, 8, 10, 12];
        } else if (count >= 5 && count <= 8) {
            options = [8, 10, 12, 14];
        } else if (count >= 9 && count <= 12) {
            options = [10, 12, 14, 16];
        } else if (count >= 13 && count <= 16) {
            options = [12, 14, 16, 18];
        } else {
            options = [14, 16, 18, 20];
        }

        gridSizeSelect.innerHTML = '';
        options.forEach((size, idx) => {
            const opt = document.createElement('option');
            opt.value = size;
            opt.textContent = `${size} در ${size}`;
            if (idx === 0) opt.selected = true;
            gridSizeSelect.appendChild(opt);
        });

        gridSize = options[0];
        boardState.size = gridSize;
    }

    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', () => {
            const user = getTelegramUser();
            isCreator = true;

            if (boardState.players.some(p => p.id === user.id)) {
                alert('شما قبلاً وارد بازی شده‌اید!');
                return;
            }

            boardState.players.push({
                id: user.id,
                name: user.name + " (سازنده)",
                color: PLAYER_COLORS[0],
                animal: PLAYER_ANIMALS[0],
                score: 0
            });

            if (welcomeOverlay) welcomeOverlay.classList.add('hidden');
            if (adminFinishJoinBtn) adminFinishJoinBtn.style.display = 'block';

            set(roomRef, boardState);
            updateUI();
            alert('اتاق ساخته شد! لینک دعوت را برای دوستانتان بفرستید تا وارد شوند.');
        });
    }

    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', () => {
            if (boardState.gameStarted || boardState.settingsOpened) {
                alert('عضوگیری این بازی بسته شده است!');
                return;
            }
            if (boardState.players.length >= maxPlayersLimit) {
                alert('ظرفیت اتاق تکمیل است!');
                return;
            }

            const user = getTelegramUser();

            if (boardState.players.some(p => p.id === user.id)) {
                alert('شما قبلاً به این بازی ملحق شده‌اید!');
                return;
            }

            boardState.players.push({
                id: user.id,
                name: user.name,
                score: 0,
                color: PLAYER_COLORS[boardState.players.length % PLAYER_COLORS.length],
                animal: PLAYER_ANIMALS[boardState.players.length % PLAYER_ANIMALS.length]
            });

            if (welcomeOverlay) welcomeOverlay.classList.add('hidden');

            set(roomRef, boardState);
            updateUI();
            alert('با موفقیت به بازی ملحق شدید! منتظر شروع بازی توسط سازنده باشید.');
        });
    }

    // دکمه اتمام عضوگیری توسط سازنده
    if (adminFinishJoinBtn) {
        adminFinishJoinBtn.addEventListener('click', () => {
            if (boardState.players.length === 0) {
                alert('هیچ بازیکنی در بازی حضور ندارد!');
                return;
            }
            boardState.settingsOpened = true;
            updateGridOptionsBasedOnPlayers();
            if (settingsOverlay) settingsOverlay.classList.remove('hidden');
            set(roomRef, boardState);
        });
    }

    if (timerModeSelect) {
        timerModeSelect.addEventListener('change', () => {
            const val = timerModeSelect.value;
            if (val === "none") {
                boardState.timerSetting = "none";
            } else {
                boardState.timerSetting = parseInt(val) * 60; // تبدیل دقیقه به ثانیه
            }
        });
    }

    if (adminStartBtn) {
        adminStartBtn.addEventListener('click', () => {
            if (gridSizeSelect) {
                gridSize = parseInt(gridSizeSelect.value);
                boardState.size = gridSize;
            }

            boardState.gameStarted = true;
            if (settingsOverlay) settingsOverlay.classList.add('hidden');
            
            set(roomRef, boardState);
            updateUI();
            renderBoard();
            startTimer();
        });
    }

    setupDrawer();
    window.addEventListener('resize', renderBoard);
});

function removePlayer(playerId) {
    if (!isCreator || boardState.gameStarted || boardState.settingsOpened) return;
    boardState.players = boardState.players.filter(p => p.id !== playerId);
    set(roomRef, boardState);
    updateUI();
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
    if (!boardState.gameStarted) return;
    if (boardState.lines[lineId]) return;
    if (boardState.players.length === 0) return;

    let currentUserId;
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
        currentUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
    } else {
        currentUserId = parseInt(localStorage.getItem('dotverse_user_id'));
    }

    const currentPlayer = boardState.players[boardState.currentTurnIndex];
    if (currentPlayer.id !== currentUserId) {
        alert('نوبت شما نیست!');
        return;
    }

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

    set(roomRef, boardState);
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

    if (boardState.timerSetting === "none") {
        const timerEl = document.getElementById('floating-timer');
        if (timerEl) timerEl.textContent = "⏳ زمان: نامحدود";
        return;
    }

    boardState.timer = boardState.timerSetting;
    updateTimerUI();

    boardState.timerInterval = setInterval(() => {
        boardState.timer--;
        updateTimerUI();

        if (boardState.timer <= 0) {
            nextTurn();
            set(roomRef, boardState);
        }
    }, 1000);
}

function resetTimer() {
    startTimer();
}

function updateTimerUI() {
    const timerEl = document.getElementById('floating-timer');
    if (timerEl) {
        if (boardState.timerSetting === "none") {
            timerEl.textContent = "⏳ زمان: نامحدود";
            timerEl.classList.remove('warning');
        } else {
            const mins = Math.floor(boardState.timer / 60);
            const secs = boardState.timer % 60;
            timerEl.textContent = `⏳ زمان: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
            if (boardState.timer <= 10) {
                timerEl.classList.add('warning');
            } else {
                timerEl.classList.remove('warning');
            }
        }
    }
}

function nextTurn() {
    if (boardState.players.length === 0) return;
    boardState.currentTurnIndex = (boardState.currentTurnIndex + 1) % boardState.players.length;
    updateUI();
    resetTimer();
}

function updateUI() {
    const banner = document.getElementById('turn-banner');
    if (boardState.gameStarted && boardState.players.length > 0) {
        const currentPlayer = boardState.players[boardState.currentTurnIndex];
        if (banner) {
            banner.innerHTML = `نوبت بازی: <span style="color:${currentPlayer.color}; font-weight:900;">${currentPlayer.animal} ${currentPlayer.name}</span>`;
        }
    } else {
        if (banner) banner.textContent = "در انتظار شروع بازی و عضوگیری...";
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
        
        let deleteBtnHtml = '';
        if (isCreator && !boardState.gameStarted && !boardState.settingsOpened) {
            deleteBtnHtml = `<button class="remove-player-btn" onclick="removePlayer(${player.id})" title="حذف بازیکن" style="background:none; border:none; color:#ef4444; font-size:16px; cursor:pointer; margin-right:8px;">❌</button>`;
        }

        item.innerHTML = `
            <div class="player-info" style="display:flex; align-items:center; gap:8px;">
                <span class="player-badge" style="background:${player.color}; padding:4px 8px; border-radius:4px;">${player.animal}</span>
                <div>
                    <div><b>${player.name}</b> ${isCurrent && boardState.gameStarted ? '📌' : ''}</div>
                </div>
            </div>
            <div style="display:flex; align-items:center;">
                <b style="margin-left:8px;">امتیاز: ${player.score}</b>
                ${deleteBtnHtml}
            </div>
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

window.removePlayer = removePlayer;