// UI渲染模块

function updateGameStateForClient(state) {
    gameState = state;
    if (!gameState) return;
    const me = gameState.players.find(p => p.id === playerId);
    myHand = me ? gameState.hands[playerId] || [] : [];
    charts = gameState.charts;
    currentTurnId = gameState.currentTurn;
    playersList = gameState.players;
    selectedChartId = null;
    selectedPlayerId = null;
    renderCharts();
    renderPlayers();
    renderHand();
    renderDiscardPile();
    renderWastePool();
    updateTurnLabel();
    updateStatus();
    updateTimerDisplay();
    updatePointerArrow();
}

function renderCharts() {
    const container = document.getElementById('chartArea');
    container.innerHTML = '';
    if (!charts) return;
    charts.forEach(chart => {
        const div = document.createElement('div');
        div.className = `chart-card ${chart.completed ? 'completed' : ''} ${chart.damaged ? 'damaged' : ''} ${selectedChartId === chart.id ? 'highlight' : ''}`;
        let reqHtml = '';
        chart.requirements.forEach(req => {
            const def = BASIC_CARD_DEFS[req.basicType];
            const pct = Math.min(100, (req.currentTotal / req.requiredTotal) * 100);
            reqHtml += `<div style="display:inline-block;margin:3px;text-align:center;">
                <div class="req-slot ${req.filled ? 'filled' : ''}">
                    <span class="req-icon">${def.icon}</span>
                    <span class="req-value">${req.currentTotal}/${req.requiredTotal}</span>
                </div>
                <div style="width:100%;height:4px;background:#e5e7eb;border-radius:2px;margin-top:2px;">
                    <div style="width:${pct}%;height:100%;background:${req.filled ? '#22c55e' : '#3b82f6'};border-radius:2px;transition:width .2s;"></div>
                </div>
            </div>`;
        });
        let statusHtml = '';
        if (chart.completed) {
            const owner = gameState.players.find(p => p.id === chart.completedBy);
            statusHtml = `<div class="text-xs text-green-600 font-bold">✅ 完成者：${owner ? owner.name : '未知'}</div>`;
        } else if (chart.damaged) {
            statusHtml = `<div class="repair-indicator">🔗 损坏 剩余${chart.damageTurnsLeft}轮</div>`;
        }
        div.innerHTML = `<div class="text-xs font-semibold text-gray-700 mb-1">${chart.name}</div>
            <div style="display:flex;flex-wrap:wrap;justify-content:center;">${reqHtml}</div>${statusHtml}`;
        if (!chart.completed && !chart.damaged) {
            div.onclick = () => {
                if (currentTurnId === playerId && gameState.status === 'playing') {
                    selectedChartId = chart.id;
                    renderCharts();
                    renderHand();
                    updateStatus();
                }
            };
        }
        container.appendChild(div);
    });
}

function renderPlayers() {
    const container = document.getElementById('otherPlayers');
    container.innerHTML = '';
    if (!playersList) return;
    const others = playersList.filter(p => p.id !== playerId);
    const isMobile = window.innerWidth <= 768;
    const positions = isMobile ? [] : [
        'top:50px;left:50%;transform:translateX(-50%);',
        'top:50%;left:20px;transform:translateY(-50%);',
        'top:50%;right:20px;left:auto;transform:translateY(-50%);',
        'top:100px;left:80px;',
        'top:100px;right:80px;left:auto;',
        'bottom:150px;left:80px;',
        'bottom:150px;right:80px;left:80px;',
        'bottom:50px;left:50%;transform:translateX(-50%);'
    ];

    others.forEach((p, idx) => {
        const isActive = p.id === currentTurnId;
        const handCount = gameState ? (gameState.hands[p.id]?.length || 0) : 0;
        const isFrozen = gameState.frozenPlayers[p.id] > 0;
        const isEliminated = gameState.eliminated.includes(p.id);

        const div = document.createElement('div');
        div.className = `player-area ${isActive ? 'active-player' : ''} ${isEliminated ? 'eliminated' : ''}`;
        if (!isMobile) div.style.cssText = positions[idx % positions.length];

        const avatarHtml = p.avatar ? `<img src="${p.avatar}" alt="">` : p.name[0];

        // 修复：渲染对手手牌背面
        const maxShow = Math.min(handCount, 5);
        const cardBacksHtml = Array(maxShow).fill(0)
            .map(() => '<div class="card-back-small"></div>')
            .join('');

        div.innerHTML = `
            <div class="player-info">
                <div class="player-avatar" style="background:${p.isHost ? '#3b82f6' : (p.isAI ? '#f59e0b' : '#9ca3af')};">${avatarHtml}</div>
                <span class="${isActive ? 'active-player-text' : ''}">${p.name} (${handCount}张)${isFrozen ? ' ❄️' : ''}</span>
            </div>
            ${isEliminated ? '' : `<div class="player-cards-back">${cardBacksHtml}</div>`}
        `;
        container.appendChild(div);

        if (isActive && !isEliminated) {
            const arrow = document.getElementById('pointerArrow');
            arrow.classList.remove('hidden');
            const rect = div.getBoundingClientRect();
            const gameRect = document.getElementById('gameBoard').getBoundingClientRect();
            arrow.style.left = (rect.left - gameRect.left + rect.width / 2 - 12) + 'px';
            arrow.style.top = (rect.top - gameRect.top - 25) + 'px';
        }
    });

    if (currentTurnId === playerId && !gameState.eliminated.includes(playerId)) {
        const arrow = document.getElementById('pointerArrow');
        arrow.classList.remove('hidden');
        const handRect = document.getElementById('playerHand').getBoundingClientRect();
        const gameRect = document.getElementById('gameBoard').getBoundingClientRect();
        arrow.style.left = (handRect.left - gameRect.left + handRect.width / 2 - 12) + 'px';
        arrow.style.top = (handRect.top - gameRect.top - 25) + 'px';
    }
}

function renderHand() {
    const hand = document.getElementById('playerHand');
    hand.innerHTML = '';
    if (!myHand || gameState.eliminated.includes(playerId)) return;
    myHand.forEach((card, index) => {
        const el = createCardElement(card);
        el.style.marginLeft = index === 0 ? '0' : '-12px';
        el.onclick = () => onCardClick(index);
        hand.appendChild(el);
    });
    updateCardAvailability();
}

function createCardElement(card) {
    const div = document.createElement('div');
    if (card.type === 'basic') {
        const def = BASIC_CARD_DEFS[card.basicType];
        div.className = `game-card ${def.colorClass}`;
        div.innerHTML = `<div class="icon">${def.icon}</div><div class="card-name">${def.name}</div><div class="card-value">${card.value}</div>`;
    } else {
        const def = SKILL_DEFS[card.skillType];
        div.className = 'game-card type-skill';
        div.innerHTML = `<div class="icon">${def.icon}</div><div class="card-name">${def.name}</div><div class="card-value" style="font-size:14px;">${def.name}</div>`;
    }
    return div;
}

function updateCardAvailability() {
    if (currentTurnId !== playerId || !gameState || gameState.status !== 'playing') {
        document.querySelectorAll('#playerHand .game-card').forEach(el => el.classList.add('unavailable'));
        return;
    }
    const cards = document.querySelectorAll('#playerHand .game-card');
    myHand.forEach((card, idx) => {
        const el = cards[idx];
        if (!el) return;
        if (card.type === 'basic') {
            const chart = selectedChartId !== null ? gameState.charts.find(c => c.id === selectedChartId) : null;
            const canUse = chart && !chart.completed && !chart.damaged &&
                chart.requirements.some(r => !r.filled && r.basicType === card.basicType);
            el.classList.toggle('available', canUse);
            el.classList.toggle('unavailable', !canUse);
        } else {
            let canUse = true;
            if (card.skillType === 'retreat') {
                const chart = selectedChartId !== null ? gameState.charts.find(c => c.id === selectedChartId) : null;
                canUse = chart && !chart.completed && chart.requirements.some(r => r.filled);
            } else if (card.skillType === 'explode') {
                const chart = selectedChartId !== null ? gameState.charts.find(c => c.id === selectedChartId) : null;
                canUse = chart && !chart.completed && !chart.damaged;
            } else if (card.skillType === 'gift' || card.skillType === 'lock') {
                canUse = playersList.some(p => p.id !== playerId && gameState.alivePlayers.includes(p.id));
            }
            el.classList.toggle('available', canUse);
            el.classList.toggle('unavailable', !canUse);
        }
    });
}

function renderDiscardPile() {
    const container = document.getElementById('discardPile');
    container.innerHTML = '';
    if (!gameState || !gameState.discardPile) return;
    gameState.discardPile.slice(-3).forEach(card => {
        const div = document.createElement('div');
        div.className = 'discard-card';
        div.style.transform = `rotate(${(Math.random() * 8 - 4).toFixed(1)}deg)`;
        if (card.type === 'basic') {
            const def = BASIC_CARD_DEFS[card.basicType];
            div.innerHTML = `<div class="icon">${def.icon}</div><div class="val">${card.value}</div>`;
        } else {
            const def = SKILL_DEFS[card.skillType];
            div.innerHTML = `<div class="icon">${def.icon}</div><div class="val">${def.name}</div>`;
        }
        if (card.playerId) {
            const p = gameState.players.find(p => p.id === card.playerId);
            const label = document.createElement('div');
            label.className = 'owner-label';
            label.textContent = p ? p.name : '?';
            div.appendChild(label);
        }
        container.appendChild(div);
    });
}

function renderWastePool() {
    const container = document.getElementById('playerWastePool');
    container.innerHTML = '';
    if (!gameState || !gameState.wastePools || !gameState.wastePools[playerId]) return;
    gameState.wastePools[playerId].slice(-3).forEach(card => {
        const div = document.createElement('div');
        div.className = 'waste-card';
        div.style.transform = `rotate(${(Math.random() * 6 - 3).toFixed(1)}deg)`;
        if (card.type === 'basic') {
            const def = BASIC_CARD_DEFS[card.basicType];
            div.textContent = `${def.icon}${card.value}`;
        } else {
            div.textContent = SKILL_DEFS[card.skillType].icon;
        }
        container.appendChild(div);
    });
}

function updateTurnLabel() {
    if (!gameState) return;
    const current = gameState.players.find(p => p.id === currentTurnId);
    document.getElementById('currentPlayer').textContent = current ? current.name : '等待';
    document.getElementById('currentPlayer').className = currentTurnId === playerId ? 'active-player-text' : '';
    document.getElementById('roomLabel').textContent = `房间 ${gameState.roomId} ${isHost ? '(房主)' : ''}`;
}

function updateStatus() {
    const el = document.getElementById('statusMsg');
    if (!gameState) return;
    if (gameState.status === 'playing') {
        el.textContent = currentTurnId === playerId ? '轮到你！选择曲目后出牌' : `等待 ${gameState.players.find(p => p.id === currentTurnId)?.name} 行动...`;
    } else if (gameState.status === 'round_end') {
        el.textContent = '回合结束...';
    } else if (gameState.status === 'game_over') {
        el.textContent = '游戏结束！';
    }
}

function updateTimerDisplay() {
    const el = document.getElementById('timerDisplay');
    if (gameState && gameState.status === 'playing' && currentTurnId === playerId) {
        el.textContent = `⏳ ${Math.ceil(gameState.turnTimeRemaining)}s`;
        el.style.color = gameState.turnTimeRemaining < 10 ? '#ef4444' : '#6b7280';
    } else {
        el.textContent = '';
    }
}

function updatePointerArrow() {
    const arrow = document.getElementById('pointerArrow');
    if (gameState && gameState.status === 'playing') {
        if (currentTurnId === playerId) {
            arrow.classList.remove('hidden');
            const rect = document.getElementById('playerHand').getBoundingClientRect();
            const gameRect = document.getElementById('gameBoard').getBoundingClientRect();
            arrow.style.left = (rect.left - gameRect.left + rect.width / 2 - 12) + 'px';
            arrow.style.top = (rect.top - gameRect.top - 25) + 'px';
        }
    } else {
        arrow.classList.add('hidden');
    }
}

function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function showCustomMessage(title, message) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '500';
    modal.innerHTML = `<div class="modal-content"><h2>${title}</h2><p class="text-gray-600 mb-4">${message}</p>
        <div class="flex justify-end"><button class="btn" onclick="this.closest('.modal-overlay').remove()">确定</button></div></div>`;
    document.body.appendChild(modal);
}

function addScanEffect() {
    const overlay = document.createElement('div');
    overlay.className = 'scan-overlay';
    document.getElementById('scanContainer').appendChild(overlay);
    setTimeout(() => overlay.remove(), 500);
}

function showTutorial() { showModal('tutorialModal'); }

function updateRoomWaitingUI() {
    document.getElementById('waitingRoomId').textContent = roomId;
    const listDiv = document.getElementById('waitingPlayerList');
    listDiv.innerHTML = '';
    playersList.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-list-item';
        const avatarHtml = p.avatar
            ? `<img src="${p.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`
            : p.name[0];
        item.innerHTML = `<div class="flex items-center gap-2">
            <div class="player-avatar" style="background:${p.isHost ? '#3b82f6' : (p.isAI ? '#f59e0b' : '#9ca3af')};overflow:hidden;">${avatarHtml}</div>
            <span>${p.name} ${p.isHost ? '(房主)' : ''} ${p.isAI ? '(AI)' : ''}</span></div>
            <span class="ready-badge ${p.ready ? 'ready' : ''}">${p.ready ? '已准备' : '未准备'}</span>`;
        if (p.id === playerId) item.style.background = '#f0f9ff';
        listDiv.appendChild(item);
    });
    document.getElementById('waitingSettings').textContent = `人数上限 ${maxPlayers} | 玩法 ${gameMode} | 回合限时 ${turnTimeLimit}秒`;
    if (isHost) {
        const allReady = playersList.every(p => p.ready);
        const btn = document.getElementById('startGameBtn');
        btn.disabled = !allReady || playersList.length < 2;
        btn.style.opacity = (!allReady || playersList.length < 2) ? '0.5' : '1';
        btn.textContent = playersList.length < 2 ? '至少2人' : (allReady ? '开始游戏' : '等待准备');
    }
}
