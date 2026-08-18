let isHost = false;
let playerId = null;
let playerName = '玩家';
let playerAvatar = '';
let playersList = [];
let maxPlayers = 4;
let gameMode = 'standard';
let turnTimeLimit = 60;
let chartNames = [];
let roomId = '';
let gameState = null;
let myHand = [];
let charts = [];
let currentTurnId = null;
let selectedChartId = null;
let selectedPlayerId = null;
let isReady = false;
let timerInterval = null;
let aiTimeout = null;
let diceOrder = [];
let diceResults = {};
let dicePhase = false;

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function createDeck() {
    let deck = [];
    Object.keys(BASIC_CARD_DEFS).forEach(type => {
        for (let val = 1; val <= 3; val++) {
            for (let i = 0; i < 3; i++) deck.push({ type: 'basic', basicType: type, value: val });
        }
    });
    SKILL_KEYS.forEach(skill => {
        for (let i = 0; i < 2; i++) deck.push({ type: 'skill', skillType: skill });
    });
    return shuffle(deck);
}

function generateChart(count) {
    let charts = [];
    for (let i = 0; i < count; i++) {
        let reqCount;
        if (gameMode === 'fast') reqCount = 2;
        else if (gameMode === 'hard') reqCount = 4;
        else reqCount = 2 + Math.floor(Math.random() * 2);
        const requirements = [];
        const usedTypes = new Set();
        while (requirements.length < reqCount) {
            const types = Object.keys(BASIC_CARD_DEFS);
            const type = types[Math.floor(Math.random() * types.length)];
            if (usedTypes.has(type)) continue;
            usedTypes.add(type);
            requirements.push({ basicType: type, requiredTotal: 3 + Math.floor(Math.random() * 4), currentTotal: 0, filled: false });
        }
        const name = chartNames[i] || `曲目 ${i + 1}`;
        charts.push({ id: i, name, requirements, completed: false, completedBy: null, damaged: false, damageTurnsLeft: 0 });
    }
    return charts;
}

function advanceTurn() {
    if (!gameState) return;
    const alive = gameState.alivePlayers.filter(id => !gameState.eliminated.includes(id));
    if (alive.length === 0) return;
    const idx = alive.indexOf(currentTurnId);
    currentTurnId = alive[(idx + 1) % alive.length];
    gameState.currentTurn = currentTurnId;
    gameState.charts.forEach(chart => {
        if (chart.damaged) {
            chart.damageTurnsLeft--;
            if (chart.damageTurnsLeft <= 0) chart.damaged = false;
        }
    });
    gameState.turnCount++;
    gameState.turnTimeRemaining = gameState.turnTimeLimit;
}

function checkRoundEnd() {
    const uncompleted = gameState.charts.filter(c => !c.completed);
    const aliveNotWinner = gameState.alivePlayers.filter(id => !gameState.winners.includes(id) && !gameState.eliminated.includes(id));
    if (uncompleted.length === 0 || aliveNotWinner.length === 0) {
        gameState.status = 'round_end';
        setTimeout(() => { if (isHost || gameState.isDebug) startNextRound(); }, 1000);
    }
    syncState();
}

function syncState() {
    if (networkMode === 'host') broadcastToClients({ type: 'state_update', gameState });
    updateGameStateForClient(gameState);
    startTurnTimerIfNeeded();
    if (gameState.isDebug) startAILoopIfNeeded();
}

function startNextRound() {
    const remaining = gameState.alivePlayers.filter(id => !gameState.winners.includes(id) && !gameState.eliminated.includes(id));
    gameState.eliminated = [...gameState.eliminated, ...remaining];
    gameState.alivePlayers = gameState.alivePlayers.filter(id => !gameState.eliminated.includes(id));
    if (gameState.alivePlayers.length <= 1) {
        gameState.status = 'game_over';
        const winner = gameState.alivePlayers[0] || gameState.winners[gameState.winners.length - 1];
        showWin(winner);
        return;
    }
    gameState.round++;
    gameState.winners = [];
    gameState.charts = generateChart(gameState.alivePlayers.length - 1);
    gameState.currentTurn = gameState.turnOrder[0] || gameState.alivePlayers[0];
    currentTurnId = gameState.currentTurn;
    gameState.alivePlayers.forEach(id => {
        while (gameState.hands[id].length < 7) {
            if (gameState.deck.length === 0) gameState.deck = createDeck();
            gameState.hands[id].push(gameState.deck.pop());
        }
    });
    gameState.status = 'playing';
    gameState.turnTimeRemaining = gameState.turnTimeLimit;
    syncState();
}

function showWin(winnerId) {
    const winner = playersList.find(p => p.id === winnerId);
    document.getElementById('winText').textContent = winner ? `${winner.name} 获胜！` : '游戏结束';
    document.getElementById('winModal').classList.remove('hidden');
}

function handlePlayBasic(pid, payload) {
    if (!gameState || gameState.status !== 'playing') return;
    if (pid !== currentTurnId) return;
    const hand = gameState.hands[pid];
    if (!hand || payload.cardIndex < 0 || payload.cardIndex >= hand.length) return;
    const card = hand[payload.cardIndex];
    if (card.type !== 'basic') return;
    const chart = gameState.charts.find(c => c.id === payload.chartId && !c.completed && !c.damaged);
    if (!chart) return;
    const req = chart.requirements[payload.reqIndex];
    if (!req || req.filled) return;
    if (req.basicType !== card.basicType) return;
    req.currentTotal += card.value;
    hand.splice(payload.cardIndex, 1);
    gameState.discardPile.push({ ...card, playerId: pid });
    if (req.currentTotal >= req.requiredTotal) req.filled = true;
    if (chart.requirements.every(r => r.filled)) {
        chart.completed = true;
        chart.completedBy = pid;
        if (!gameState.winners.includes(pid)) gameState.winners.push(pid);
        checkRoundEnd();
    }
    advanceTurn();
    syncState();
}

function handlePlayRetreat(pid, payload) {
    if (!gameState || gameState.status !== 'playing') return;
    if (pid !== currentTurnId) return;
    const hand = gameState.hands[pid];
    if (!hand || payload.cardIndex < 0 || payload.cardIndex >= hand.length) return;
    const card = hand[payload.cardIndex];
    if (card.type !== 'skill' || card.skillType !== 'retreat') return;
    const chart = gameState.charts.find(c => c.id === payload.chartId && !c.completed && !c.damaged);
    if (!chart) return;
    const req = chart.requirements[payload.reqIndex];
    if (!req || !req.filled) return;
    const returnedCard = { type: 'basic', basicType: req.basicType, value: Math.floor(req.currentTotal / 2) || 1 };
    req.currentTotal = 0;
    req.filled = false;
    hand.splice(payload.cardIndex, 1);
    gameState.discardPile.push({ ...card, playerId: pid });
    if (!gameState.wastePools[pid]) gameState.wastePools[pid] = [];
    gameState.wastePools[pid].push(returnedCard);
    advanceTurn();
    syncState();
}

function handlePlayExplode(pid, payload) {
    if (!gameState || gameState.status !== 'playing') return;
    if (pid !== currentTurnId) return;
    const hand = gameState.hands[pid];
    if (!hand || payload.cardIndex < 0 || payload.cardIndex >= hand.length) return;
    const card = hand[payload.cardIndex];
    if (card.type !== 'skill' || card.skillType !== 'explode') return;
    const chart = gameState.charts.find(c => c.id === payload.chartId && !c.completed && !c.damaged);
    if (!chart) return;
    chart.damaged = true;
    chart.damageTurnsLeft = 2;
    hand.splice(payload.cardIndex, 1);
    gameState.discardPile.push({ ...card, playerId: pid });
    advanceTurn();
    syncState();
}

function handlePlayGiftLock(pid, payload) {
    if (!gameState || gameState.status !== 'playing') return;
    if (pid !== currentTurnId) return;
    const hand = gameState.hands[pid];
    if (!hand || payload.cardIndex < 0 || payload.cardIndex >= hand.length) return;
    const card = hand[payload.cardIndex];
    if (card.type !== 'skill') return;
    if (card.skillType === 'gift') {
        const target = gameState.players.find(p => p.id === payload.targetPlayerId && p.id !== pid);
        if (!target) return;
        const targetHand = gameState.hands[target.id];
        const basicIdx = targetHand.findIndex(c => c.type === 'basic');
        if (basicIdx === -1) return;
        const stolenCard = targetHand.splice(basicIdx, 1)[0];
        hand.push(stolenCard);
        gameState.discardPile.push({ ...card, playerId: pid });
    } else if (card.skillType === 'lock') {
        const target = gameState.players.find(p => p.id === payload.targetPlayerId && p.id !== pid);
        if (!target) return;
        gameState.frozenPlayers[target.id] = 1;
        gameState.discardPile.push({ ...card, playerId: pid });
    }
    hand.splice(payload.cardIndex, 1);
    advanceTurn();
    syncState();
}

function handlePlayShine(pid, payload) {
    if (!gameState || gameState.status !== 'playing') return;
    if (pid !== currentTurnId) return;
    const hand = gameState.hands[pid];
    if (!hand || payload.cardIndex < 0 || payload.cardIndex >= hand.length) return;
    const card = hand[payload.cardIndex];
    if (card.type !== 'skill' || card.skillType !== 'shine') return;
    gameState.alivePlayers.forEach(id => {
        if (gameState.deck.length === 0) gameState.deck = createDeck();
        gameState.hands[id].push(gameState.deck.pop());
    });
    hand.splice(payload.cardIndex, 1);
    gameState.discardPile.push({ ...card, playerId: pid });
    advanceTurn();
    syncState();
}

function handleDrawCard(pid) {
    if (!gameState || gameState.status !== 'playing') return;
    if (pid !== currentTurnId) return;
    if (gameState.deck.length === 0) gameState.deck = createDeck();
    gameState.hands[pid].push(gameState.deck.pop());
    advanceTurn();
    syncState();
}

function executeAITurn(aiId) {
    const hand = gameState.hands[aiId];
    if (!hand) return;
    if (gameState.frozenPlayers[aiId] > 0) {
        gameState.frozenPlayers[aiId] = 0;
        advanceTurn();
        syncState();
        return;
    }
    const availableCharts = gameState.charts.filter(c => !c.completed && !c.damaged);
    let bestBasic = null;
    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        if (card.type !== 'basic') continue;
        for (const chart of availableCharts) {
            const req = chart.requirements.find(r => !r.filled && r.basicType === card.basicType);
            if (req) {
                if (!bestBasic || req.requiredTotal - req.currentTotal > bestBasic.priority) {
                    bestBasic = { cardIndex: i, chartId: chart.id, reqIndex: chart.requirements.indexOf(req), priority: req.requiredTotal - req.currentTotal };
                }
                break;
            }
        }
    }
    if (bestBasic) {
        handlePlayBasic(aiId, { cardIndex: bestBasic.cardIndex, chartId: bestBasic.chartId, reqIndex: bestBasic.reqIndex });
        return;
    }
    const skillIndex = hand.findIndex(c => c.type === 'skill');
    if (skillIndex !== -1) {
        const card = hand[skillIndex];
        if (card.skillType === 'retreat') {
            const chart = availableCharts.find(c => c.requirements.some(r => r.filled));
            if (chart) { handlePlayRetreat(aiId, { cardIndex: skillIndex, chartId: chart.id, reqIndex: chart.requirements.findIndex(r => r.filled) }); return; }
        } else if (card.skillType === 'explode') {
            if (availableCharts.length > 0) { handlePlayExplode(aiId, { cardIndex: skillIndex, chartId: availableCharts[0].id }); return; }
        } else if (card.skillType === 'shine') { handlePlayShine(aiId, { cardIndex: skillIndex }); return; }
        else if (card.skillType === 'gift' || card.skillType === 'lock') {
            const targets = gameState.alivePlayers.filter(id => id !== aiId);
            if (targets.length > 0) { handlePlayGiftLock(aiId, { cardIndex: skillIndex, skillType: card.skillType, targetPlayerId: targets[Math.floor(Math.random() * targets.length)] }); return; }
        }
    }
    handleDrawCard(aiId);
}
