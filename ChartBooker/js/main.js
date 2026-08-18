// 初始化
const profile = loadProfile();
document.getElementById('playerNameInput').value = profile.name || '';
document.getElementById('profileAvatar').src = profile.avatar || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23e5e7eb"/%3E%3Ctext x="32" y="40" text-anchor="middle" font-size="32"%3E👤%3C/text%3E%3C/svg%3E';

document.getElementById('avatarFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const avatarData = ev.target.result;
        document.getElementById('profileAvatar').src = avatarData;
        playerAvatar = avatarData;
        saveProfile(document.getElementById('playerNameInput').value, avatarData);
    };
    reader.readAsDataURL(file);
});

document.getElementById('playerNameInput').addEventListener('input', () => {
    playerName = document.getElementById('playerNameInput').value.trim() || '玩家';
    saveProfile(playerName, playerAvatar);
});

window.randomName = function() {
    const name = randomName();
    document.getElementById('playerNameInput').value = name;
    playerName = name;
    saveProfile(name, playerAvatar);
};

function getPlayerName() { return document.getElementById('playerNameInput').value.trim() || '玩家'; }

window.showCreateRoomUI = function() {
    playerName = getPlayerName();
    playerAvatar = document.getElementById('profileAvatar').src;
    showModal('createRoomModal');
};

window.confirmCreateRoom = function() {
    maxPlayers = parseInt(document.getElementById('maxPlayersSlider').value);
    gameMode = document.getElementById('gameModeSelect').value;
    turnTimeLimit = parseInt(document.getElementById('turnTimeSlider').value);
    const namesInput = document.getElementById('chartNamesInput').value.trim();
    chartNames = namesInput ? namesInput.split(',').map(s => s.trim()).filter(s => s) : [];
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    isHost = true;
    playerId = 'host_' + roomId;
    playersList = [{ id: playerId, name: playerName, avatar: playerAvatar, isHost: true, isAI: false, ready: true }];
    closeModal('createRoomModal');
    showModal('roomWaitingModal');
    updateRoomWaitingUI();
    initNetwork('host', roomId, {
        onReady: () => {
            document.getElementById('networkStatus').textContent = '联机：PeerJS 主机就绪';
        },
        onClientJoin: (clientPeerId) => {
            // 新客户端连接，等待其发送 join_request
        },
        onMessage: (data, fromPeerId) => {
            if (data.type === 'join_request') {
                if (playersList.length >= maxPlayers) {
                    sendToClient(fromPeerId, { type: 'join_denied', reason: '房间已满' });
                    return;
                }
                const newPlayer = { id: fromPeerId, name: data.name, avatar: data.avatar, isHost: false, isAI: false, ready: false };
                playersList.push(newPlayer);
                sendToClient(fromPeerId, { type: 'join_approved', playersList, maxPlayers, gameMode, turnTimeLimit, chartNames });
                broadcastToClients({ type: 'room_update', playersList });
                updateRoomWaitingUI();
            } else if (data.type === 'ready_update') {
                const p = playersList.find(p => p.id === data.playerId);
                if (p) p.ready = data.ready;
                broadcastToClients({ type: 'room_update', playersList });
                updateRoomWaitingUI();
            } else if (data.type === 'leave_room') {
                playersList = playersList.filter(p => p.id !== data.playerId);
                broadcastToClients({ type: 'room_update', playersList });
                updateRoomWaitingUI();
            } else if (data.type === 'play_basic') {
                handlePlayBasic(data.playerId, data);
            } else if (data.type === 'play_retreat') {
                handlePlayRetreat(data.playerId, data);
            } else if (data.type === 'play_explode') {
                handlePlayExplode(data.playerId, data);
            } else if (data.type === 'play_gift_lock') {
                handlePlayGiftLock(data.playerId, data);
            } else if (data.type === 'play_shine') {
                handlePlayShine(data.playerId, data);
            } else if (data.type === 'draw_card') {
                handleDrawCard(data.playerId);
            }
        },
        onClientLeave: (clientPeerId) => {
            playersList = playersList.filter(p => p.id !== clientPeerId);
            broadcastToClients({ type: 'room_update', playersList });
            updateRoomWaitingUI();
        }
    });
    document.getElementById('startGameBtn').classList.remove('hidden');
    document.getElementById('readyBtn').classList.add('hidden');
};

window.showJoinRoomUI = function() {
    playerName = getPlayerName();
    playerAvatar = document.getElementById('profileAvatar').src;
    showModal('joinRoomModal');
};

window.confirmJoinRoom = function() {
    const code = document.getElementById('joinRoomIdInput').value.trim();
    if (!code) { showCustomMessage('提示', '请输入房间号'); return; }
    playerId = 'player_' + Math.random().toString(36).substring(2, 10);
    closeModal('joinRoomModal');
    document.getElementById('readyBtn').classList.add('hidden');
    showModal('roomWaitingModal');
    document.getElementById('waitingRoomId').textContent = code;
    document.getElementById('waitingPlayerList').innerHTML = '<div class="text-xs text-gray-400">正在连接...</div>';
    initNetwork('client', code, {
        onReady: () => {
            document.getElementById('networkStatus').textContent = '联机：已连接到房间';
            sendToHost({ type: 'join_request', name: playerName, avatar: playerAvatar });
        },
        onMessage: (data) => {
            if (data.type === 'join_approved') {
                isHost = false;
                playersList = data.playersList;
                maxPlayers = data.maxPlayers;
                gameMode = data.gameMode;
                turnTimeLimit = data.turnTimeLimit;
                chartNames = data.chartNames || [];
                roomId = code;
                const readyBtn = document.getElementById('readyBtn');
                readyBtn.classList.remove('hidden');
                readyBtn.classList.add('fade-in');
                readyBtn.textContent = '准备';
                updateRoomWaitingUI();
            } else if (data.type === 'join_denied') {
                showCustomMessage('加入失败', data.reason);
                closeModal('roomWaitingModal');
            } else if (data.type === 'room_update') {
                playersList = data.playersList;
                updateRoomWaitingUI();
            } else if (data.type === 'game_start') {
                gameState = data.gameState;
                enterGameScreen();
            } else if (data.type === 'state_update') {
                updateGameStateForClient(data.gameState);
            } else if (data.type === 'game_over') {
                showWin(data.winner);
            }
        },
        onError: (err) => {
            showCustomMessage('连接失败', '无法连接到房间，请检查房间号');
            closeModal('roomWaitingModal');
        },
        onDisconnect: () => {
            showCustomMessage('连接断开', '与房主的连接已断开');
            closeModal('roomWaitingModal');
        }
    });
};

window.toggleReady = function() {
    isReady = !isReady;
    const me = playersList.find(p => p.id === playerId);
    if (me) me.ready = isReady;
    if (networkMode === 'client') sendToHost({ type: 'ready_update', playerId, ready: isReady });
    updateRoomWaitingUI();
};

window.leaveRoom = function() {
    if (networkMode === 'client') sendToHost({ type: 'leave_room', playerId });
    if (networkMode === 'host') destroyNetwork();
    closeModal('roomWaitingModal');
    location.reload();
};

window.hostStartGame = function() {
    if (playersList.length < 2 || !playersList.every(p => p.ready)) return;
    startDicePhase();
};

window.startSinglePlayer = function() {
    playerName = getPlayerName();
    playerAvatar = document.getElementById('profileAvatar').src;
    isHost = true;
    roomId = 'SOLO';
    playerId = 'human_player';
    maxPlayers = 4;
    gameMode = 'standard';
    turnTimeLimit = 60;
    playersList = [{ id: playerId, name: playerName, avatar: playerAvatar, isHost: true, isAI: false, ready: true }];
    for (let i = 0; i < 3; i++) {
        playersList.push({ id: 'ai_' + i, name: AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)] + (i + 1), avatar: '', isHost: false, isAI: true, ready: true });
    }
    const deck = createDeck();
    const chartCount = playersList.length - 1;
    const charts = generateChart(chartCount);
    const hands = {};
    playersList.forEach(p => { hands[p.id] = []; for (let i = 0; i < 7; i++) { if (deck.length === 0) deck = createDeck(); hands[p.id].push(deck.pop()); } });
    gameState = {
        roomId, players: playersList, deck, charts,
        currentTurn: shuffle(playersList.map(p => p.id))[0],
        turnOrder: playersList.map(p => p.id),
        hands, round: 1, status: 'playing', winners: [],
        alivePlayers: playersList.map(p => p.id), eliminated: [],
        direction: 1, maxPlayers: playersList.length, gameMode,
        turnTimeLimit: 60, isDebug: true, discardPile: [], wastePools: {},
        frozenPlayers: {}, turnCount: 0
    };
    enterGameScreen();
};

function enterGameScreen() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('createRoomModal').classList.add('hidden');
    document.getElementById('joinRoomModal').classList.add('hidden');
    document.getElementById('roomWaitingModal').classList.add('hidden');
    document.getElementById('gameBoard').classList.remove('hidden');
    updateGameStateForClient(gameState);
    startTurnTimerIfNeeded();
    if (gameState.isDebug) startAILoopIfNeeded();
}

function startTurnTimerIfNeeded() {
    clearInterval(timerInterval);
    if (!gameState || gameState.status !== 'playing') return;
    gameState.turnTimeRemaining = gameState.turnTimeRemaining || gameState.turnTimeLimit;
    updateTimerDisplay();
    if (currentTurnId === playerId) {
        timerInterval = setInterval(() => {
            if (gameState.status !== 'playing' || currentTurnId !== playerId) { clearInterval(timerInterval); return; }
            gameState.turnTimeRemaining--;
            updateTimerDisplay();
            if (gameState.turnTimeRemaining <= 0) { clearInterval(timerInterval); drawCardAction(true); }
        }, 1000);
    }
}

function startAILoopIfNeeded() {
    if (!gameState || !gameState.isDebug || gameState.status !== 'playing') return;
    if (currentTurnId === playerId) return;
    const currentPlayer = gameState.players.find(p => p.id === currentTurnId);
    if (!currentPlayer || !currentPlayer.isAI) return;
    const delay = 3000 + Math.random() * 12000;
    clearTimeout(aiTimeout);
    aiTimeout = setTimeout(() => {
        if (gameState.status !== 'playing' || currentTurnId !== currentPlayer.id) return;
        executeAITurn(currentPlayer.id);
    }, delay);
}

window.onCardClick = function(index) {
    if (!gameState || gameState.status !== 'playing') return;
    if (currentTurnId !== playerId) { showCustomMessage('提示', '还没轮到你'); return; }
    const card = myHand[index];
    if (!card) return;
    if (gameState.frozenPlayers[playerId] > 0) {
        showCustomMessage('❄️ 冻结', '你被冻结，本回合跳过！');
        gameState.frozenPlayers[playerId] = 0;
        advanceTurn();
        syncState();
        return;
    }
    if (card.type === 'basic') {
        if (selectedChartId === null) { showCustomMessage('提示', '请先点击一个曲目'); return; }
        const chart = gameState.charts.find(c => c.id === selectedChartId && !c.completed && !c.damaged);
        if (!chart) { showCustomMessage('提示', '曲目不可用'); selectedChartId = null; renderCharts(); return; }
        const req = chart.requirements.find(r => !r.filled && r.basicType === card.basicType);
        if (!req) {
            const el = document.querySelectorAll('#playerHand .game-card')[index];
            if (el) { el.style.animation = 'shake .3s ease'; setTimeout(() => el.style.animation = '', 400); }
            showCustomMessage('提示', '此牌类型不符合任何需求');
            return;
        }
        const action = { type: 'play_basic', cardIndex: index, chartId: selectedChartId, reqIndex: chart.requirements.indexOf(req) };
        if (isHost) handlePlayBasic(playerId, action);
        else if (networkMode === 'client') sendToHost({ ...action, playerId });
        selectedChartId = null;
    } else if (card.type === 'skill') {
        if (card.skillType === 'retreat') {
            if (selectedChartId === null) { showCustomMessage('提示', '请先点击一个曲目'); return; }
            const chart = gameState.charts.find(c => c.id === selectedChartId && !c.completed && !c.damaged);
            if (!chart || !chart.requirements.some(r => r.filled)) { showCustomMessage('提示', '该曲目无可退回需求'); return; }
            const reqIndex = chart.requirements.findIndex(r => r.filled);
            const action = { type: 'play_retreat', cardIndex: index, chartId: selectedChartId, reqIndex };
            if (isHost) handlePlayRetreat(playerId, action);
            else if (networkMode === 'client') sendToHost({ ...action, playerId });
            selectedChartId = null;
        } else if (card.skillType === 'explode') {
            if (selectedChartId === null) { showCustomMessage('提示', '请先点击一个曲目'); return; }
            const chart = gameState.charts.find(c => c.id === selectedChartId && !c.completed && !c.damaged);
            if (!chart) { showCustomMessage('提示', '曲目不可用'); return; }
            const action = { type: 'play_explode', cardIndex: index, chartId: selectedChartId };
            if (isHost) handlePlayExplode(playerId, action);
            else if (networkMode === 'client') sendToHost({ ...action, playerId });
            selectedChartId = null;
        } else if (card.skillType === 'gift' || card.skillType === 'lock') {
            showPlayerSelector(card.skillType, index);
            return;
        } else if (card.skillType === 'shine') {
            const action = { type: 'play_shine', cardIndex: index };
            if (isHost) handlePlayShine(playerId, action);
            else if (networkMode === 'client') sendToHost({ ...action, playerId });
        }
        addScanEffect();
    }
};

function showPlayerSelector(skillType, cardIndex) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '400';
    modal.innerHTML = `<div class="modal-content"><h2>选择目标玩家</h2><div id="playerTargetList" class="space-y-2"></div>
        <div class="flex justify-end mt-4"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button></div></div>`;
    document.body.appendChild(modal);
    const listDiv = modal.querySelector('#playerTargetList');
    gameState.alivePlayers.forEach(pid => {
        if (pid === playerId) return;
        const p = gameState.players.find(p => p.id === pid);
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline w-full justify-between';
        btn.textContent = `${p.name} (${p.isAI ? 'AI' : '玩家'})`;
        btn.onclick = () => {
            modal.remove();
            const action = { type: 'play_gift_lock', cardIndex, skillType, targetPlayerId: pid };
            if (isHost) handlePlayGiftLock(playerId, action);
            else if (networkMode === 'client') sendToHost({ ...action, playerId });
        };
        listDiv.appendChild(btn);
    });
}

window.drawCardAction = function(auto = false) {
    if (!gameState || gameState.status !== 'playing') return;
    if (currentTurnId !== playerId && !auto) { showCustomMessage('提示', '还没轮到你'); return; }
    if (!auto && gameState.frozenPlayers[playerId] > 0) {
        showCustomMessage('❄️ 冻结', '你被冻结，跳过回合');
        gameState.frozenPlayers[playerId] = 0;
        advanceTurn();
        syncState();
        return;
    }
    const action = { type: 'draw_card' };
    if (isHost) handleDrawCard(playerId);
    else if (networkMode === 'client') sendToHost({ ...action, playerId });
    addScanEffect();
};

// 骰子阶段
function startDicePhase() {
    dicePhase = true;
    diceResults = {};
    const activePlayers = playersList.filter(p => p.ready);
    showModal('diceModal');
    document.getElementById('diceInfo').textContent = '掷骰子中...';
    document.getElementById('diceResults').innerHTML = '';
    let delay = 0;
    activePlayers.forEach(p => {
        setTimeout(() => {
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            diceResults[p.id] = { d1, d2, sum: d1 + d2 };
            renderDiceResults();
        }, delay);
        delay += 800;
    });
    setTimeout(() => {
        const activeIds = activePlayers.map(p => p.id);
        const maxSum = Math.max(...activeIds.map(id => diceResults[id].sum));
        const winners = activeIds.filter(id => diceResults[id].sum === maxSum);
        if (winners.length > 1) {
            document.getElementById('diceInfo').textContent = `平局！${winners.map(id => playersList.find(p => p.id === id).name).join('、')} 重赛`;
            const tiePlayers = winners.map(id => playersList.find(p => p.id === id));
            tiePlayers.forEach(p => diceResults[p.id] = null);
            tiePlayers.forEach(p => {
                setTimeout(() => {
                    const d1 = Math.floor(Math.random() * 6) + 1;
                    const d2 = Math.floor(Math.random() * 6) + 1;
                    diceResults[p.id] = { d1, d2, sum: d1 + d2 };
                    renderDiceResults();
                }, delay);
                delay += 800;
            });
            setTimeout(() => {
                const newWinners = tiePlayers.filter(p => diceResults[p.id].sum === Math.max(...tiePlayers.map(pp => diceResults[pp.id].sum)));
                finishDicePhase(newWinners);
            }, delay + 500);
        } else finishDicePhase(winners);
    }, delay + 1000);
}

function renderDiceResults() {
    const container = document.getElementById('diceResults');
    container.innerHTML = '';
    Object.keys(diceResults).forEach(id => {
        const res = diceResults[id];
        if (!res) return;
        const p = playersList.find(p => p.id === id);
        const div = document.createElement('div');
        div.className = 'flex flex-col items-center';
        div.innerHTML = `<div class="player-avatar" style="background:#3b82f6">${p.name[0]}</div>
            <div class="text-xs">${p.name}</div>
            <div class="dice-container"><div class="dice dice-animated">${res.d1}</div><div class="dice dice-animated">${res.d2}</div></div>
            <div class="text-sm font-bold">总和: ${res.sum}</div>`;
        container.appendChild(div);
    });
}

function finishDicePhase(winners) {
    dicePhase = false;
    closeModal('diceModal');
    const winnerId = winners[0].id;
    const readyIds = playersList.filter(p => p.ready).map(p => p.id);
    const startIndex = readyIds.indexOf(winnerId);
    const orderedIds = [];
    for (let i = 0; i < readyIds.length; i++) orderedIds.push(readyIds[(startIndex + i) % readyIds.length]);
    const deck = createDeck();
    const chartCount = readyIds.length - 1;
    const charts = generateChart(chartCount);
    const hands = {};
    readyIds.forEach(id => { hands[id] = []; for (let i = 0; i < 7; i++) { if (deck.length === 0) deck = createDeck(); hands[id].push(deck.pop()); } });
    gameState = {
        roomId, players: playersList, deck, charts,
        currentTurn: orderedIds[0], turnOrder: orderedIds,
        hands, round: 1, status: 'playing', winners: [],
        alivePlayers: readyIds.slice(), eliminated: [],
        direction: 1, maxPlayers, gameMode, turnTimeLimit,
        isDebug: false, discardPile: [], wastePools: {},
        frozenPlayers: {}, turnCount: 0
    };
    if (networkMode === 'host') broadcastToClients({ type: 'game_start', gameState });
    enterGameScreen();
}

window.continueDiceGame = function() {};

// 全局点击扫屏
document.addEventListener('click', addScanEffect);
document.getElementById('maxPlayersSlider').addEventListener('input', e => document.getElementById('maxPlayersValue').textContent = e.target.value);
document.getElementById('turnTimeSlider').addEventListener('input', e => document.getElementById('turnTimeValue').textContent = e.target.value);
window.addEventListener('resize', () => { if (gameState) renderPlayers(); });
