// ==========================================
// MISSING ENGINE HELPERS & COMBAT
// ==========================================

function refreshStats() {
    document.getElementById('deck-count').innerText = DECK_ARR.length;
    document.getElementById('trash-count').innerText = TRASH_ARR.length;
    document.getElementById('don-deck-count').innerText = DON_DECK_COUNT;
    document.getElementById('life-count').innerText = document.getElementById('life-zone').children.length;
    if(TRASH_ARR.length > 0) document.getElementById('drop-trash').style.backgroundImage = `url('${TRASH_ARR[TRASH_ARR.length-1]}')`;
    else document.getElementById('drop-trash').style.backgroundImage = 'none';
}

function organizeDon() {
    const donZone = document.getElementById('don-zone');
    const dons = Array.from(document.querySelectorAll('#my-board .card[data-is-don="true"]')).filter(d => !d.dataset.parentId);
    dons.forEach((d, i) => {
        donZone.appendChild(d);
        d.style.position = 'relative';
        d.style.left = '0'; d.style.top = '0';
    });
}

function updateLifePositions() {
    const lifeZone = document.getElementById('life-zone');
    Array.from(lifeZone.children).forEach((c, i) => {
        c.style.position = 'absolute';
        c.style.top = (i * 10) + 'px';
        c.style.left = (i * 2) + 'px';
        c.style.zIndex = i;
    });
}

function moveToTrash(c) {
    TRASH_ARR.push(c.dataset.url);
    document.getElementById('drop-trash').style.backgroundImage = `url('${c.dataset.url}')`;
    c.remove();
    refreshStats();
}

function trashCard(c) {
    if(c.id.includes('opp-')) c.remove();
    else moveToTrash(c);
}

function updateBadges(parentId) {
    const p = document.getElementById(parentId);
    if(!p) return;
    const count = document.querySelectorAll(`[data-parent-id="${parentId}"]`).length;
    let b = p.querySelector('.don-badge');
    if(b) {
        if(count > 0) { b.innerText = count; b.style.display = 'flex'; }
        else { b.style.display = 'none'; }
    }
}

function simulateAttack() {
    hideMenu();
    if (!rightClickedCard) return;
    const att = rightClickedCard;
    att.classList.add('rested');
    
    document.body.classList.add('combat-target-mode');
    combatState = { active: true, attackerId: att.id, step: 'select_target' };
    
    document.querySelectorAll('#opp-char-zone-front .card, #opp-leader-zone .card').forEach(c => {
        if (c.parentElement.id === 'opp-leader-zone' || c.classList.contains('rested') || att.dataset.unblockable === "true") {
            c.classList.add('valid-attack-target');
        }
    });
    appendChat("Select a target to attack!", "#e74c3c");
    saveState();
}

window.addEventListener('mousedown', (e) => {
    if(combatState.step === 'select_target' && e.target.closest('.valid-attack-target')) {
        const target = e.target.closest('.card');
        document.querySelectorAll('.valid-attack-target').forEach(c => c.classList.remove('valid-attack-target'));
        document.body.classList.remove('combat-target-mode');
        
        combatState.defenderId = target.id;
        const att = document.getElementById(combatState.attackerId);
        
        let isUnblockable = (att.dataset.unblockable === "true");
        socket.emit('game_action', { 
            type: 'declare_attack', 
            attackerId: att.id, 
            defenderId: target.id,
            attackerPower: att.dataset.currentPower,
            unblockable: isUnblockable.toString()
        });
        openArena(att.id, target.id, "Waiting for Opponent...");
        combatState.step = 'wait_counter';
    }
    
    if(combatState.step === 'select_blocker' && e.target.closest('.valid-blocker')) {
        const target = e.target.closest('.card');
        document.querySelectorAll('.valid-blocker').forEach(c => c.classList.remove('valid-blocker'));
        document.body.classList.remove('blocker-target-mode');
        
        target.classList.add('rested');
        socket.emit('game_action', { type: 'block_declared', newDef: target.id });
        combatState.defenderId = target.id;
        openArena(combatState.attackerId, target.id, "You Blocked! Counter Phase...");
        askCounterPhase();
        saveState();
    }
});

function openArena(attId, defId, statusMsg) {
    const arena = document.getElementById('combat-arena');
    arena.style.display = 'flex';
    const att = document.getElementById(attId);
    const def = document.getElementById(defId);
    
    document.getElementById('arena-att-img').style.backgroundImage = att ? att.style.backgroundImage : 'none';
    document.getElementById('arena-att-pow').innerText = att ? (att.dataset.currentPower || 0) : 0;
    
    document.getElementById('arena-def-img').style.backgroundImage = def ? def.style.backgroundImage : 'none';
    document.getElementById('arena-def-pow').innerText = def ? (def.dataset.currentPower || 0) : 0;
    
    document.getElementById('arena-status').innerText = statusMsg;
    document.getElementById('arena-math').innerText = "";
}

function askCounterPhase() {
    combatState.step = 'counter';
    currentCounterTotal = 0;
    selectedCounterCards = [];
    document.getElementById('arena-status').innerText = "Counter Phase! Select cards from hand.";
    document.getElementById('counter-controls').style.display = 'flex';
    document.body.classList.add('counter-mode');
}

function updateArenaCounter(val) {
    const defBase = parseInt(document.getElementById('arena-def-pow').innerText.split('+')[0] || 0);
    document.getElementById('arena-def-pow').innerText = `${defBase} + ${val}`;
    document.getElementById('arena-math').innerText = `Total Defense: ${defBase + val}`;
}

function confirmCounter() {
    selectedCounterCards.forEach(c => { TRASH_ARR.push(c.dataset.url); c.remove(); });
    document.body.classList.remove('counter-mode');
    document.getElementById('counter-controls').style.display = 'none';
    const def = document.getElementById(combatState.defenderId);
    let finalPow = parseInt(def.dataset.currentPower || 0) + currentCounterTotal;
    socket.emit('game_action', { type: 'counter_declared', counterValue: currentCounterTotal, finalDefPower: finalPow });
    executeCombatResolution(currentCounterTotal, finalPow);
    refreshStats();
}

function takeHit() {
    document.body.classList.remove('counter-mode');
    document.getElementById('counter-controls').style.display = 'none';
    selectedCounterCards.forEach(c => c.style.outline = "");
    const def = document.getElementById(combatState.defenderId);
    socket.emit('game_action', { type: 'counter_declared', counterValue: 0, finalDefPower: parseInt(def.dataset.currentPower || 0) });
    executeCombatResolution(0, parseInt(def.dataset.currentPower || 0));
}

function executeCombatResolution(counterVal, finalDefPow) {
    const att = document.getElementById(combatState.attackerId);
    const def = document.getElementById(combatState.defenderId);
    if(!att || !def) { clearCombatState(); return; }
    
    let attPow = parseInt(att.dataset.currentPower || 0);
    document.getElementById('arena-status').innerText = (attPow >= finalDefPow) ? "ATTACK SUCCESS!" : "DEFENDED!";
    document.getElementById('arena-status').style.color = (attPow >= finalDefPow) ? "#e74c3c" : "#2ecc71";
    
    setTimeout(() => {
        if(attPow >= finalDefPow) {
            let isBanish = att.dataset.banish === "true";
            let isDouble = att.dataset.doubleAttack === "true";
            
            if(def.parentElement.id.includes('leader-zone')) {
                if(isMyTurn) socket.emit('game_action', {type: 'resolve_life', banish: isBanish, double: isDouble});
                else handleLifeDamage(isBanish, isDouble);
            } else {
                if(isMyTurn && !def.id.includes('opp-')) trashCard(def);
                else if(isMyTurn && def.id.includes('opp-')) socket.emit('game_action', {type: 'resolve_kill', target: def.id});
            }
        }
        setTimeout(() => { clearCombatState(); socket.emit('game_action', {type: 'clear_combat'}); saveState(); }, 1500);
    }, 1000);
}

function clearCombatState() {
    combatState = { active: false, attackerId: null, defenderId: null, step: null };
    document.getElementById('combat-arena').style.display = 'none';
    document.getElementById('counter-controls').style.display = 'none';
    document.body.classList.remove('counter-mode');
    document.body.classList.remove('blocker-target-mode');
    document.body.classList.remove('combat-target-mode');
    document.querySelectorAll('.valid-attack-target').forEach(c => c.classList.remove('valid-attack-target'));
    document.querySelectorAll('.valid-blocker').forEach(c => c.classList.remove('valid-blocker'));
}

function handleLifeDamage(isBanish, isDouble) {
    const lifeZone = document.getElementById('life-zone');
    if(lifeZone.children.length === 0) {
        socket.emit('game_action', {type: 'game_over'});
        showModal("YOU LOSE!", "alert", () => window.location.reload());
        return;
    }
    
    let dmg = isDouble ? 2 : 1;
    for(let i=0; i<dmg; i++) {
        if(lifeZone.children.length > 0) {
            const c = lifeZone.lastElementChild;
            if(isBanish) {
                moveToTrash(c);
                appendChat("Life Banished!", "#8e44ad");
            } else {
                toHand(c);
                const db = CARD_DB[c.dataset.url];
                if(db && db.hasTrigger) {
                    showModal(`TRIGGER available: ${db.name}. Reveal and use?`, "confirm", () => {
                        socket.emit('game_action', {type: 'reveal_card', url: c.dataset.url});
                        appendChat(`You used Trigger: ${db.name}!`, "#f1c40f");
                    });
                } else {
                    appendChat("Took 1 damage to hand.", "#e74c3c");
                }
            }
        }
    }
    saveState();
}

function requestKO(targetId) {
    hideMenu();
    socket.emit('game_action', {type: 'request_ko', target: targetId.replace('opp-', '')});
    appendChat("Requested opponent to trash Character.", "#8e44ad");
}

function activateMain() {
    hideMenu();
    const db = CARD_DB[rightClickedCard.dataset.url];
    appendChat(`Activated Main: ${db.name}`, "#f39c12");
}
