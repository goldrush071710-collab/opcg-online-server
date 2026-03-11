// ==========================================
// THE ULTIMATE UNIFIED ENGINE
// ==========================================

const root = document.documentElement; const socket = io(); const DON_URL = 'https://tcgplayer-cdn.tcgplayer.com/product/456059_in_1000x1000.jpg';
let isDevMode = false, isMyTurn = false, isFirst = true, myTurnCount = 0;
let DECK_ARR = [], TRASH_ARR = [], turnNum = 0, DON_DECK_COUNT = 10, OPP_DON_TOTAL = 0;
let dragged = null, hovered = null, rightClickedCard = null, selectedDon = null;
let cardIDCounter = 0, isDragging = false, offX, offY, startX, startY;
let SEARCH_ARR = [], selectConfig = null;
let combatState = { active: false, attackerId: null, defenderId: null, step: null };
let currentCounterTotal = 0, selectedCounterCards = [];
let savedDecks = []; let editingDeck = { name: "", leader: null, main: {} }, editingDeckIndex = -1; let activeDeckIndex = -1, activeLobbyDeckUrlArray = [];

window.sanjiUsedThisTurn = false; window.rogerBuffActive = false; window.rogerBuffExpiresTurn = 0; window.tempSearchCallback = null; window.locked7Plus = false; 
window.leaderUsedThisTurn = false; window.magellanDefensiveUsed = false; window.stussyUsedThisTurn = false;
window.sotuTurnState = { vinsmokeCostDiscount: 0, judgeGlobalPowerBuff: 0 };
window.batchState = { luffy6cBuffActive: false, luffy6cBuffExpires: 0, extraTurnActive: false, blackMariaUsed: false, zoroFrozenDonCount: 0, donReturnedCount: 0, donReturnedThisTurn: false, magellanBuffActive: false, leaderCannotAttack: false, stussyRedEventBuffs: 0 };

let savedAlign = JSON.parse(localStorage.getItem('opcg_align') || "{}"); for (const [key, val] of Object.entries(savedAlign)) { root.style.setProperty(key, val); }
socket.on('global_align_update', (alignData) => { if (alignData && Object.keys(alignData).length > 0) { savedAlign = alignData; localStorage.setItem('opcg_align', JSON.stringify(savedAlign)); for (const [key, val] of Object.entries(savedAlign)) { root.style.setProperty(key, val); } } });
try { const raw = localStorage.getItem('opcg_decks'); savedDecks = raw ? JSON.parse(raw) : []; if (!Array.isArray(savedDecks)) savedDecks = []; } catch (e) { savedDecks = []; localStorage.setItem('opcg_decks', "[]"); }

function openAlignAuth() { showModal("Enter Developer Code:", "prompt", (val) => { if (val === "717") { document.getElementById('home-screen').style.display = 'none'; document.body.classList.add('align-mode-active'); document.getElementById('align-tool').style.display = 'block'; createCard('https://i.imgur.com/TwmysAX.png', 0, 0, {zone: 'leader-zone'}); createCard('https://i.imgur.com/2lEVHJP.png', 0, 0, {zone: 'char-zone-front'}); createCard('https://i.imgur.com/KdMSz8v.png', 0, 0, {zone: 'stage-zone'}); createCard(DON_URL, 0, 0, {zone: 'don-zone'}); const lf = createCard('https://m.media-amazon.com/images/I/51xnq29+enL._AC_.jpg', 0, 0, {zone: 'life-zone'}); lf.style.position = 'absolute'; loadZoneAlign(); } else { showModal("Access Denied.", "alert"); } }); }
function closeAlignTool() { window.location.reload(); }
function loadZoneAlign() { const zoneId = document.getElementById('align-zone').value; const targetIds = { 'ld': 'leader-zone', 'st': 'stage-zone', 'fz': 'franky-extra-zone', 'dk': 'drop-deck', 'tr': 'drop-trash', 'dd': 'don-deck', 'lf': 'life-zone', 'ch': 'char-zone-front', 'dz': 'don-zone' }; const target = document.getElementById(targetIds[zoneId]); document.querySelectorAll('.zone-is-selected').forEach(z => z.classList.remove('zone-is-selected')); if(target) target.classList.add('zone-is-selected'); const rs = getComputedStyle(root); document.getElementById('slider-t').value = parseFloat(rs.getPropertyValue(`--${zoneId}-t`)) || 0; document.getElementById('slider-l').value = parseFloat(rs.getPropertyValue(`--${zoneId}-l`)) || 0; document.getElementById('slider-w').value = parseFloat(rs.getPropertyValue(`--${zoneId}-w`)) || 0; document.getElementById('slider-h').value = parseFloat(rs.getPropertyValue(`--${zoneId}-h`)) || 0; document.getElementById('val-t').innerText = document.getElementById('slider-t').value + "%"; document.getElementById('val-l').innerText = document.getElementById('slider-l').value + "%"; document.getElementById('val-w').innerText = document.getElementById('slider-w').value + "%"; document.getElementById('val-h').innerText = document.getElementById('slider-h').value + "%"; const innerCtrl = document.getElementById('inner-card-control'); if (['ch', 'dz'].includes(zoneId)) { innerCtrl.style.display = 'flex'; document.getElementById('slider-cw').value = parseFloat(rs.getPropertyValue(`--${zoneId}-cw`)) || 11.5; document.getElementById('val-cw').innerText = document.getElementById('slider-cw').value + "%"; } else { innerCtrl.style.display = 'none'; } document.getElementById('slider-card-w').value = parseFloat(rs.getPropertyValue('--board-card-w')) || 11.5; document.getElementById('val-card-w').innerText = document.getElementById('slider-card-w').value + "%"; document.getElementById('slider-don-w').value = parseFloat(rs.getPropertyValue('--don-card-w')) || 11.5; document.getElementById('val-don-w').innerText = document.getElementById('slider-don-w').value + "%"; }
function updateAlign(prop, val) { const zoneId = document.getElementById('align-zone').value; root.style.setProperty(`--${zoneId}-${prop}`, val + '%'); document.getElementById(`val-${prop}`).innerText = val + "%"; savedAlign[`--${zoneId}-${prop}`] = val + '%'; }
function updateGlobalSize(prop, val) { root.style.setProperty(`--${prop}`, val + '%'); const displayId = prop === 'board-card-w' ? 'val-card-w' : 'val-don-w'; document.getElementById(displayId).innerText = val + "%"; savedAlign[`--${prop}`] = val + '%'; }
function saveAlign() { localStorage.setItem('opcg_align', JSON.stringify(savedAlign)); socket.emit('game_action', {type: 'global_align_update', alignData: savedAlign}); showModal("Alignment Saved & Synced!", "alert"); }
function resetAlign() { showModal("Reset all alignment to default?", "confirm", () => { savedAlign = {}; localStorage.removeItem('opcg_align'); window.location.reload(); }); }
function getColorCode(c) { const map = { "Red":"#e74c3c", "Purple":"#8e44ad", "Green":"#2ecc71", "Yellow":"#f1c40f", "Blue":"#3498db", "Black":"#34495e" }; return map[c] || "#fff"; }
function openDeckBuilder() { document.getElementById('home-screen').style.display = 'none'; document.getElementById('deck-builder-screen').style.display = 'flex'; editingDeck = { name: "New Deck", leader: null, main: {} }; document.getElementById('db-name').value = ""; clearLeader(); }
function clearLeader() { editingDeck.leader = null; renderDeckList(); updateDeckBuilderPool(); }
function updateDeckBuilderPool() { const pool = document.getElementById('db-pool'); pool.innerHTML = ''; const leaderColors = (editingDeck.leader && CARD_DB[editingDeck.leader]) ? CARD_DB[editingDeck.leader].color : null; let validCards = Object.keys(CARD_DB).filter(url => { const db = CARD_DB[url]; if(!db) return false; if(db.type === 'Leader') return true; if(leaderColors && db.color.some(c => leaderColors.includes(c))) return true; if(!leaderColors) return true; return false; }); const typeOrder = { "Leader": 1, "Character": 2, "Event": 3, "Stage": 4 }; validCards.sort((a, b) => { const dbA = CARD_DB[a]; const dbB = CARD_DB[b]; if (!dbA || !dbB) return 0; if (typeOrder[dbA.type] !== typeOrder[dbB.type]) return typeOrder[dbA.type] - typeOrder[dbB.type]; if (dbA.color[0] !== dbB.color[0]) return dbA.color[0].localeCompare(dbB.color[0]); return (dbA.cost || 0) - (dbB.cost || 0); }); validCards.forEach(url => createPoolItem(url, pool)); }
function createPoolItem(url, pool) { const div = document.createElement('div'); div.className = 'db-card-item'; div.style.backgroundImage = `url('${url}')`; div.oncontextmenu = (e) => { e.preventDefault(); document.getElementById('zoom-img').src = url; document.getElementById('zoom-overlay').style.display = 'flex'; }; div.onclick = () => addToDeck(url); pool.appendChild(div); }
function addToDeck(url) { const db = CARD_DB[url]; if(!db) return; if(db.type === 'Leader') { editingDeck.leader = url; updateDeckBuilderPool(); } else { if(!editingDeck.leader) { showModal("Select a Leader first!", "alert"); return; } let count = editingDeck.main[url] || 0; let total = Object.values(editingDeck.main).reduce((a, b) => a + b, 0); if(count < 4 && total < 50) { editingDeck.main[url] = count + 1; } } renderDeckList(); }
function removeFrmDeck(url) { if(editingDeck.main[url]) { editingDeck.main[url]--; if(editingDeck.main[url] <= 0) { delete editingDeck.main[url]; } } renderDeckList(); }
function renderDeckList() { const ld = document.getElementById('db-leader'); const ldots = document.getElementById('db-leader-colors'); ldots.innerHTML = ''; if(editingDeck.leader) { ld.innerText = CARD_DB[editingDeck.leader]?.name || "Unknown Leader"; (CARD_DB[editingDeck.leader]?.color || []).forEach(c => { const d = document.createElement('div'); d.className='color-dot'; d.style.background=getColorCode(c); ldots.appendChild(d); }); } else { ld.innerText = "None"; } let total = Object.values(editingDeck.main).reduce((a, b) => a + b, 0); document.getElementById('db-count').innerText = total; const list = document.getElementById('db-list'); list.innerHTML = ''; Object.keys(editingDeck.main).forEach(url => { const div = document.createElement('div'); div.className = 'db-list-item'; const cardName = CARD_DB[url]?.name || "Unknown Card (Please Remove)"; div.innerHTML = `<span>${cardName}</span> <span>x${editingDeck.main[url]}</span>`; div.onclick = () => removeFrmDeck(url); list.appendChild(div); }); }
function saveDeck() { editingDeck.name = document.getElementById('db-name').value.trim() || "Untitled Deck"; let total = Object.values(editingDeck.main).reduce((a, b) => a + b, 0); if(!editingDeck.leader || total !== 50) { showModal("Deck must have 1 Leader and exactly 50 cards.", "alert"); return; } if (editingDeckIndex === -1) { savedDecks.push(JSON.parse(JSON.stringify(editingDeck))); } else { savedDecks[editingDeckIndex] = JSON.parse(JSON.stringify(editingDeck)); } localStorage.setItem('opcg_decks', JSON.stringify(savedDecks)); renderHomeDecks(); showModal("Deck Saved!", "alert", () => closeDeckBuilder()); }
function closeDeckBuilder() { document.getElementById('deck-builder-screen').style.display = 'none'; document.getElementById('home-screen').style.display = 'flex'; renderHomeDecks(); }
function importDeck() { showModal("Paste deck string:", "prompt", (val) => { try { editingDeck = JSON.parse(atob(val)); document.getElementById('db-name').value = editingDeck.name; renderDeckList(); updateDeckBuilderPool(); } catch(e) { showModal("Invalid string.", "alert"); } }); }

function renderHomeDecks() {
    const list = document.getElementById('home-deck-list'); list.innerHTML = '';
    if (!savedDecks || savedDecks.length === 0) { list.innerHTML = "<span style='color:#777; font-style:italic;'>No decks saved. Create one!</span>"; return; }
    savedDecks.forEach((d, i) => {
        if(!d || !d.name) return;
        const div = document.createElement('div'); div.style.display = "flex"; div.style.justifyContent = "space-between"; div.style.alignItems = "center"; div.style.padding = "8px"; div.style.background = (activeDeckIndex === i) ? "var(--op-blue)" : "rgba(255,255,255,0.05)"; div.style.border = "1px solid rgba(255,255,255,0.1)"; div.style.borderRadius = "4px"; div.style.cursor = "pointer";
        const nameSpan = document.createElement('span'); nameSpan.innerText = d.name; nameSpan.style.fontWeight = "bold"; nameSpan.style.flex = "1"; nameSpan.onclick = () => { activeDeckIndex = i; renderHomeDecks(); };
        const btnContainer = document.createElement('div'); btnContainer.style.display = "flex"; btnContainer.style.gap = "5px";
        const editBtn = document.createElement('button'); editBtn.innerText = "EDIT"; editBtn.style.padding = "5px"; editBtn.style.fontSize = "10px"; editBtn.onclick = (e) => { e.stopPropagation(); editSavedDeck(i); };
        const listBtn = document.createElement('button'); listBtn.innerText = "LIST"; listBtn.style.padding = "5px"; listBtn.style.fontSize = "10px"; listBtn.style.background = "#8e44ad"; listBtn.onclick = (e) => { e.stopPropagation(); showVisualDecklist(i); };
        const delBtn = document.createElement('button'); delBtn.innerText = "X"; delBtn.style.padding = "5px"; listBtn.style.fontSize = "10px"; delBtn.style.background = "#e74c3c"; delBtn.onclick = (e) => { e.stopPropagation(); showModal("Delete this deck?", "confirm", () => { savedDecks.splice(i, 1); localStorage.setItem('opcg_decks', JSON.stringify(savedDecks)); if (activeDeckIndex === i) activeDeckIndex = -1; else if (activeDeckIndex > i) activeDeckIndex--; renderHomeDecks(); }); };
        btnContainer.appendChild(editBtn); btnContainer.appendChild(listBtn); btnContainer.appendChild(delBtn); div.appendChild(nameSpan); div.appendChild(btnContainer); list.appendChild(div);
    });
    if (activeDeckIndex === -1 && savedDecks.length > 0) { activeDeckIndex = 0; renderHomeDecks(); }
}

function editSavedDeck(index) { editingDeckIndex = index; editingDeck = JSON.parse(JSON.stringify(savedDecks[index])); document.getElementById('home-screen').style.display = 'none'; document.getElementById('deck-builder-screen').style.display = 'flex'; document.getElementById('db-name').value = editingDeck.name; renderDeckList(); updateDeckBuilderPool(); }

function showVisualDecklist(index) { 
    const d = savedDecks[index]; document.getElementById('visual-decklist-title').innerText = d.name; const cont = document.getElementById('visual-decklist-content'); cont.innerHTML = ''; 
    const leaderArr = [d.leader]; const chars = []; const events = []; const stages = []; let total = 0; 
    Object.keys(d.main).forEach(url => { total += d.main[url]; if(CARD_DB[url]?.type === 'Character') chars.push({url, count: d.main[url]}); else if(CARD_DB[url]?.type === 'Event') events.push({url, count: d.main[url]}); else if(CARD_DB[url]?.type === 'Stage') stages.push({url, count: d.main[url]}); else chars.push({url, count: d.main[url]}); }); 
    const createSection = (title, items) => { 
        if(items.length === 0) return; const sec = document.createElement('div'); sec.innerHTML = `<h2 style="color:var(--op-blue); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">${title}</h2>`; const grid = document.createElement('div'); grid.style.display = 'flex'; grid.style.flexWrap = 'wrap'; grid.style.gap = '15px'; 
        items.forEach(item => { const url = item.url || item; const count = item.count || 1; const wrap = document.createElement('div'); wrap.style.position = 'relative'; wrap.style.width = '120px'; wrap.style.height = '168px'; wrap.style.backgroundImage = `url('${url}')`; wrap.style.backgroundSize = '100% 100%'; wrap.style.borderRadius = '8px'; wrap.style.cursor = 'pointer'; wrap.onclick = () => { document.getElementById('zoom-img').src = url; document.getElementById('zoom-overlay').style.display = 'flex'; }; if(title !== 'Leader') { wrap.innerHTML = `<div style="position:absolute; bottom:-10px; right:-10px; background:#e74c3c; color:#fff; padding:5px 10px; border-radius:50%; font-weight:bold; border:2px solid #fff; font-size:16px;">x${count}</div>`; } grid.appendChild(wrap); }); sec.appendChild(grid); cont.appendChild(sec); 
    }; 
    createSection('Leader', leaderArr); createSection('Characters', chars); createSection('Events', events); createSection('Stages', stages); 
    document.getElementById('btn-copy-deck-text').onclick = () => { let text = `Deck: ${d.name}\nLeader: ${CARD_DB[d.leader]?.name || 'Unknown Leader'}\n\n`; Object.keys(d.main).forEach(url => { text += `${CARD_DB[url]?.name || 'Unknown Card'} x${d.main[url]}\n`; }); text += `\nTotal: ${total}/50`; navigator.clipboard.writeText(text).then(() => { showModal("Decklist copied to clipboard!", "alert"); }); }; document.getElementById('visual-decklist-overlay').style.display = 'flex'; 
}

window.onload = () => { renderHomeDecks(); };
function getSelectedPlaymat() { const sel = document.getElementById('playmat-selector'); return sel ? sel.value : 'https://i.imgur.com/SSN1DUI.jpeg'; }
function prepActiveDeck() { if(activeDeckIndex === -1 || !savedDecks[activeDeckIndex]) return false; const d = savedDecks[activeDeckIndex]; activeLobbyDeckUrlArray = [d.leader]; Object.keys(d.main).forEach(url => { for(let k=0; k<d.main[url]; k++) { activeLobbyDeckUrlArray.push(url); } }); return true; }
function setupPlayerBoardVisuals() { const board = document.getElementById('my-board'); let chosenMat = getSelectedPlaymat(); board.style.backgroundImage = `url('${chosenMat}')`; if (chosenMat.includes('WjiUDr0')) { board.classList.add('mat-white'); } else { board.classList.remove('mat-white'); } }

// --- GAME BOOT LOOP ---
function startDevMode() { 
    if(!prepActiveDeck()) { showModal("Select an active deck first!", "alert"); return; } 
    isDevMode = true; turnNum = 1; myTurnCount = 1; isMyTurn = true; 
    window.locked7Plus = false; window.leaderUsedThisTurn = false; window.magellanDefensiveUsed = false; window.stussyUsedThisTurn = false; window.sotuTurnState.vinsmokeCostDiscount = 0; window.sotuTurnState.judgeGlobalPowerBuff = 0; window.batchState.luffy6cBuffActive = false; window.batchState.extraTurnActive = false; window.batchState.blackMariaUsed = false; window.batchState.zoroFrozenDonCount = 0; window.batchState.donReturnedCount = 0; window.batchState.donReturnedThisTurn = false; window.batchState.magellanBuffActive = false; window.batchState.leaderCannotAttack = false; window.batchState.stussyRedEventBuffs = 0;
    
    setupPlayerBoardVisuals(); 
    document.getElementById('home-screen').style.display = 'none'; 
    document.getElementById('sidebar-manual-controls').style.display = 'block'; 
    
    DECK_ARR = activeLobbyDeckUrlArray.slice(1); 
    shuffleArray(DECK_ARR); 
    createCard(activeLobbyDeckUrlArray[0], 0, 0, {zone:'leader-zone'}); 
    
    const leaderLife = CARD_DB[activeLobbyDeckUrlArray[0]]?.life || 5; 
    for(let i=0; i<leaderLife; i++) { if(DECK_ARR.length) { const c = createCard(DECK_ARR.shift(), 0, 0, {isLife: true, isBack: true}); c.style.position = 'absolute'; document.getElementById('life-zone').appendChild(c); } } 
    updateLifePositions(); 
    for(let i=0; i<5; i++) { if(DECK_ARR.length) { createCard(DECK_ARR.shift(), 0, 0, {inHand: true}); } } 
    refreshStats(); saveState();
}

function createLobby() { 
    if(!prepActiveDeck()) { showModal("Select an active deck first!", "alert"); return; } 
    socket.emit('create_room', (res) => { document.getElementById('menu-main').style.display = 'none'; document.getElementById('menu-deck').style.display = 'block'; document.getElementById('display-room-code').innerText = res.roomId; document.getElementById('lobby-status').innerText = "Waiting for opponent..."; socket.emit('deck_selected', activeLobbyDeckUrlArray); }); 
}

function showJoinLobby() { if(!prepActiveDeck()) { showModal("Select an active deck first!", "alert"); return; } document.getElementById('menu-main').style.display = 'none'; document.getElementById('menu-join').style.display = 'block'; }
function joinLobby() { socket.emit('join_room', document.getElementById('room-code-input').value.trim(), (res) => { if(res.success) { document.getElementById('menu-join').style.display = 'none'; document.getElementById('menu-deck').style.display = 'block'; document.getElementById('display-room-code').innerText = document.getElementById('room-code-input').value.trim(); document.getElementById('lobby-status').innerText = "Waiting for opponent..."; socket.emit('deck_selected', activeLobbyDeckUrlArray); } else { showModal("Invalid room.", "alert"); } }); }
function backToMain() { document.getElementById('menu-join').style.display = 'none'; document.getElementById('menu-main').style.display = 'block'; }
function randomMatch() { if(!prepActiveDeck()) { showModal("Select an active deck first!", "alert"); return; } document.getElementById('menu-main').style.display = 'none'; document.getElementById('menu-deck').style.display = 'block'; document.getElementById('lobby-status').innerText = "Searching for opponent..."; socket.emit('join_random', (res) => { document.getElementById('display-room-code').innerText = res.roomId; if(!res.waiting) { document.getElementById('lobby-status').innerText = "Opponent found! Connecting..."; socket.emit('deck_selected', activeLobbyDeckUrlArray); } else { socket.emit('deck_selected', activeLobbyDeckUrlArray); } }); }
function copyCode() { navigator.clipboard.writeText(document.getElementById('display-room-code').innerText).then(()=> { showModal("Code copied!", "alert"); }); }

socket.on('player_joined', () => { document.getElementById('lobby-status').innerText = "Opponent joined! Connecting..."; });

socket.on('game_start', (data) => {
    document.getElementById('home-screen').style.display = 'none'; 
    isFirst = data.isFirst; isDevMode = false; myTurnCount = 0; turnNum = 1; 
    window.locked7Plus = false; window.leaderUsedThisTurn = false; window.magellanDefensiveUsed = false; window.stussyUsedThisTurn = false; window.sotuTurnState.vinsmokeCostDiscount = 0; window.sotuTurnState.judgeGlobalPowerBuff = 0; window.batchState.luffy6cBuffActive = false; window.batchState.extraTurnActive = false; window.batchState.blackMariaUsed = false; window.batchState.zoroFrozenDonCount = 0; window.batchState.donReturnedCount = 0; window.batchState.donReturnedThisTurn = false; window.batchState.magellanBuffActive = false; window.batchState.leaderCannotAttack = false; window.batchState.stussyRedEventBuffs = 0;
    
    setupPlayerBoardVisuals(); 
    DECK_ARR = activeLobbyDeckUrlArray.slice(1); shuffleArray(DECK_ARR); 
    createCard(activeLobbyDeckUrlArray[0], 0, 0, {zone:'leader-zone'}); 
    
    const leaderLife = CARD_DB[activeLobbyDeckUrlArray[0]]?.life || 5; 
    for(let i=0; i<leaderLife; i++) { if(DECK_ARR.length) { const c = createCard(DECK_ARR.shift(), 0, 0, {isLife: true, isBack: true}); c.style.position = 'absolute'; document.getElementById('life-zone').appendChild(c); } } 
    updateLifePositions(); 
    for(let i=0; i<5; i++) { if(DECK_ARR.length) { createCard(DECK_ARR.shift(), 0, 0, {inHand: true}); } } 
    refreshStats(); saveState();

    setTimeout(() => { 
        showModal("Mulligan? (Return hand, draw 5)", "confirm", () => { 
            document.querySelectorAll('#hand-bar .card').forEach(c => { DECK_ARR.push(c.dataset.url); c.remove(); }); 
            shuffleArray(DECK_ARR); 
            for(let i=0; i<5; i++) { if(DECK_ARR.length) createCard(DECK_ARR.shift(), 0, 0, {inHand: true}); } 
            refreshStats(); saveState(); socket.emit('mulligan_done'); document.getElementById('sync-overlay').style.display = 'flex'; 
        }, () => { socket.emit('mulligan_done'); document.getElementById('sync-overlay').style.display = 'flex'; }); 
    }, 500);
});

socket.on('begin_game', () => { document.getElementById('sync-overlay').style.display = 'none'; isMyTurn = isFirst; if(isFirst) myTurnCount = 1; updateTurnUI(); if(isFirst) { OPP_DON_TOTAL = 0; spawnDonLocal(); } showModal(`Game Start! You go ${isFirst ? 'FIRST' : 'SECOND'}.`, "alert", () => saveState()); });

function showModal(msg, type, onConfirm, onCancel, defaultVal = "") { 
    const over = document.getElementById('custom-modal-overlay'); document.getElementById('custom-modal-msg').innerHTML = msg; const inp = document.getElementById('custom-modal-input'); const b1 = document.getElementById('custom-modal-btn-1'); const b2 = document.getElementById('custom-modal-btn-2'); over.style.display = 'flex'; const newB1 = b1.cloneNode(true); b1.parentNode.replaceChild(newB1, b1); const newB2 = b2.cloneNode(true); b2.parentNode.replaceChild(newB2, b2); 
    if(type === 'alert') { inp.style.display = 'none'; newB2.style.display = 'none'; newB1.innerText = "OK"; newB1.style.background = "#3498db"; newB1.onclick = () => { over.style.display = 'none'; if(onConfirm) onConfirm(); }; } else if(type === 'confirm') { inp.style.display = 'none'; newB2.style.display = 'block'; newB1.innerText = "YES"; newB1.style.background = "#2ecc71"; newB2.innerText = "NO"; newB2.style.background = "#e74c3c"; newB1.onclick = () => { over.style.display = 'none'; if(onConfirm) onConfirm(); }; newB2.onclick = () => { over.style.display = 'none'; if(onCancel) onCancel(); }; } else if(type === 'prompt') { inp.style.display = 'block'; newB2.style.display = 'block'; inp.value = defaultVal; newB1.innerText = "SUBMIT"; newB1.style.background = "#2ecc71"; newB2.innerText = "CANCEL"; newB2.style.background = "#e74c3c"; newB1.onclick = () => { over.style.display = 'none'; if(onConfirm) onConfirm(inp.value); }; newB2.onclick = () => { over.style.display = 'none'; if(onCancel) onCancel(); }; } 
}

function sendChat(e) { e.preventDefault(); const inp = document.getElementById('chat-input'); const msg = inp.value.trim(); if(!msg) return; appendChat("You: " + msg, "#2ecc71"); socket.emit('chat_msg', msg); inp.value = ''; } 
socket.on('chat_msg', (msg) => { appendChat("Opp: " + msg, "#e74c3c"); });
function appendChat(str, col) { const box = document.getElementById('chat-messages'); const div = document.createElement('div'); div.style.color = col; div.innerText = str; box.appendChild(div); box.scrollTop = box.scrollHeight; }
function updateTurnUI() { if(isDevMode) return; const ti = document.getElementById('turn-indicator'); ti.style.display = 'block'; if(isMyTurn) { ti.innerText = "YOUR TURN"; ti.style.background = "#2ecc71"; document.getElementById('btn-end-turn').disabled = false; } else { ti.innerText = "OPPONENT'S TURN"; ti.style.background = "#e74c3c"; document.getElementById('btn-end-turn').disabled = true; } }
function concedeGame() { showModal("Are you sure you want to concede?", "confirm", () => { socket.emit('game_action', {type: 'concede'}); showModal("You Conceded. GAME OVER.", "alert", () => window.location.reload()); }); }

socket.on('board_update', (data) => {
    if(isDevMode) return;
    document.getElementById('opp-deck-count').innerText = data.deck; document.getElementById('opp-hand-count').innerText = data.handCount; OPP_DON_TOTAL = data.totalDon;
    if(data.playmat) { document.getElementById('opp-board').style.backgroundImage = `url('${data.playmat}')`; if(data.playmat.includes('WjiUDr0')) document.getElementById('opp-board').classList.add('mat-white'); else document.getElementById('opp-board').classList.remove('mat-white'); }
    const oppZones = ['opp-life-zone', 'opp-char-zone-front', 'opp-franky-extra-zone', 'opp-leader-zone', 'opp-stage-zone', 'opp-don-zone'];
    oppZones.forEach(z => document.getElementById(z).innerHTML = '');
    data.field.forEach(c => {
        const url = c.back ? 'https://m.media-amazon.com/images/I/51xnq29+enL._AC_.jpg' : c.url;
        const newC = createCard(url, 0, 0, {isOpponent: true, isBack: c.back});
        newC.id = 'opp-' + c.id; newC.dataset.url = c.url; newC.dataset.isDon = c.isDon; newC.dataset.isLife = c.isLife; newC.dataset.currentPower = c.tempPower;
        if(c.rested) newC.classList.add('rested');
        if(c.frozen) { newC.classList.add('frozen'); newC.dataset.frozenUntil = c.frozenUntil; }
        if(c.noRestand) { newC.classList.add('no-restand'); newC.dataset.noRestand = "true"; }
        if(c.unblockable) newC.dataset.unblockable = "true";
        if(c.rush) { newC.dataset.hasRush = "true"; newC.querySelector('.rush-tag').style.display='block'; }
        if(c.banish) { newC.dataset.banish = "true"; newC.querySelector('.banish-tag').style.display='block'; }
        if(c.doubleAttack) { newC.dataset.doubleAttack = "true"; newC.querySelector('.double-attack-tag').style.display='block'; }
        const targetZone = c.zone === 'hand-bar' ? 'opp-hand' : (c.zone.startsWith('opp-') ? c.zone : 'opp-' + c.zone);
        const tzEl = document.getElementById(targetZone);
        if(tzEl) { if(targetZone === 'opp-life-zone') newC.style.position = 'absolute'; else newC.style.position = 'relative'; tzEl.appendChild(newC); }
    });
    data.field.forEach(c => { if(c.parentId) { const don = document.getElementById('opp-' + c.id); const parent = document.getElementById('opp-' + c.parentId); if(don && parent) don.dataset.parentId = 'opp-' + c.parentId; } });
    const oppLifeCards = document.getElementById('opp-life-zone').children;
    for(let i=0; i<oppLifeCards.length; i++) { oppLifeCards[i].style.top = (i * 10) + 'px'; oppLifeCards[i].style.left = (i * 2) + 'px'; oppLifeCards[i].style.zIndex = i; }
    document.getElementById('opp-don').innerText = OPP_DON_TOTAL; updatePowerDisplay();
});

socket.on('game_action', (data) => {
    if(data.type === 'declare_attack') { 
        const att = document.getElementById('opp-' + data.attackerId); const def = document.getElementById(data.defenderId.replace('opp-','')); 
        if(!att || !def) return;
        if (data.attackerPower !== undefined) { att.dataset.currentPower = data.attackerPower; }
        combatState = { active: true, attackerId: att.id, defenderId: def.id, step: 'counter' }; 
        openArena(att.id, def.id, "You are being attacked!"); 
        if(data.unblockable === "true" || att.dataset.unblockable === "true") { appendChat("Attack is Unblockable!", "#e74c3c"); askCounterPhase(); return; } 
        const checkMagellanAndBlockers = () => {
            const myLeader = document.querySelector('#leader-zone .card');
            if (myLeader && CARD_DB[myLeader.dataset.url]?.name === "Magellan" && !window.magellanDefensiveUsed && DON_DECK_COUNT < 10) {
                const activeDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).filter(d => !d.dataset.parentId);
                if(activeDons.length >= 1) { showModal("Opponent Attacked! Use Magellan Defensive (-1 DON, +1000, Draw 1)?", "confirm", () => { magellanLeaderDefensive(() => checkBlockers()); }, () => checkBlockers()); return; }
            } checkBlockers();
        };
        const checkBlockers = () => {
            const blockers = Array.from(document.querySelectorAll('#char-zone-front .card:not(.rested):not(.frozen)')).filter(c => CARD_DB[c.dataset.url]?.blocker || (CARD_DB[c.dataset.url]?.name==="Rob Lucci (Y)" && document.getElementById('life-zone').children.length<=1) || (CARD_DB[c.dataset.url]?.name==="Monkey D. Luffy" && c.dataset.luffyBuff==="true") || CARD_DB[c.dataset.url]?.name==="Spandam" || (c.dataset.reijuBuffExpires && turnNum < parseInt(c.dataset.reijuBuffExpires))); 
            if(blockers.length > 0) { showModal("Opponent is attacking! Use a Blocker?", "confirm", () => { combatState.step = 'select_blocker'; document.body.classList.add('blocker-target-mode'); blockers.forEach(b => b.classList.add('valid-blocker')); appendChat("Select a Blocker.", "#3498db"); }, () => askCounterPhase()); } else { askCounterPhase(); } 
        }; checkMagellanAndBlockers();
    }
    else if(data.type === 'block_declared') { combatState.defenderId = data.newDef.startsWith('opp-') ? data.newDef : 'opp-'+data.newDef; openArena(combatState.attackerId, combatState.defenderId, "Opponent Blocked! Counter Phase..."); const hasRoger = Array.from(document.querySelectorAll('#char-zone-front .card')).some(c => CARD_DB[c.dataset.url]?.name === "Gol D. Roger" && CARD_DB[c.dataset.url]?.cost === 10); const myLife = document.getElementById('life-zone').children.length; const oppLife = document.getElementById('opp-life-zone').children.length; if(hasRoger && (myLife === 0 || oppLife === 0)) { showModal("GOL D. ROGER INSTANT WIN TRIGGERED!", "alert", () => { socket.emit('game_action', {type: 'game_over'}); window.location.reload(); }); } }
    else if(data.type === 'update_counter') { updateArenaCounter(data.counterValue); }
    else if(data.type === 'counter_declared') { executeCombatResolution(data.counterValue, data.finalDefPower); }
    else if(data.type === 'clear_combat') { clearCombatState(); }
    else if(data.type === 'resolve_kill') { const myTarget = document.getElementById(data.target.replace('opp-','')); if(myTarget) { const db = CARD_DB[myTarget.dataset.url]; if(db && db.name === "General Franky") { const totalDon = document.querySelectorAll('#my-board .card[data-is-don="true"]').length; if (totalDon >= 3) { showModal("General Franky would be K.O.'d! Return 3 DON!! to save him?", "confirm", () => { returnDonAndCheckSanji(3, () => { appendChat("Returned 3 DON!! to save General Franky!", "#3498db"); }); }, () => { trashCard(myTarget); appendChat("Your Character K.O.'d!", "#e74c3c"); }); return; } } trashCard(myTarget); appendChat("K.O.'d!", "#e74c3c"); } }
    else if(data.type === 'resolve_life') { let attId = combatState.attackerId; if(attId && !attId.startsWith('opp-')) attId = 'opp-' + attId; if(!isMyTurn) handleLifeDamage(data.banish, data.double); else appendChat("Opponent took damage!", "#2ecc71"); }
    else if(data.type === 'reveal_card') { appendChat(`Opponent revealed: ${CARD_DB[data.url]?.name || 'Unknown Card'}`, "#3498db"); }
    else if(data.type === 'request_ko') { const myTarget = document.getElementById(data.target.replace('opp-','')); if(myTarget) { const db = CARD_DB[myTarget.dataset.url]; if(db && db.name === "General Franky") { const totalDon = document.querySelectorAll('#my-board .card[data-is-don="true"]').length; if (totalDon >= 3) { showModal("Opponent's effect would K.O. General Franky! Return 3 DON!! to save him?", "confirm", () => { returnDonAndCheckSanji(3, () => { appendChat("Returned 3 DON!! to save General Franky!", "#3498db"); }); }, () => { trashCard(myTarget); appendChat("Character K.O.'d by effect!", "#e74c3c"); }); return; } } trashCard(myTarget); appendChat("Character K.O.'d by effect!", "#e74c3c"); } }
    else if(data.type === 'apply_status') { const myTarget = document.getElementById(data.target.replace('opp-','')); if(myTarget) { if(data.status === 'freeze') { myTarget.classList.add('frozen'); myTarget.dataset.frozenUntil = myTurnCount + 2; appendChat("Your card was Action Locked (Frozen) by opponent!", "#34dbdb"); } else if(data.status === 'rest') { myTarget.classList.add('rested'); appendChat("Your card was Rested by opponent!", "#f1c40f"); } else if(data.status === 'no_restand') { myTarget.classList.add('no-restand'); myTarget.dataset.noRestand = "true"; appendChat("Your card was Locked by opponent!", "#9b59b6"); } else if(data.status === 'minus_power') { myTarget.dataset.tempPower = parseInt(myTarget.dataset.tempPower||0) - data.amount; updatePowerDisplay(); appendChat("Your card lost " + data.amount + " power!", "#e74c3c"); } else if(data.status === 'minus_cost') { myTarget.dataset.tempCost = parseInt(myTarget.dataset.tempCost || CARD_DB[myTarget.dataset.url]?.cost || 0) - data.amount; updatePowerDisplay(); appendChat("Your card received -" + data.amount + " Cost!", "#9b59b6"); } else if(data.status === 'minus_don') { if(DON_DECK_COUNT < 10) { const activeDon = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).find(d => !d.dataset.parentId); if(activeDon) { activeDon.remove(); DON_DECK_COUNT++; organizeDon(); } } } saveState(); } }
    else if (data.type === 'concede') { showModal("Opponent Conceded! YOU WIN!", "alert", ()=>window.location.reload()); } 
    else if (data.type === 'game_over') { showModal("Opponent took damage at 0 Life! YOU WIN!", "alert", ()=>window.location.reload()); }
    else if (data.type === 'force_sync') { saveState(); }
    else if (data.type === 'end_turn') { isMyTurn = true; handleTurnStartLogic(); }
});

function createCard(url, x, y, opts = {}) { const c = document.createElement('div'); c.className = 'card'; c.id = opts.id || 'c-' + cardIDCounter++; c.dataset.url = url; c.dataset.isDon = (url === DON_URL).toString(); c.dataset.isLife = (opts.isLife || false).toString(); c.style.backgroundImage = `url('${url}')`; c.innerHTML = `<div class="don-badge">0</div><div class="power-badge hidden">+0</div><div class="keyword-tags"><div class="kw-tag blocker-tag">BLOCKER</div><div class="kw-tag rush-tag">RUSH</div><div class="kw-tag banish-tag">BANISH</div><div class="kw-tag double-attack-tag">DOUBLE ATK</div></div>`; if (opts.isBack) c.classList.add('card-back'); if (!opts.isOpponent) { bindCardEvents(c); } else { c.onmousedown = (e) => { if (e.button !== 0) return; if (selectConfig) { handleSelection(c); return; } }; c.oncontextmenu = (e) => { e.preventDefault(); }; c.onmouseenter = () => { if(!c.classList.contains('card-back')) { document.getElementById('right-col-inspector').style.backgroundImage = `url('${c.dataset.url}')`; } }; } if (opts.inHand) document.getElementById('hand-bar').appendChild(c); else if (opts.zone) document.getElementById(opts.zone).appendChild(c); return c; }

function bindCardEvents(c) {
    c.onmouseenter = () => { hovered = c; if(!c.classList.contains('card-back') || isDevMode) { document.getElementById('right-col-inspector').style.backgroundImage = `url('${c.dataset.url}')`; } };
    c.onmouseleave = () => hovered = null;
    c.onmousedown = (e) => { 
        if (e.button !== 0 || combatState.step === 'wait_counter') return; 
        if (selectConfig) { handleSelection(c); return; }
        const db = CARD_DB[c.dataset.url] || {}; 
        if (combatState.step === 'counter') { 
            if (c.parentElement.id === 'hand-bar' && db && (db.counter !== undefined || db.isCounter)) { 
                if (db.name === "Divine Departure") { if(selectedCounterCards.includes(c)) return; startSelection('hand_trash', 1, "Trash 1 card to give +3000 Power", (cards) => { TRASH_ARR.push(cards[0].dataset.url); cards[0].remove(); TRASH_ARR.push(c.dataset.url); c.remove(); currentCounterTotal += 3000; updateArenaCounter(currentCounterTotal); socket.emit('game_action', {type:'update_counter', counterValue: currentCounterTotal}); appendChat("Divine Departure provided +3000 Defense!", "#3498db"); }); return; }
                if (db.name === "NoroNoro Beam Sword") { if(selectedCounterCards.includes(c)) return; const activeDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).filter(d => !d.dataset.parentId); if(activeDons.length < 2) { showModal("Need 2 active DON!!", "alert"); return; } for(let i=0; i<2; i++) activeDons[i].classList.add('rested'); startSelection('don_minus', 1, "Return 1 DON!! to Deck", (dons) => { dons[0].remove(); DON_DECK_COUNT++; organizeDon(); startSelection('lucci_g_rest', 1, "Rest 1 Opponent Character", (targets) => { targets[0].classList.add('rested'); if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'rest', target: targets[0].id}); TRASH_ARR.push(c.dataset.url); c.remove(); currentCounterTotal += 2000; updateArenaCounter(currentCounterTotal); socket.emit('game_action', {type:'update_counter', counterValue: currentCounterTotal}); appendChat("NoroNoro Beam Sword gave +2000 and rested an enemy!", "#8e44ad"); saveState(); }); }); return; }
                if (db.name === "Bad Manners Kick Course") { if(selectedCounterCards.includes(c)) return; startSelection('hand_trash', 1, "Trash 1 card to give +3000 Power", (cards) => { TRASH_ARR.push(cards[0].dataset.url); cards[0].remove(); TRASH_ARR.push(c.dataset.url); c.remove(); currentCounterTotal += 3000; updateArenaCounter(currentCounterTotal); socket.emit('game_action', {type:'update_counter', counterValue: currentCounterTotal}); appendChat("Bad Manners Kick Course provided +3000 Defense!", "#e74c3c"); }); return; }
                let cv = db.counter || 0; if (db.isCounter && !db.counter) { if (db.name === "Gum Gum Giant") cv = 4000; else cv = 2000; }
                if (selectedCounterCards.includes(c)) { selectedCounterCards = selectedCounterCards.filter(card => card !== c); c.style.outline = ""; currentCounterTotal -= cv; if(db.type === 'Event') { const restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested')); for(let i=0; i<db.cost; i++) if(restedDons[i]) restedDons[i].classList.remove('rested'); } } else { if(db.type === 'Event') { const activeDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).filter(d => !d.dataset.parentId); if(activeDons.length < db.cost) { showModal(`Need ${db.cost} active DON!!`, "alert"); return; } for(let i=0; i<db.cost; i++) activeDons[i].classList.add('rested'); } selectedCounterCards.push(c); c.style.outline = "4px solid #3498db"; currentCounterTotal += cv; } 
                updateArenaCounter(currentCounterTotal); socket.emit('game_action', {type:'update_counter', counterValue: currentCounterTotal}); 
            } else if (c.parentElement.id === 'char-zone-front' && db?.name === "Dracule Mihawk (9c)" && c.dataset.usedDefend !== "true") {
                showModal("Trash 1 card from hand to give +2000 defense?", "confirm", () => { startSelection('hand_trash', 1, "Select 1 to trash", (cards) => { TRASH_ARR.push(cards[0].dataset.url); document.getElementById('drop-trash').style.backgroundImage = `url('${cards[0].dataset.url}')`; cards[0].remove(); c.dataset.usedDefend = "true"; currentCounterTotal += 2000; updateArenaCounter(currentCounterTotal); socket.emit('game_action', {type:'update_counter', counterValue: currentCounterTotal}); appendChat("Dracule Mihawk (9c) provided +2000 defense!", "#3498db"); }, () => askCounterPhase()); });
            } return; 
        }
        if (c.dataset.isDon === "true" && c.dataset.parentId) { e.stopPropagation(); return; }
        const locked = ['leader-zone', 'char-zone-front', 'stage-zone', 'franky-extra-zone']; 
        if(c.dataset.isDon !== "true" && locked.includes(c.parentElement.id) && !isDevMode) return; 
        offX = e.clientX - c.getBoundingClientRect().left; offY = e.clientY - c.getBoundingClientRect().top; startX = e.clientX; startY = e.clientY; dragged = c; isDragging = false; c.dataset.origZone = c.parentElement.id; 
    };
    c.oncontextmenu = (e) => { 
        e.preventDefault(); 
        if(selectConfig || c.dataset.isDon === "true" || combatState.step === 'counter' || combatState.step === 'wait_counter') return; 
        rightClickedCard = c; const db = CARD_DB[c.dataset.url] || {}; const menu = document.getElementById('context-menu'); menu.style.display = 'block'; menu.style.left = e.pageX + 'px'; menu.style.top = e.pageY + 'px'; 
        let h = ""; if(isDevMode) { h += `<div onclick="setPower(1000)">+1000 Power</div><div onclick="setPower(0)">Reset Power</div>`; }
        let canAttack = false; 
        if(c.parentElement.id === 'char-zone-front' || c.parentElement.id === 'leader-zone') { 
            if(!c.classList.contains('rested') && !c.classList.contains('frozen') && (isMyTurn || isDevMode)) { 
                if(db.type === 'Leader' && myTurnCount === 1) canAttack = false; else if(db.type === 'Character' && c.dataset.turnPlayed == myTurnCount && c.dataset.hasRush !== "true") canAttack = false; else canAttack = true; if (window.batchState.leaderCannotAttack && c.parentElement.id === 'leader-zone') canAttack = false;
            } 
        }
        if(canAttack) h += `<div onclick="simulateAttack()" style="background:#c0392b; color:#fff">Attack</div>`; 
        else if ((c.parentElement.id === 'char-zone-front' || c.parentElement.id === 'leader-zone') && !c.classList.contains('rested')) {
            if(c.classList.contains('frozen')) h += `<div style="background:#34dbdb; color:#000; font-weight:bold; cursor:not-allowed;">FROZEN (Cannot Act)</div>`; else h += `<div style="background:#555; color:#999; cursor:not-allowed;">Attack Unavailable</div>`;
        }
        if (!c.classList.contains('frozen')) {
            const customMains = ["Franky", "Hattori", "Stussy", "Vinsmoke Judge", "Vinsmoke Ichiji", "Vinsmoke Yonji", "Monkey D. Luffy (Extra Turn)", "Black Maria", "Roronoa Zoro", "Vinsmoke Reiju (5c)", "Vinsmoke Sanji", "Impel Down", "Domino", "Magellan (10c)", "We News", "Morgans (5c)", "Morgans", "Rob Lucci (Y)", "Kaku", "Magellan"];
            if (db?.hasMain && !['hand-bar', 'life-zone'].includes(c.parentElement.id) && !customMains.includes(db?.name)) { h += `<div onclick="activateMain()" style="background:#f39c12; color:#000">Activate Main</div>`; } 
            if (db?.type === "Stage" && (db?.traits||[]).includes("Invention") && !['hand-bar', 'life-zone'].includes(c.parentElement.id)) h += `<div onclick="stageOncePerGame()" style="background:#8e44ad; color:#fff">Once Per Game (Gen. Franky)</div>`;
            if (db?.type === "Leader") {
                if (db.name === "Franky" && (isMyTurn || isDevMode) && !window.leaderUsedThisTurn) h += `<div onclick="frankyMainEffect()" style="background:#f39c12; color:#000">Activate Main (Return 2 DON!!)</div>`;
                if (db.name === "Stussy" && (isMyTurn || isDevMode) && !window.stussyUsedThisTurn) h += `<div onclick="stussyLeaderFlip()" style="background:#f39c12; color:#000">Activate: Flip Life & Freeze</div>`;
                if (db.name === "Morgans" && (isMyTurn || isDevMode) && !window.leaderUsedThisTurn) h += `<div onclick="morgansLeaderMain()" style="background:#f39c12; color:#000">Main: Look at top 3 for Big News</div>`;
                if (db.name === "Magellan") { if ((isMyTurn || isDevMode) && !window.leaderUsedThisTurn) h += `<div onclick="magellanLeaderMain()" style="background:#f39c12; color:#000">Main: DON-1 -> Play ≤4c Impel from Trash</div>`; if (!window.magellanDefensiveUsed && (!isMyTurn || isDevMode)) h += `<div onclick="magellanLeaderDefensive()" style="background:#34dbdb; color:#000">Defensive: DON-1 -> +1000 & Draw 1</div>`; }
                if (db.name === "Vinsmoke Judge" && (isMyTurn || isDevMode) && !window.leaderUsedThisTurn) h += `<div onclick="judgeLeaderMain()" style="background:#f39c12; color:#000">Main: Trash 1 GERMA -> Draw 1 & Opp -3 Cost</div>`;
            }
            if (db?.name === "Rob Lucci (Y)" && c.parentElement.id === 'char-zone-front' && (isMyTurn || isDevMode)) h += `<div onclick="lucciYellowMain()" style="background:#f39c12; color:#000">Main: Flip Down -> Restand EOT</div>`;
            if (db?.name === "Kaku" && c.parentElement.id === 'char-zone-front' && (isMyTurn || isDevMode)) h += `<div onclick="kakuMain()" style="background:#f39c12; color:#000">Main: Flip Down -> Double Attack</div>`;
            if (db?.name === "Hattori" && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="hattoriMain()" style="background:#f39c12; color:#000">Activate Main: Buff Lucci</div>`;
            if (db?.name === "Vinsmoke Judge" && db.cost === 6 && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="judgeMainEffect()" style="background:#f39c12; color:#000">Main: Trash Hand -> +1000 GERMA</div>`;
            if (db?.name === "Vinsmoke Ichiji" && db.cost === 3 && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="ichijiMainRamp()" style="background:#f39c12; color:#000">Main: Rest -> Vinsmoke in Hand -2 Cost</div>`;
            if (db?.name === "Vinsmoke Yonji" && db.cost === 9 && c.parentElement.id === 'char-zone-front' && c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="yonjiUnrest()" style="background:#f39c12; color:#000">Main: Unrest & Gain RUSH</div>`;
            if (db?.name === "Monkey D. Luffy (Extra Turn)" && db.cost === 10 && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="luffy10cMain()" style="background:#f39c12; color:#000">Main: Rest 1 DON!! -> Add 1 Active DON!!</div>`;
            if (db?.name === "Black Maria" && db.cost === 3 && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="blackMariaMain()" style="background:#f39c12; color:#000">Main: Add up to 5 Rested DON!!</div>`;
            if (db?.name === "Roronoa Zoro" && db.cost === 1 && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="zoro1cMain()" style="background:#f39c12; color:#000">Main: Add 1 Rested DON!! (Freeze 1 next turn)</div>`;
            if (db?.name === "Vinsmoke Reiju (5c)" && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="reiju5cMain()" style="background:#f39c12; color:#000">Main: Draw 2 Trash 3 -> Gain Blocker & +5 Cost</div>`;
            if (db?.name === "Vinsmoke Sanji" && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="sanji3cMain()" style="background:#f39c12; color:#000">Main: Attach 1 Rested DON!!</div>`;
            if (db?.name === "Impel Down" && c.parentElement.id === 'stage-zone' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="impelStageMain()" style="background:#f39c12; color:#000">Main: Rest & Trash 1 -> Search Top 3</div>`;
            if (db?.name === "Domino" && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="dominoMain()" style="background:#f39c12; color:#000">Main: If DON returned this turn, Draw 1 Trash 1</div>`;
            if (db?.name === "Magellan (10c)" && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="magellan10cMain()" style="background:#f39c12; color:#000">Main: Rest & Give Jailer Beasts +1000 per returned DON</div>`;
            if (db?.name === "We News" && c.parentElement.id === 'stage-zone' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="weNewsMain()" style="background:#f39c12; color:#000">Main: Rest Stage & Trash 2 -> Play Lackey</div>`;
            if ((db?.name === "Morgans (5c)" || db?.name === "Morgans") && c.parentElement.id === 'char-zone-front' && !c.classList.contains('rested') && (isMyTurn || isDevMode)) h += `<div onclick="morgansCharMain()" style="background:#f39c12; color:#000">Main: Rest & Search Top 6 for Red 5c+</div>`;
        }
        if (db?.name === "General Franky" && c.parentElement.id === 'hand-bar') h += `<div onclick="bottomGeneralFranky()" style="background:#8e44ad; color:#fff">Bottom Deck & Draw 1</div>`; 
        if (isDevMode && c.parentElement.id !== 'hand-bar' && c.parentElement.id !== 'life-zone' && c.parentElement.id !== 'leader-zone') h += `<div onclick="moveToTrash(rightClickedCard)" style="color:#e67e22">Trash</div>`; 
        if (!isDevMode && c.id.includes('opp-') && (c.parentElement.id === 'opp-char-zone-front' || c.parentElement.id === 'opp-stage-zone' || c.parentElement.id === 'opp-franky-extra-zone')) { h += `<div onclick="requestKO('${c.id}')" style="background:#8e44ad; color:#fff">Request K.O. / Trash</div>`; }
        menu.innerHTML = h; 
    }; 
}

function playCardConfirm(c) { 
    if(!isDevMode && !isMyTurn) return; 
    const db = CARD_DB[c.dataset.url]; if(!db) return; let cost = db.cost; 
    if(window.sotuTurnState.vinsmokeCostDiscount > 0 && (db.traits||[]).includes("Vinsmoke Family")) { cost = Math.max(0, cost - window.sotuTurnState.vinsmokeCostDiscount); }
    const lifeCount = document.getElementById('life-zone').children.length; 
    if(db.name==="Monkey D. Luffy" && lifeCount<=1) cost-=1; 
    const leaderName = document.querySelector('#leader-zone .card') ? CARD_DB[document.querySelector('#leader-zone .card').dataset.url]?.name : "";
    if(leaderName === "Morgans") { if(db.name === "Front Page Scoop!") cost = 1; if(db.name === "Shocking Revelation!") cost = 4; if(db.name === "Unprecedented Bounties") cost = 8; }
    if(db.name === "Uta" && db.cost === 6) { const has10k = Array.from(document.querySelectorAll('#char-zone-front .card')).some(fc => parseInt(fc.dataset.currentPower||0) >= 10000); if(has10k) cost = Math.max(0, cost - 4); }
    if (window.locked7Plus && cost >= 7 && db.type === 'Character') { showModal("Cannot play Characters with cost 7 or more this turn!", "alert"); return; } 
    showModal(`Play ${db.name} for ${cost} DON!!?`, "confirm", () => { rightClickedCard = c; playCard(false, cost); }); 
}

function playCard(isFree = false, customCost = null) { 
    const c = rightClickedCard; const db = CARD_DB[c.dataset.url]; hideMenu(); let cost = customCost !== null ? customCost : db.cost; 
    if (db.name === "Divine Departure" && !isFree) {
        const activeDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).filter(d => !d.dataset.parentId);
        if(activeDons.length < 5) { showModal("Need 5 active DON!! to use Main.", "alert"); return; }
        showModal("Rest 5 DON!! to use Main effect?", "confirm", () => {
            for(let i=0; i<5; i++) activeDons[i].classList.add('rested');
            TRASH_ARR.push(c.dataset.url); document.getElementById('drop-trash').style.backgroundImage = `url('${c.dataset.url}')`; c.remove();
            if(document.querySelectorAll('[data-parent-id]').length > 0) { startSelection('divine_depart_minus', 1, "Give -8000 Power", (targets) => { targets[0].dataset.tempPower = parseInt(targets[0].dataset.tempPower||0) - 8000; updatePowerDisplay(); saveState(); appendChat("Divine Departure gave -8000 power!", "#8e44ad"); }); } else { appendChat("No attached DON. Effect fails.", "#ccc"); }
        }); return;
    }
    if(!isFree) { const activeDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).filter(d => !d.dataset.parentId); if(activeDons.length < cost) { showModal(`Need ${cost} active DON!!`, "alert"); return; } for(let i=0; i<cost; i++) activeDons[i].classList.add('rested'); } 
    c.classList.remove('card-back'); c.dataset.isLife = "false"; c.style.position = 'relative'; c.dataset.turnPlayed = myTurnCount; 
    if(db.type === 'Event') { 
        TRASH_ARR.push(c.dataset.url); document.getElementById('drop-trash').style.backgroundImage = `url('${c.dataset.url}')`; c.remove(); 
        if(db.name === "Unblockable") { showModal("Select a Character to make Unblockable.", "alert", () => { document.body.classList.add('combat-target-mode'); combatState = {active: true, step: 'unblockable_target'}; }); } 
        if((db.color||[]).includes("Red")) { const hasStussy = Array.from(document.querySelectorAll('#char-zone-front .card')).some(fc => CARD_DB[fc.dataset.url]?.name === "Stussy"); if(hasStussy) { window.batchState.stussyRedEventBuffs++; updatePowerDisplay(); appendChat("Stussy gained +2000 from Red Event!", "#e74c3c"); } }
        if(db.name === "Front Page Scoop!") { performTopDeckSearch(5, ["Big News", "Event"], null, true, true); appendChat("Front Page Scoop activated!", "#e74c3c"); }
        if(db.name === "Shocking Revelation!") { document.querySelectorAll('#char-zone-front .card').forEach(fc => { const fcdb = CARD_DB[fc.dataset.url]; if((fcdb?.traits||[]).includes("Big News")) { fc.dataset.tempPower = parseInt(fc.dataset.tempPower||0) + 2000; fc.dataset.hasRush = "true"; fc.querySelector('.rush-tag').style.display = 'block'; } }); updatePowerDisplay(); appendChat("Shocking Revelation: Big News characters get +2000 and Rush!", "#e74c3c"); }
        if(db.name === "Unprecedented Bounties") { startSelection('play_free_10c', 1, "Play a 10c or less Character", (cards) => { rightClickedCard = cards[0]; playCard(true); }); }
    } else if(db.type === 'Stage') { 
        const bz = document.getElementById('stage-zone'); const fz = document.getElementById('franky-extra-zone'); const leaderCard = document.querySelector('#leader-zone .card'); const leaderName = leaderCard ? CARD_DB[leaderCard.dataset.url]?.name : "";
        if (bz.children.length === 0) { bz.appendChild(c); } else if (leaderName === "Franky" && fz.children.length < 4) { fz.appendChild(c); } else { const maxStages = (leaderName === "Franky") ? 5 : 1; showModal(`Stage area full! (Max ${maxStages}). Trash a Stage to play this?`, "confirm", () => { startSelection('trash_for_play_stage', 1, "Select a Stage to Trash", (cards) => { trashCard(cards[0]); if(bz.children.length === 0) bz.appendChild(c); else fz.appendChild(c); saveState(); setTimeout(() => triggerOnPlay(c, db), 100); }, () => { document.getElementById('hand-bar').appendChild(c); }); }); return; }
    } else { 
        const charZ = document.getElementById('char-zone-front'); 
        if(charZ.children.length >= 5) { showModal("Front line is full! Trash a Character to play this.", "confirm", () => { startSelection('trash_for_play_char', 1, "Select a Character to Trash", (cards) => { trashCard(cards[0]); charZ.appendChild(c); saveState(); setTimeout(() => triggerOnPlay(c, db), 100); }, () => { document.getElementById('hand-bar').appendChild(c); }); }); return; } else { charZ.appendChild(c); }
    } 
    saveState(); setTimeout(() => triggerOnPlay(c, db), 100); 
}

function triggerOnPlay(c, db) {
    if (db.name === "Vinsmoke Niji" && db.cost === 5) { const leaderName = document.querySelector('#leader-zone .card') ? CARD_DB[document.querySelector('#leader-zone .card').dataset.url]?.name : ""; if (leaderName === "Vinsmoke Judge") { showModal("Activate Niji's On Play effect?", "confirm", () => { startSelection('sotu_cost_minus', 1, "Target opponent for -3 Cost", (targets1) => { targets1[0].dataset.tempCost = parseInt(targets1[0].dataset.tempCost || CARD_DB[targets1[0].dataset.url]?.cost || 0) - 3; if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'minus_cost', amount: 3, target: targets1[0].id}); selectConfig = { maxCostTarget: 1 }; startSelection('sotu_trash_low_cost', 1, "Trash an Opponent Character Cost 1 or 0", (targets2) => { if(!isDevMode) socket.emit('game_action', {type: 'request_ko', target: targets2[0].id.replace('opp-', '')}); else trashCard(targets2[0]); selectConfig = { excludeNiji: true }; startSelection('sotu_play_free', 1, "Play 5c or less Character from hand", (targets3) => { rightClickedCard = targets3[0]; playCard(true); appendChat("Niji triggered full sequence!", "#f39c12"); }); }, () => { appendChat("Niji effect stopped after debuff.", "#ccc"); }); }, () => { appendChat("Niji effect skipped.", "#ccc"); }); }); } }
    else if (db.name === "Vinsmoke Reiju" && db.cost === 7) { showModal("Activate 7c Reiju On Play effect?", "confirm", () => { startSelection('sotu_cost_minus', 2, "Target up to 2 for -3 Cost", (targets1) => { targets1.forEach(t => { t.dataset.tempCost = parseInt(t.dataset.tempCost || CARD_DB[t.dataset.url]?.cost || 0) - 3; if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'minus_cost', amount: 3, target: t.id}); }); selectConfig = { maxCostTarget: 4 }; startSelection('sotu_trash_low_cost', 1, "Trash an Opp Character Cost 4 or less", (targets2) => { if(!isDevMode) socket.emit('game_action', {type: 'request_ko', target: targets2[0].id.replace('opp-', '')}); else trashCard(targets2[0]); selectConfig = { maxCostTarget: 1 }; startSelection('sotu_trash_low_cost', 1, "Trash an Opp Character Cost 1 or less", (targets3) => { if(!isDevMode) socket.emit('game_action', {type: 'request_ko', target: targets3[0].id.replace('opp-', '')}); else trashCard(targets3[0]); appendChat("Reiju completely wiped the board!", "#f39c12"); }); }); }); }); }
    else if (db.name === "Vinsmoke Reiju" && db.cost === 4) { const leaderName = document.querySelector('#leader-zone .card') ? CARD_DB[document.querySelector('#leader-zone .card').dataset.url]?.name : ""; if (leaderName === "Vinsmoke Judge") { showModal("Activate 4c Reiju On Play effect?", "confirm", () => { performTopDeckSearch(5, ["GERMA 66"], null, false, false); appendChat("Reiju triggered search and trashed remaining!", "#8e44ad"); }); } }

    const hasLogic = ["Franky (Char)", "Franky Family", "Nami", "Sanji & Pudding", "Bon Clay", "Gol D. Roger", "Brachio Tank V", "Kurosai Fr-U IV"].includes(db.name); 
    if (hasLogic) { showModal(`Activate On Play effect of ${db.name}?`, "confirm", () => { if(db.name === "Franky Family") { startSelection('hand_trash', 1, "Select 1 card from hand to trash", (cards) => { TRASH_ARR.push(cards[0].dataset.url); document.getElementById('drop-trash').style.backgroundImage = `url('${cards[0].dataset.url}')`; cards[0].remove(); spawnDonLocal(true); saveState(); appendChat("Trashed 1, added 1 rested DON!!", "#3498db"); }); } if(db.name === "Franky (Char)") { startSelection('rest_stage', 1, "Select Invention Stage to Rest", (cards) => { cards[0].classList.add('rested'); const sName = CARD_DB[cards[0].dataset.url]?.name; if(sName === "Waver") { spawnDonLocal(true); appendChat("Waver rested: Added 1 rested DON!!", "#3498db"); } else if(sName === "Mini Merry") { drawCardAction(); appendChat("Mini Merry rested: Drew 1 card.", "#3498db"); } saveState(); }); } if(db.name === "Nami") { performTopDeckSearch(5, ["Straw Hat Crew", "Straw Hat Pirates"], null, true, true); } if(db.name === "Sanji & Pudding") { if((10 - DON_DECK_COUNT) <= OPP_DON_TOTAL) drawCardAction(); } if(db.name === "Bon Clay") { spawnDonLocal(false); saveState(); } if(db.name === "Gol D. Roger" && db.cost === 8) { if(document.querySelectorAll('#don-zone .card[data-is-don="true"]').length >= 10 || OPP_DON_TOTAL >= 10) { window.rogerBuffActive = true; window.rogerBuffExpiresTurn = turnNum + 2; updatePowerDisplay(); saveState(); appendChat("Gol D. Roger played: +2000 to Leader until End of Opp's Turn!", "#f39c12");} } if(db.name === "Brachio Tank V") { startSelection('give_rush', 1, "Select Character to give Rush", (cards) => { cards[0].dataset.hasRush = "true"; cards[0].querySelector('.rush-tag').style.display = 'block'; saveState(); appendChat("Gave Rush!", "#f1c40f"); }); } if(db.name === "Kurosai Fr-U IV") { startSelection('play_free_5', 1, "Select cost 5 or lower SHC/SHP to play", (cards) => { rightClickedCard = cards[0]; playCard(true); }); } }); }
    
    if(db.name === "Maha") { const top = document.getElementById('life-zone').lastElementChild; if(top) { top.classList.remove('card-back'); document.getElementById('zoom-img').src = top.dataset.url; document.getElementById('zoom-overlay').style.display='flex'; showModal("Maha: Put Life on Top (YES) or Bottom (NO)?", "confirm", () => { top.classList.add('card-back'); document.getElementById('zoom-overlay').style.display='none'; appendChat("Maha left card on Top of Life.", "#f1c40f"); saveState(); }, () => { top.classList.add('card-back'); document.getElementById('life-zone').prepend(top); updateLifePositions(); document.getElementById('zoom-overlay').style.display='none'; appendChat("Maha moved card to Bottom of Life.", "#f1c40f"); saveState(); }); } }
    if(db.name === "Lilith") { performTopDeckSearch(4, ["Egghead"], null, true, true); }
    if(db.name === "Atlas") { performTopDeckSearch(4, null, null, true, true, 4); }
    if(db.name === "Rob Lucci (G)") { startSelection('lucci_g_rest', 1, "Rest 1 Character", (cards)=>{ cards[0].classList.add('rested'); if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'rest', target: cards[0].id}); const top = document.getElementById('life-zone').lastElementChild; if(top && !top.classList.contains('card-back')) { cards[0].classList.add('no-restand'); cards[0].dataset.noRestand = "true"; if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'no_restand', target: cards[0].id}); appendChat("Lucci rested and locked!", "#2ecc71"); } else { appendChat("Lucci rested a Character!", "#2ecc71"); } saveState(); }); }
    if(db.name === "Doflamingo") { startSelection('doflamingo_lock', 3, "Freeze 3 Rested", (cards)=>{ cards.forEach(card => { card.classList.add('no-restand'); card.dataset.noRestand = "true"; if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'no_restand', target: card.id}); }); saveState(); appendChat("Doflamingo Locked!", "#2ecc71"); }); }
    if(db.name === "Stussy (Char)") { startSelection('play_trigger_5', 1, "Play 5c Trigger from hand", (cards)=>{ rightClickedCard = cards[0]; playCard(true); }); }
    if(db.name === "Monkey D. Luffy" && db.cost === 10 && (db.color||[]).includes("Yellow")) { startSelection('hand_trash', 1, "Trash 1 for +2k Leader & Blocker", (cards)=>{ TRASH_ARR.push(cards[0].dataset.url); cards[0].remove(); c.dataset.luffyBuff = "true"; updatePowerDisplay(); saveState(); appendChat("Luffy gave +2k & Blocker!", "#f1c40f"); }); }
    if(db.name === "Seraphim") { const lifeCount = document.getElementById('life-zone').children.length; if(lifeCount >= 2) { startSelection('hand_trigger', 1, "Select Trigger to stack on Life", (cards)=>{ const top = cards[0]; top.classList.remove('card-back'); top.style.position = 'absolute'; document.getElementById('life-zone').appendChild(top); updateLifePositions(); saveState(); appendChat("Seraphim stacked a Trigger on Life!", "#f1c40f"); }); } }
    if(db.name === "Dracule Mihawk (8c)") { const restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested')).slice(0, 4); restedDons.forEach(d => d.classList.remove('rested')); window.locked7Plus = true; appendChat("Mihawk rested 4 DON!! and locked 7+ cost plays.", "#2ecc71"); saveState(); }
    if(db.name === "Spandam") { startSelection('play_lucci_free', 1, "Play a [Rob Lucci] from hand", (cards) => { rightClickedCard = cards[0]; playCard(true); }); }
    if(db.name === "Charlotte Katakuri" && db.cost === 4) { const myL = document.getElementById('life-zone').children.length; const oppL = document.getElementById('opp-life-zone').children.length; if(myL < oppL) { c.dataset.hasRush = "true"; c.querySelector('.rush-tag').style.display='block'; updatePowerDisplay(); } showModal("Look at top Life card?", "confirm", () => { startSelection('katakuri_life', 1, "Select your Life or Opponent's Life", (cards) => { const target = cards[0]; target.classList.remove('card-back'); document.getElementById('zoom-img').src = target.dataset.url; document.getElementById('zoom-overlay').style.display='flex'; showModal("Put on Top (YES) or Bottom (NO)?", "confirm", () => { target.classList.add('card-back'); document.getElementById('zoom-overlay').style.display='none'; appendChat("Katakuri left card on Top of Life.", "#f1c40f"); saveState(); }, () => { target.classList.add('card-back'); target.parentElement.prepend(target); updateLifePositions(); document.getElementById('zoom-overlay').style.display='none'; appendChat("Katakuri moved card to Bottom of Life.", "#f1c40f"); saveState(); }); }); }); }
    if(db.name === "Franky (Draw)") { showModal("Return 2 DON!! to activate Franky?", "confirm", () => { returnDonAndCheckSanji(2, () => { startSelection('hand_trash', 1, "Discard 1 card to draw 2", (cards) => { TRASH_ARR.push(cards[0].dataset.url); cards[0].remove(); drawCardAction(); drawCardAction(); saveState(); appendChat("Franky drew 2 cards!", "#8e44ad"); }); }); }); }
    if(db.name === "Monkey D. Luffy (Leader Buff)") { showModal("Return 2 DON!! to trigger On Play?", "confirm", () => { returnDonAndCheckSanji(2, () => { const leader = document.querySelector('#leader-zone .card'); if(leader && CARD_DB[leader.dataset.url]?.color.length > 1 && OPP_DON_TOTAL >= 5) { window.batchState.luffy6cBuffActive = true; window.batchState.luffy6cBuffExpires = turnNum + 3; updatePowerDisplay(); saveState(); appendChat("Luffy 6c buffed Leader base power to 7000!", "#8e44ad"); } }); }); }
    if(db.name === "Monkey D. Luffy (Extra Turn)") { showModal("Return 10 DON!! to TAKE AN EXTRA TURN?", "confirm", () => { returnDonAndCheckSanji(10, () => { document.querySelectorAll('#char-zone-front .card').forEach(char => { if(char.id !== c.id) { DECK_ARR.unshift(char.dataset.url); char.remove(); } }); window.batchState.extraTurnActive = true; saveState(); appendChat("10c LUFFY TRIGGERS AN EXTRA TURN!", "#e74c3c"); }); }); }
    if(db.name === "Luffytaro") { showModal("Return 1 DON!! to play 5c from hand?", "confirm", () => { returnDonAndCheckSanji(1, () => { selectConfig = { isLuffytaro: true }; startSelection('play_free_5', 1, "Play 5c or less SHC from hand", (cards) => { rightClickedCard = cards[0]; playCard(true); }); }); }); }
    if(db.name === "Kuzan" && db.cost === 10) { startSelection('kuzan_ko', 1, "K.O. a 0-Cost Opponent Character", (cards) => { if(parseInt(cards[0].dataset.currentCost || 0) === 0) { if(!isDevMode) socket.emit('game_action', {type: 'request_ko', target: cards[0].id.replace('opp-', '')}); else trashCard(cards[0]); appendChat("Kuzan shattered a 0-cost character!", "#34dbdb"); } else { showModal("Target must have current cost 0.", "alert"); } }); }
    if(db.name === "Vinsmoke Reiju (5c)") { showModal("Play 5c or less Vinsmoke from Trash?", "confirm", () => { openInspector('trash', 'play_active', ['Vinsmoke Family', 'GERMA 66']); }); }
    if(db.name === "Vinsmoke Sanji") { performTopDeckSearch(5, ["Vinsmoke Family", "GERMA 66"], null, true, true); }
    if(db.name === "Hanyabal") { performTopDeckSearch(5, ["Impel Down"], null, true, true); }
    if(db.name === "Donquixote Rosinante") { startSelection('hand_trash', 1, "Trash 1 Event to Draw 2", (cards) => { if(CARD_DB[cards[0].dataset.url]?.type === 'Event') { TRASH_ARR.push(cards[0].dataset.url); cards[0].remove(); drawCardAction(); drawCardAction(); appendChat("Rosinante drew 2 cards!", "#8e44ad"); } }); }
    if(db.name === "Sadi") { startSelection('play_free_jailer', 1, "Play 1 Jailer Beast from hand", (cards) => { rightClickedCard = cards[0]; playCard(true); }); }
    if(db.name === "Magellan (10c)") { const restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested')); if(restedDons[0]) restedDons[0].classList.remove('rested'); if(restedDons[1]) restedDons[1].classList.remove('rested'); showModal("Play 1 Jailer Beast from Trash rested?", "confirm", () => { openInspector('trash', 'play_rested', ['Jailer Beast', 'Jailer Beasts']); }); }
    if(db.name === "Silvers Rayleigh") { startSelection('sotu_cost_minus', 1, "Select Character for -3000 Power", (c1) => { c1[0].dataset.rayleighDebuff = "3000"; c1[0].dataset.rayleighExpires = turnNum + 3; startSelection('sotu_cost_minus', 1, "Select Character for -2000 Power", (c2) => { c2[0].dataset.rayleighDebuff = "2000"; c2[0].dataset.rayleighExpires = turnNum + 3; updatePowerDisplay(); startSelection('sotu_cost_minus', 1, "Select 3000 power or less to K.O.", (c3) => { if(parseInt(c3[0].dataset.currentPower || 0) <= 3000) { trashCard(c3[0]); appendChat("Rayleigh shattered a weakened enemy!", "#e74c3c"); } }); }); }); }
    if(db.name === "Benn Beckman") { startSelection('sotu_cost_minus', 1, "Select 6000 power or less to K.O.", (cards) => { if(parseInt(cards[0].dataset.currentPower || 0) <= 6000) { trashCard(cards[0]); appendChat("Beckman K.O.'d an enemy!", "#e74c3c"); } }); }
    if(db.name === "Saldeath") { startSelection('hand_trash', 1, "Trash 1 card to add 1 rested DON", (cards) => { TRASH_ARR.push(cards[0].dataset.url); cards[0].remove(); spawnDonLocal(true); appendChat("Saldeath ramped 1 DON!", "#8e44ad"); }); }
    if(db.name === "News Lackey") { startSelection('play_free_bignews', 1, "Play 7c or less Big News card", (cards) => { rightClickedCard = cards[0]; window.batchState.leaderCannotAttack = true; playCard(true); appendChat("News Lackey played an event. Leader cannot attack.", "#f39c12"); }); }
    if(db.name === "Morgans (5c)") { showModal("Play 7c Event (YES) or Shocking Revelation from Trash (NO)?", "confirm", () => { startSelection('play_free_bignews', 1, "Play Event from Hand", (cards) => { rightClickedCard = cards[0]; drawCardAction(); playCard(true); }); }, () => { openInspector('trash'); }); }
}

function updatePowerDisplay() {
    let hasGenFranky = Array.from(document.querySelectorAll('#char-zone-front .card')).some(c => CARD_DB[c.dataset.url]?.name === "General Franky");
    const luffy = Array.from(document.querySelectorAll('#char-zone-front .card')).find(c => CARD_DB[c.dataset.url]?.name === "Monkey D. Luffy");
    let is4cYonjiProtected = false; 
    const myBoard = Array.from(document.querySelectorAll('#char-zone-front .card'));
    if(myBoard.length > 0) { is4cYonjiProtected = myBoard.every(c => (CARD_DB[c.dataset.url]?.traits||[]).includes("GERMA 66")); }
    
    document.querySelectorAll('.card').forEach(c => { 
        const db = CARD_DB[c.dataset.url] || {}; 
        let isOppCard = c.id.startsWith('opp-'); let zone = c.parentElement.id; let onField = zone === 'char-zone-front' || zone === 'leader-zone' || zone === 'opp-char-zone-front' || zone === 'opp-leader-zone';

        const rushT = c.querySelector('.rush-tag'); const banishT = c.querySelector('.banish-tag'); const doubleT = c.querySelector('.double-attack-tag'); const blockerT = c.querySelector('.blocker-tag');
        if(rushT) rushT.style.display = (onField && (db.rush || c.dataset.hasRush === "true")) ? 'block' : 'none';
        if(banishT) banishT.style.display = (onField && (db.banish || c.dataset.banish === "true")) ? 'block' : 'none';
        if(doubleT) doubleT.style.display = (onField && (db.doubleAttack || c.dataset.doubleAttack === "true")) ? 'block' : 'none';

        let hasBlocker = db.blocker;
        if(db.name === "Rob Lucci (Y)") { const lifeZ = isOppCard ? 'opp-life-zone' : 'life-zone'; if(document.getElementById(lifeZ) && document.getElementById(lifeZ).children.length <= 1) hasBlocker = true; }
        if(db.name === "Monkey D. Luffy" && c.dataset.luffyBuff === "true") hasBlocker = true;
        if(db.name === "Spandam") hasBlocker = true;
        if(!isOppCard && db.name === "Vinsmoke Yonji" && db.cost === 4 && is4cYonjiProtected) { c.style.boxShadow = "0 0 20px #3498db"; c.style.outline = "2px solid #3498db"; }

        if(db.power !== undefined) { 
            let base = db.power; 
            if(!isOppCard && zone === 'leader-zone' && (db.traits||[]).includes("Straw Hat Crew") && window.batchState.luffy6cBuffActive) { base = Math.max(base, 7000); }
            let attachedDon = document.querySelectorAll(`[data-parent-id="${c.id}"]`).length; 
            let donBoost = 0; if (!isOppCard && isMyTurn) donBoost = attachedDon * 1000; if (isOppCard && !isMyTurn) donBoost = attachedDon * 1000;
            let temp = parseInt(c.dataset.tempPower || 0); let passiveBoost = 0;
            
            if (zone === 'leader-zone' || zone === 'opp-leader-zone') { 
                if(db.name === "Franky" && hasGenFranky && !isOppCard) passiveBoost += 2000; 
                if(window.rogerBuffActive && !isOppCard) passiveBoost += 2000; 
                if(luffy && luffy.dataset.luffyBuff === "true" && !isOppCard) passiveBoost += 2000; 
            } 
            if(!isOppCard && window.sotuTurnState.judgeGlobalPowerBuff > 0 && (db.traits||[]).includes("GERMA 66")) { passiveBoost += window.sotuTurnState.judgeGlobalPowerBuff; }
            if(db.name === "Tony Tony Chopper" && db.cost === 4) { if((!isOppCard && !isMyTurn) || (isOppCard && isMyTurn)) passiveBoost += 2000; }
            if(db.name === "Vinsmoke Family" && db.cost === 4 && onField && !isOppCard && isMyTurn) { let trashFactor = Math.floor(TRASH_ARR.length / 5); passiveBoost += (trashFactor * 1000); }
            if(db.name === "Stussy" && db.cost === 6 && !isOppCard && isMyTurn) { passiveBoost += (window.batchState.stussyRedEventBuffs * 2000); }
            if(c.dataset.reijuBuffExpires && turnNum < parseInt(c.dataset.reijuBuffExpires)) { passiveBoost -= 1000; c.dataset.tempCost = db.cost + 5; hasBlocker = true; }
            if(onField && isOppCard && isMyTurn) { const hasShanks = Array.from(document.querySelectorAll('#char-zone-front .card')).some(fc => CARD_DB[fc.dataset.url]?.name === "Shanks"); if(hasShanks) passiveBoost -= 1000; }
            if(onField && !isOppCard && !isMyTurn) { const oppHasShanks = Array.from(document.querySelectorAll('#opp-char-zone-front .card')).some(fc => CARD_DB[fc.dataset.url]?.name === "Shanks"); if(oppHasShanks) passiveBoost -= 1000; }
            if(c.dataset.rayleighDebuff && turnNum < parseInt(c.dataset.rayleighExpires)) { passiveBoost -= parseInt(c.dataset.rayleighDebuff); }
            if((db.traits||[]).includes("Jailer Beast") || (db.traits||[]).includes("Jailer Beasts")) { if(window.batchState.magellanBuffActive) { passiveBoost += (window.batchState.donReturnedCount * 1000); } }

            let totalBoost = donBoost + temp + passiveBoost;
            c.dataset.currentPower = base + totalBoost; 
            let badge = c.querySelector('.power-badge');
            if(badge) { if(totalBoost !== 0) { badge.innerText = totalBoost > 0 ? `+${totalBoost}` : `${totalBoost}`; badge.classList.remove('hidden'); } else { badge.classList.add('hidden'); } }

            let kuzanCostDebuff = 0; let vinsmokeCostDebuff = 0;
            if(onField && isMyTurn && isOppCard) {
                const hasKuzan = Array.from(document.querySelectorAll('#char-zone-front .card')).some(fc => CARD_DB[fc.dataset.url]?.name === "Kuzan" && CARD_DB[fc.dataset.url]?.cost === 10);
                if(hasKuzan) kuzanCostDebuff = 5;
                let maxVinsmokeTrash = 0; document.querySelectorAll('#char-zone-front .card').forEach(fc => { if(CARD_DB[fc.dataset.url]?.name === "Vinsmoke Family" && CARD_DB[fc.dataset.url]?.cost === 4) { maxVinsmokeTrash = Math.max(maxVinsmokeTrash, Math.floor(TRASH_ARR.length / 5)); } }); vinsmokeCostDebuff = maxVinsmokeTrash;
            }
            c.dataset.currentCost = Math.max(0, parseInt(c.dataset.tempCost || db.cost || 0) - kuzanCostDebuff - vinsmokeCostDebuff);
        } 
        if(blockerT) blockerT.style.display = (onField && hasBlocker) ? 'block' : 'none';
    });
}

function saveState() {
    if(isDevMode) { updatePowerDisplay(); return; } 
    organizeDon(); updatePowerDisplay();
    let currentMat = document.getElementById('my-board').style.backgroundImage; let cleanPlaymatUrl = currentMat ? currentMat.replace(/(url\(|\)|"|')/g, '') : 'https://i.imgur.com/SSN1DUI.jpeg';
    const field = Array.from(document.querySelectorAll('#my-board .card:not(#drop-deck):not(#don-deck)')).map(c => ({ id: c.id, url: c.dataset.url, zone: c.parentElement.id, isDon: c.dataset.isDon, isLife: c.dataset.isLife, parentId: c.dataset.parentId, rested: c.classList.contains('rested'), back: c.classList.contains('card-back'), tempPower: c.dataset.tempPower || 0, tempCost: c.dataset.tempCost || 0, unblockable: c.dataset.unblockable || false, rush: (c.dataset.hasRush === "true"), banish: (c.dataset.banish === "true"), doubleAttack: (c.dataset.doubleAttack === "true"), turnPlayed: c.dataset.turnPlayed, frozen: c.classList.contains('frozen'), frozenUntil: c.dataset.frozenUntil, noRestand: c.dataset.noRestand }));
    socket.emit('board_update', { deck: DECK_ARR.length, trash: TRASH_ARR.length, don: DON_DECK_COUNT, totalDon: 10 - DON_DECK_COUNT, field, handCount: document.querySelectorAll('#hand-bar .card').length, playmat: cleanPlaymatUrl }); 
    refreshStats();
}

window.addEventListener('mousedown', (e) => { 
    if(!e.target.closest('#context-menu') && !e.target.closest('#search-modal') && !e.target.closest('#custom-modal-box')) hideMenu(); 
    if (combatState.step === 'wait_counter') { e.stopPropagation(); e.preventDefault(); return; } 
}, true);
function hideMenu() { document.getElementById('context-menu').style.display = 'none'; }

window.addEventListener('mousemove', (e) => { 
    if (!dragged || selectConfig || combatState.step === 'counter' || combatState.step === 'wait_counter') return; 
    if(!isDragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) { isDragging = true; if(dragged.parentElement.id !== 'viewport') { document.getElementById('viewport').appendChild(dragged); dragged.style.position = 'absolute'; } } 
    if(isDragging) { dragged.style.left = (e.clientX - offX - 250) + 'px'; dragged.style.top = (e.clientY - offY) + 'px'; dragged.style.zIndex = 5000; document.querySelectorAll(`[data-parent-id="${dragged.id}"]`).forEach((don, i) => { don.style.setProperty('position', 'absolute', 'important'); don.style.setProperty('left', (e.clientX - offX - 250 + 5 + (i*8)) + 'px', 'important'); don.style.setProperty('top', (e.clientY - offY + 15 + (i*15)) + 'px', 'important'); don.style.setProperty('z-index', (10 - i).toString(), 'important'); }); } 
});

window.addEventListener('mouseup', (e) => { 
    if (!dragged || combatState.step === 'counter' || combatState.step === 'wait_counter') return; 
    const c = dragged; dragged = null; 
    if(!isDragging) { if(c.parentElement.id === 'hand-bar') playCardConfirm(c); return; } 
    if (c.dataset.isDon === "true") { let attached = false; const targets = document.querySelectorAll('#char-zone-front .card, #leader-zone .card'); targets.forEach(t => { if (t.dataset.isDon !== "true" && !t.id.includes('opp-')) { const r = t.getBoundingClientRect(); if (isInside(e, r)) { c.dataset.parentId = t.id; updateBadges(t.id); organizeDon(); saveState(); attached = true; } } }); if (attached) return; }
    if (isDevMode && c.dataset.isDon !== "true") { const charR = document.getElementById('char-zone-front').getBoundingClientRect(); const stageR = document.getElementById('stage-zone').getBoundingClientRect(); if (isInside(e, charR)) { document.getElementById('char-zone-front').appendChild(c); c.style.position = 'relative'; c.style.left = '0'; c.style.top = '0'; saveState(); return; } if (isInside(e, stageR)) { document.getElementById('stage-zone').appendChild(c); c.style.position = 'relative'; c.style.left = '0'; c.style.top = '0'; saveState(); return; } }
    c.style.zIndex = 20; const handR = document.getElementById('hand-bar').getBoundingClientRect(); if (isInside(e, handR)) { if(c.dataset.origZone !== 'hand-bar' && isDevMode) toHand(c); else snapBack(c); } else { snapBack(c); } 
});

// --- COMBAT & HELPERS (Formerly combat.js) ---
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
    dons.forEach((d, i) => { donZone.appendChild(d); d.style.position = 'relative'; d.style.left = '0'; d.style.top = '0'; });
}

function updateLifePositions() {
    const lifeZone = document.getElementById('life-zone');
    Array.from(lifeZone.children).forEach((c, i) => { c.style.position = 'absolute'; c.style.top = (i * 10) + 'px'; c.style.left = (i * 2) + 'px'; c.style.zIndex = i; });
}

function moveToTrash(c) { TRASH_ARR.push(c.dataset.url); document.getElementById('drop-trash').style.backgroundImage = `url('${c.dataset.url}')`; c.remove(); refreshStats(); }
function trashCard(c) { if(c.id.includes('opp-')) c.remove(); else moveToTrash(c); }

function updateBadges(parentId) {
    const p = document.getElementById(parentId); if(!p) return;
    const count = document.querySelectorAll(`[data-parent-id="${parentId}"]`).length;
    let b = p.querySelector('.don-badge');
    if(b) { if(count > 0) { b.innerText = count; b.style.display = 'flex'; } else { b.style.display = 'none'; } }
}

function snapBack(c) { const orig = document.getElementById(c.dataset.origZone); if(orig) { orig.appendChild(c); c.style.position = (orig.id === 'life-zone') ? 'absolute' : 'relative'; c.style.left = '0'; c.style.top = '0'; if(orig.id === 'life-zone') updateLifePositions(); saveState(); } }
function isInside(e, r) { return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; }
function toHand(c) { c.dataset.isLife="false"; c.classList.remove('card-back'); c.style.position='relative'; document.getElementById('hand-bar').appendChild(c); saveState(); }

function drawCardAction() { if (DECK_ARR.length === 0) { showModal("Deck out! You lose.", "alert"); return; } createCard(DECK_ARR.shift(), 0, 0, {inHand: true}); refreshStats(); }
function spawnDonLocal(isRested = false) { if (DON_DECK_COUNT <= 0) return; DON_DECK_COUNT--; const d = createCard(DON_URL, 0, 0, {zone: 'don-zone'}); if (isRested) d.classList.add('rested'); organizeDon(); refreshStats(); }
function killDon() { const dons = document.querySelectorAll('#my-board .card[data-is-don="true"]'); if (dons.length > 0) { dons[dons.length - 1].remove(); DON_DECK_COUNT++; organizeDon(); refreshStats(); saveState(); } }
function deckToLife() { if (DECK_ARR.length === 0) return; const url = DECK_ARR.shift(); const c = createCard(url, 0, 0, {isLife: true, isBack: true}); c.style.position = 'absolute'; document.getElementById('life-zone').appendChild(c); updateLifePositions(); }

function simulateAttack() {
    hideMenu(); if (!rightClickedCard) return; const att = rightClickedCard; att.classList.add('rested');
    document.body.classList.add('combat-target-mode');
    combatState = { active: true, attackerId: att.id, step: 'select_target' };
    document.querySelectorAll('#opp-char-zone-front .card, #opp-leader-zone .card').forEach(c => { if (c.parentElement.id === 'opp-leader-zone' || c.classList.contains('rested') || att.dataset.unblockable === "true") { c.classList.add('valid-attack-target'); } });
    appendChat("Select a target to attack!", "#e74c3c"); saveState();
}

window.addEventListener('mousedown', (e) => {
    if(combatState.step === 'select_target' && e.target.closest('.valid-attack-target')) {
        const target = e.target.closest('.card');
        document.querySelectorAll('.valid-attack-target').forEach(c => c.classList.remove('valid-attack-target'));
        document.body.classList.remove('combat-target-mode');
        combatState.defenderId = target.id;
        const att = document.getElementById(combatState.attackerId);
        let isUnblockable = (att.dataset.unblockable === "true");
        socket.emit('game_action', { type: 'declare_attack', attackerId: att.id, defenderId: target.id, attackerPower: att.dataset.currentPower, unblockable: isUnblockable.toString() });
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
        askCounterPhase(); saveState();
    }
});

function openArena(attId, defId, statusMsg) {
    const arena = document.getElementById('combat-arena'); arena.style.display = 'flex';
    const att = document.getElementById(attId); const def = document.getElementById(defId);
    document.getElementById('arena-att-img').style.backgroundImage = att ? att.style.backgroundImage : 'none';
    document.getElementById('arena-att-pow').innerText = att ? (att.dataset.currentPower || 0) : 0;
    document.getElementById('arena-def-img').style.backgroundImage = def ? def.style.backgroundImage : 'none';
    document.getElementById('arena-def-pow').innerText = def ? (def.dataset.currentPower || 0) : 0;
    document.getElementById('arena-status').innerText = statusMsg; document.getElementById('arena-math').innerText = "";
}

function askCounterPhase() { combatState.step = 'counter'; currentCounterTotal = 0; selectedCounterCards = []; document.getElementById('arena-status').innerText = "Counter Phase! Select cards from hand."; document.getElementById('counter-controls').style.display = 'flex'; document.body.classList.add('counter-mode'); }
function updateArenaCounter(val) { const defBase = parseInt(document.getElementById('arena-def-pow').innerText.split('+')[0] || 0); document.getElementById('arena-def-pow').innerText = `${defBase} + ${val}`; document.getElementById('arena-math').innerText = `Total Defense: ${defBase + val}`; }
function confirmCounter() { selectedCounterCards.forEach(c => { TRASH_ARR.push(c.dataset.url); c.remove(); }); document.body.classList.remove('counter-mode'); document.getElementById('counter-controls').style.display = 'none'; const def = document.getElementById(combatState.defenderId); let finalPow = parseInt(def.dataset.currentPower || 0) + currentCounterTotal; socket.emit('game_action', { type: 'counter_declared', counterValue: currentCounterTotal, finalDefPower: finalPow }); executeCombatResolution(currentCounterTotal, finalPow); refreshStats(); }
function takeHit() { document.body.classList.remove('counter-mode'); document.getElementById('counter-controls').style.display = 'none'; selectedCounterCards.forEach(c => c.style.outline = ""); const def = document.getElementById(combatState.defenderId); socket.emit('game_action', { type: 'counter_declared', counterValue: 0, finalDefPower: parseInt(def.dataset.currentPower || 0) }); executeCombatResolution(0, parseInt(def.dataset.currentPower || 0)); }

function executeCombatResolution(counterVal, finalDefPow) {
    const att = document.getElementById(combatState.attackerId); const def = document.getElementById(combatState.defenderId);
    if(!att || !def) { clearCombatState(); return; }
    let attPow = parseInt(att.dataset.currentPower || 0);
    document.getElementById('arena-status').innerText = (attPow >= finalDefPow) ? "ATTACK SUCCESS!" : "DEFENDED!";
    document.getElementById('arena-status').style.color = (attPow >= finalDefPow) ? "#e74c3c" : "#2ecc71";
    setTimeout(() => {
        if(attPow >= finalDefPow) {
            let isBanish = att.dataset.banish === "true"; let isDouble = att.dataset.doubleAttack === "true";
            if(def.parentElement.id.includes('leader-zone')) { if(isMyTurn) socket.emit('game_action', {type: 'resolve_life', banish: isBanish, double: isDouble}); else handleLifeDamage(isBanish, isDouble); } 
            else { if(isMyTurn && !def.id.includes('opp-')) trashCard(def); else if(isMyTurn && def.id.includes('opp-')) socket.emit('game_action', {type: 'resolve_kill', target: def.id}); }
        }
        setTimeout(() => { clearCombatState(); socket.emit('game_action', {type: 'clear_combat'}); saveState(); }, 1500);
    }, 1000);
}

function clearCombatState() { combatState = { active: false, attackerId: null, defenderId: null, step: null }; document.getElementById('combat-arena').style.display = 'none'; document.getElementById('counter-controls').style.display = 'none'; document.body.classList.remove('counter-mode'); document.body.classList.remove('blocker-target-mode'); document.body.classList.remove('combat-target-mode'); document.querySelectorAll('.valid-attack-target').forEach(c => c.classList.remove('valid-attack-target')); document.querySelectorAll('.valid-blocker').forEach(c => c.classList.remove('valid-blocker')); }
function handleLifeDamage(isBanish, isDouble) {
    const lifeZone = document.getElementById('life-zone');
    if(lifeZone.children.length === 0) { socket.emit('game_action', {type: 'game_over'}); showModal("YOU LOSE!", "alert", () => window.location.reload()); return; }
    let dmg = isDouble ? 2 : 1;
    for(let i=0; i<dmg; i++) {
        if(lifeZone.children.length > 0) {
            const c = lifeZone.lastElementChild;
            if(isBanish) { moveToTrash(c); appendChat("Life Banished!", "#8e44ad"); } 
            else { toHand(c); const db = CARD_DB[c.dataset.url]; if(db && db.hasTrigger) { showModal(`TRIGGER available: ${db.name}. Reveal and use?`, "confirm", () => { socket.emit('game_action', {type: 'reveal_card', url: c.dataset.url}); appendChat(`You used Trigger: ${db.name}!`, "#f1c40f"); }); } else { appendChat("Took 1 damage to hand.", "#e74c3c"); } }
        }
    } saveState();
}
function requestKO(targetId) { hideMenu(); socket.emit('game_action', {type: 'request_ko', target: targetId.replace('opp-', '')}); appendChat("Requested opponent to trash Character.", "#8e44ad"); }
function activateMain() { hideMenu(); const db = CARD_DB[rightClickedCard.dataset.url]; appendChat(`Activated Main: ${db.name}`, "#f39c12"); }

let eotQueue = [];
function processEndOfTurn() {
    eotQueue = [];
    const leader = document.querySelector('#leader-zone .card'); const leaderName = leader ? CARD_DB[leader.dataset.url]?.name : ""; const field = Array.from(document.querySelectorAll('#my-board .card'));
    if(window.batchState.blackMariaUsed) { eotQueue.push((next) => { let myDon = document.querySelectorAll('#my-board .card[data-is-don="true"]').length; let diff = myDon - OPP_DON_TOTAL; if(diff > 0) { const dons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]')); for(let i=0; i<diff && i<dons.length; i++) { dons[i].remove(); DON_DECK_COUNT++; } organizeDon(); refreshStats(); appendChat("Black Maria auto-returned " + Math.min(diff, dons.length) + " DON!!", "#8e44ad"); } next(); }); }
    if(leaderName === "Franky") { eotQueue.push((next) => { showModal("EOT: Franky Leader - Look at top 5 for Straw Hat type?", "confirm", () => { performTopDeckSearch(5, ["Straw Hat Crew", "Straw Hat Pirates"], null, true, true, null, () => { appendChat("Franky End of Turn Search Complete.", "#f39c12"); next(); }); }, () => next()); }); }
    const saldeaths = field.filter(c => CARD_DB[c.dataset.url]?.name === "Saldeath" && !c.classList.contains('rested') && c.parentElement.id === 'char-zone-front');
    saldeaths.forEach(sal => { eotQueue.push((next) => { showModal("EOT: Rest Saldeath to set 2 DON active?", "confirm", () => { sal.classList.add('rested'); let restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested')); if(restedDons[0]) restedDons[0].classList.remove('rested'); if(restedDons[1]) restedDons[1].classList.remove('rested'); appendChat("Saldeath set 2 DON active!", "#8e44ad"); saveState(); next(); }, () => next()); }); });
    const rosinantes = field.filter(c => CARD_DB[c.dataset.url]?.name === "Donquixote Rosinante" && c.parentElement.id === 'char-zone-front');
    rosinantes.forEach(ros => { eotQueue.push((next) => { showModal("EOT: Rosinante - Set 2 rested DON active?", "confirm", () => { let restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested')); if(restedDons[0]) restedDons[0].classList.remove('rested'); if(restedDons[1]) restedDons[1].classList.remove('rested'); appendChat("Rosinante set 2 DON active!", "#8e44ad"); saveState(); next(); }, () => next()); }); });
    const katakuris = field.filter(c => CARD_DB[c.dataset.url]?.name === "Charlotte Katakuri (8c)" && c.parentElement.id === 'char-zone-front');
    katakuris.forEach(kat => { eotQueue.push((next) => { showModal("EOT: Katakuri (8c) - Set up to 2 Big Mom Pirates active & add 1 rested DON?", "confirm", () => { spawnDonLocal(true); let bmChars = Array.from(document.querySelectorAll('#char-zone-front .card.rested')).filter(c => { let db = CARD_DB[c.dataset.url]; return db && (db.traits||[]).includes("Big Mom Pirates") && (db.cost >= 3); }); if(bmChars[0]) bmChars[0].classList.remove('rested'); if(bmChars[1]) bmChars[1].classList.remove('rested'); appendChat("Katakuri set characters active and ramped 1 rested DON!", "#8e44ad"); saveState(); next(); }, () => next()); }); });
    const sharks = field.filter(c => CARD_DB[c.dataset.url]?.name === "Shark Submerge III" && c.classList.contains('rested') && (c.parentElement.id === 'stage-zone' || c.parentElement.id === 'franky-extra-zone'));
    sharks.forEach(sh => { eotQueue.push((next) => { let restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested')); if(restedDons.length > 0) { if(restedDons[0]) restedDons[0].classList.remove('rested'); if(restedDons[1]) restedDons[1].classList.remove('rested'); appendChat("Shark Submerge III set 2 DON active!", "#3498db"); saveState(); } next(); }); });
    runNextEOT();
}
function runNextEOT() { if(eotQueue.length > 0) { let func = eotQueue.shift(); func(runNextEOT); } else { finishEndTurn(); } }
function finishEndTurn() { isMyTurn = false; document.querySelectorAll('[data-restand-at-eot="true"]').forEach(c => { c.classList.remove('rested'); c.dataset.restandAtEOT = "false"; }); if (!isDevMode) { socket.emit('game_action', { type: 'end_turn' }); } else { handleTurnStartLogic(); } updateTurnUI(); }
function endTurn() { if (!isMyTurn && !isDevMode) return; processEndOfTurn(); }

function handleTurnStartLogic() {
    myTurnCount++; turnNum++;
    window.leaderUsedThisTurn = false; window.magellanDefensiveUsed = false; window.stussyUsedThisTurn = false; window.locked7Plus = false; window.sotuTurnState.vinsmokeCostDiscount = 0; window.sotuTurnState.judgeGlobalPowerBuff = 0; window.batchState.stussyRedEventBuffs = 0; window.batchState.leaderCannotAttack = false; window.batchState.blackMariaUsed = false;
    let frozenDon = window.batchState.zoroFrozenDonCount; window.batchState.zoroFrozenDonCount = 0;
    
    document.querySelectorAll('#my-board .card.rested').forEach(c => { if (c.dataset.noRestand === "true") { c.dataset.noRestand = "false"; c.classList.remove('no-restand'); return; } if (c.dataset.isDon === "true" && frozenDon > 0) { frozenDon--; return; } c.classList.remove('rested'); });
    document.querySelectorAll('#my-board .card[data-is-don="true"]').forEach(d => { if (d.dataset.parentId) { d.dataset.parentId = ""; d.classList.remove('rested'); document.getElementById('don-zone').appendChild(d); } });
    if (myTurnCount > 1 || !isFirst) { drawCardAction(); }
    let donsToAdd = (myTurnCount === 1 && isFirst) ? 1 : 2;
    for (let i = 0; i < donsToAdd; i++) { if (DON_DECK_COUNT > 0) spawnDonLocal(false); }
    updateTurnUI(); organizeDon(); updatePowerDisplay(); saveState();
}

function performTopDeckSearch(numToLook, validTraits, avoidNameStr, addRestToHand, toBottom, minCostTarget = null, onCompleteCallback = null) {
    if(DECK_ARR.length === 0) { if(onCompleteCallback) onCompleteCallback(); return; }
    let actualNum = Math.min(numToLook, DECK_ARR.length); let lookCards = [];
    for(let i=0; i<actualNum; i++) lookCards.push(DECK_ARR.shift());
    document.getElementById('search-modal').style.display = 'flex';
    const grid = document.getElementById('insp-grid'); grid.innerHTML = '';
    
    let targetSelected = false;
    const closeBtn = document.getElementById('search-modal-close-btn');
    const oldCloseClick = closeBtn.onclick;
    closeBtn.onclick = () => {
        if(toBottom) { lookCards.forEach(u => DECK_ARR.push(u)); } else { lookCards.forEach(u => TRASH_ARR.push(u)); if(TRASH_ARR.length > 0) document.getElementById('drop-trash').style.backgroundImage = `url('${TRASH_ARR[TRASH_ARR.length-1]}')`; }
        document.getElementById('search-modal').style.display = 'none'; closeBtn.onclick = oldCloseClick; 
        refreshStats(); saveState(); if(onCompleteCallback) onCompleteCallback();
    };

    lookCards.forEach((url, index) => {
        const div = document.createElement('div'); div.className = 'card'; div.style.backgroundImage = `url('${url}')`;
        const db = CARD_DB[url]; let isMatch = true;
        if (validTraits && !validTraits.some(t => (db?.traits||[]).includes(t)) && !validTraits.includes(db?.type)) isMatch = false;
        if (avoidNameStr && db?.name === avoidNameStr) isMatch = false;
        if (minCostTarget !== null && (db?.cost || 0) < minCostTarget) isMatch = false;

        if (isMatch) {
            div.style.outline = "3px solid #2ecc71"; div.style.boxShadow = "0 0 20px #2ecc71";
            div.onclick = () => {
                targetSelected = true; const selectedUrl = lookCards.splice(index, 1)[0];
                createCard(selectedUrl, 0, 0, {inHand: true});
                if(toBottom) { lookCards.forEach(u => DECK_ARR.push(u)); } else { lookCards.forEach(u => TRASH_ARR.push(u)); if(TRASH_ARR.length > 0) document.getElementById('drop-trash').style.backgroundImage = `url('${TRASH_ARR[TRASH_ARR.length-1]}')`; }
                document.getElementById('search-modal').style.display = 'none'; closeBtn.onclick = oldCloseClick; 
                refreshStats(); saveState(); if(onCompleteCallback) onCompleteCallback();
            };
        } else {
            div.style.filter = "brightness(0.4)"; div.style.cursor = "not-allowed"; div.onclick = () => { showModal("Invalid target for this search.", "alert"); };
        }
        grid.appendChild(div);
    });
}

function openStructuredSearch(num, traits, avoidNameStr, addRestToHand = true, toBottom = true) { performTopDeckSearch(num, traits, avoidNameStr, addRestToHand, toBottom); }

function startSelection(type, count, msg, onComplete, onCancel) {
    selectConfig = { type, count, onComplete, onCancel, selected: [] };
    document.getElementById('select-msg').style.display = 'flex';
    document.getElementById('select-text').innerText = msg;
    document.body.classList.add('select-mode');
}

function handleSelection(c) {
    if(!selectConfig) return;
    if (selectConfig.type.includes('target') || selectConfig.type.includes('ko') || selectConfig.type.includes('minus') || selectConfig.type.includes('rest')) { if (!c.id.includes('opp-')) return showModal("Must select an opponent's card.", "alert"); }
    if (selectConfig.type.includes('hand')) { if (c.parentElement.id !== 'hand-bar') return showModal("Must select from your hand.", "alert"); }
    if (selectConfig.type === 'rest_active_don' || selectConfig.type === 'return_don') { if (c.dataset.isDon !== "true" || c.classList.contains('rested') || c.dataset.parentId) return showModal("Must select an active, unattached DON!!", "alert"); }
    
    c.style.outline = "4px solid #f1c40f"; selectConfig.selected.push(c);
    if (selectConfig.selected.length >= selectConfig.count) {
        let callback = selectConfig.onComplete; let selectedItems = [...selectConfig.selected];
        cancelSelection(); if (callback) callback(selectedItems);
    }
}

function cancelSelection() {
    if (selectConfig && selectConfig.onCancel) selectConfig.onCancel();
    if (selectConfig) { selectConfig.selected.forEach(c => c.style.outline = ""); }
    selectConfig = null;
    document.getElementById('select-msg').style.display = 'none';
    document.body.classList.remove('select-mode');
}

function returnDonAndCheckSanji(count, callback) {
    const activeDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]')).filter(d => !d.dataset.parentId);
    if (activeDons.length < count) { showModal(`Need ${count} unattached DON!! on the field to return.`, "alert"); return; }
    startSelection('return_don', count, `Select ${count} DON!! to return`, (dons) => {
        dons.forEach(d => { d.remove(); DON_DECK_COUNT++; });
        window.batchState.donReturnedCount += count; window.batchState.donReturnedThisTurn = true;
        organizeDon(); refreshStats(); saveState(); if (callback) callback();
    });
}

function openInspector(type, param, reqTraits) {
    document.getElementById('search-modal').style.display = 'flex';
    const grid = document.getElementById('insp-grid'); grid.innerHTML = '';
    let sourceArr = type === 'trash' ? TRASH_ARR : DECK_ARR;
    sourceArr.forEach((url, i) => {
        const div = document.createElement('div'); div.className = 'card'; div.style.backgroundImage = `url('${url}')`;
        div.onclick = () => {
            if (param === 'play_rested') {
                if (reqTraits && !reqTraits.some(t => (CARD_DB[url]?.traits||[]).includes(t))) return showModal("Invalid trait.", "alert");
                createCard(sourceArr.splice(i, 1)[0], 0, 0, {zone: 'char-zone-front'}).classList.add('rested');
            } else if (param === 'play_active') {
                if (reqTraits && !reqTraits.some(t => (CARD_DB[url]?.traits||[]).includes(t))) return showModal("Invalid trait.", "alert");
                createCard(sourceArr.splice(i, 1)[0], 0, 0, {zone: 'char-zone-front'});
            }
            document.getElementById('search-modal').style.display = 'none'; saveState();
        };
        grid.appendChild(div);
    });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
}
