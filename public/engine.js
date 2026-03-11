// ==========================================
// CORE ENGINE - PART 1 (GLOBALS, LOBBY, UI)
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

// --- TRACKING STATES ---
window.sanjiUsedThisTurn = false; window.rogerBuffActive = false; window.rogerBuffExpiresTurn = 0; window.tempSearchCallback = null; window.locked7Plus = false; 
window.leaderUsedThisTurn = false; window.magellanDefensiveUsed = false; window.stussyUsedThisTurn = false;
window.sotuTurnState = { vinsmokeCostDiscount: 0, judgeGlobalPowerBuff: 0 };
window.batchState = { luffy6cBuffActive: false, luffy6cBuffExpires: 0, extraTurnActive: false, blackMariaUsed: false, zoroFrozenDonCount: 0, donReturnedCount: 0, donReturnedThisTurn: false, magellanBuffActive: false, leaderCannotAttack: false, stussyRedEventBuffs: 0 };

let savedAlign = JSON.parse(localStorage.getItem('opcg_align') || "{}"); for (const [key, val] of Object.entries(savedAlign)) { root.style.setProperty(key, val); }
socket.on('global_align_update', (alignData) => { if (alignData && Object.keys(alignData).length > 0) { savedAlign = alignData; localStorage.setItem('opcg_align', JSON.stringify(savedAlign)); for (const [key, val] of Object.entries(savedAlign)) { root.style.setProperty(key, val); } } });

try { const raw = localStorage.getItem('opcg_decks'); savedDecks = raw ? JSON.parse(raw) : []; if (!Array.isArray(savedDecks)) savedDecks = []; } catch (e) { savedDecks = []; localStorage.setItem('opcg_decks', "[]"); }

// --- ALIGN TOOL LOGIC ---
function openAlignAuth() { showModal("Enter Developer Code:", "prompt", (val) => { if (val === "717") { document.getElementById('home-screen').style.display = 'none'; document.body.classList.add('align-mode-active'); document.getElementById('align-tool').style.display = 'block'; createCard('https://i.imgur.com/TwmysAX.png', 0, 0, {zone: 'leader-zone'}); createCard('https://i.imgur.com/2lEVHJP.png', 0, 0, {zone: 'char-zone-front'}); createCard('https://i.imgur.com/KdMSz8v.png', 0, 0, {zone: 'stage-zone'}); createCard(DON_URL, 0, 0, {zone: 'don-zone'}); const lf = createCard('https://m.media-amazon.com/images/I/51xnq29+enL._AC_.jpg', 0, 0, {zone: 'life-zone'}); lf.style.position = 'absolute'; loadZoneAlign(); } else { showModal("Access Denied.", "alert"); } }); }
function closeAlignTool() { window.location.reload(); }
function loadZoneAlign() { const zoneId = document.getElementById('align-zone').value; const targetIds = { 'ld': 'leader-zone', 'st': 'stage-zone', 'fz': 'franky-extra-zone', 'dk': 'drop-deck', 'tr': 'drop-trash', 'dd': 'don-deck', 'lf': 'life-zone', 'ch': 'char-zone-front', 'dz': 'don-zone' }; const target = document.getElementById(targetIds[zoneId]); document.querySelectorAll('.zone-is-selected').forEach(z => z.classList.remove('zone-is-selected')); if(target) target.classList.add('zone-is-selected'); const rs = getComputedStyle(root); document.getElementById('slider-t').value = parseFloat(rs.getPropertyValue(`--${zoneId}-t`)) || 0; document.getElementById('slider-l').value = parseFloat(rs.getPropertyValue(`--${zoneId}-l`)) || 0; document.getElementById('slider-w').value = parseFloat(rs.getPropertyValue(`--${zoneId}-w`)) || 0; document.getElementById('slider-h').value = parseFloat(rs.getPropertyValue(`--${zoneId}-h`)) || 0; document.getElementById('val-t').innerText = document.getElementById('slider-t').value + "%"; document.getElementById('val-l').innerText = document.getElementById('slider-l').value + "%"; document.getElementById('val-w').innerText = document.getElementById('slider-w').value + "%"; document.getElementById('val-h').innerText = document.getElementById('slider-h').value + "%"; const innerCtrl = document.getElementById('inner-card-control'); if (['ch', 'dz'].includes(zoneId)) { innerCtrl.style.display = 'flex'; document.getElementById('slider-cw').value = parseFloat(rs.getPropertyValue(`--${zoneId}-cw`)) || 11.5; document.getElementById('val-cw').innerText = document.getElementById('slider-cw').value + "%"; } else { innerCtrl.style.display = 'none'; } document.getElementById('slider-card-w').value = parseFloat(rs.getPropertyValue('--board-card-w')) || 11.5; document.getElementById('val-card-w').innerText = document.getElementById('slider-card-w').value + "%"; document.getElementById('slider-don-w').value = parseFloat(rs.getPropertyValue('--don-card-w')) || 11.5; document.getElementById('val-don-w').innerText = document.getElementById('slider-don-w').value + "%"; }
function updateAlign(prop, val) { const zoneId = document.getElementById('align-zone').value; root.style.setProperty(`--${zoneId}-${prop}`, val + '%'); document.getElementById(`val-${prop}`).innerText = val + "%"; savedAlign[`--${zoneId}-${prop}`] = val + '%'; }
function updateGlobalSize(prop, val) { root.style.setProperty(`--${prop}`, val + '%'); const displayId = prop === 'board-card-w' ? 'val-card-w' : 'val-don-w'; document.getElementById(displayId).innerText = val + "%"; savedAlign[`--${prop}`] = val + '%'; }
function saveAlign() { localStorage.setItem('opcg_align', JSON.stringify(savedAlign)); socket.emit('game_action', {type: 'global_align_update', alignData: savedAlign}); showModal("Alignment Saved & Synced!", "alert"); }
function resetAlign() { showModal("Reset all alignment to default?", "confirm", () => { savedAlign = {}; localStorage.removeItem('opcg_align'); window.location.reload(); }); }

// --- DECK BUILDER LOGIC ---
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

// --- GAME LOBBY SETUP ---
window.onload = () => { renderHomeDecks(); };

function getSelectedPlaymat() { const sel = document.getElementById('playmat-selector'); return sel ? sel.value : 'https://i.imgur.com/SSN1DUI.jpeg'; }
function prepActiveDeck() { if(activeDeckIndex === -1 || !savedDecks[activeDeckIndex]) return false; const d = savedDecks[activeDeckIndex]; activeLobbyDeckUrlArray = [d.leader]; Object.keys(d.main).forEach(url => { for(let k=0; k<d.main[url]; k++) { activeLobbyDeckUrlArray.push(url); } }); return true; }
function setupPlayerBoardVisuals() { const board = document.getElementById('my-board'); let chosenMat = getSelectedPlaymat(); board.style.backgroundImage = `url('${chosenMat}')`; if (chosenMat.includes('WjiUDr0')) { board.classList.add('mat-white'); } else { board.classList.remove('mat-white'); } }

function startDevMode() { 
    if(!prepActiveDeck()) { showModal("Select an active deck first!", "alert"); return; } 
    isDevMode = true; turnNum = 1; myTurnCount = 1; isMyTurn = true; 
    window.locked7Plus = false; window.leaderUsedThisTurn = false; window.magellanDefensiveUsed = false; window.stussyUsedThisTurn = false;
    window.sotuTurnState.vinsmokeCostDiscount = 0; window.sotuTurnState.judgeGlobalPowerBuff = 0;
    window.batchState.luffy6cBuffActive = false; window.batchState.extraTurnActive = false; window.batchState.blackMariaUsed = false; window.batchState.zoroFrozenDonCount = 0; window.batchState.donReturnedCount = 0; window.batchState.donReturnedThisTurn = false; window.batchState.magellanBuffActive = false; window.batchState.leaderCannotAttack = false; window.batchState.stussyRedEventBuffs = 0;
    
    setupPlayerBoardVisuals(); document.getElementById('home-screen').style.display = 'none'; document.getElementById('sidebar-manual-controls').style.display = 'block'; 
    DECK_ARR = activeLobbyDeckUrlArray.slice(1); shuffleArray(DECK_ARR); 
    createCard(activeLobbyDeckUrlArray[0], 0, 0, {zone:'leader-zone'}); 
    
    const leaderLife = CARD_DB[activeLobbyDeckUrlArray[0]]?.life || 5; 
    for(let i=0; i<leaderLife; i++) { if(DECK_ARR.length) { const c = createCard(DECK_ARR.shift(), 0, 0, {isLife: true, isBack: true}); c.style.position = 'absolute'; document.getElementById('life-zone').appendChild(c); } } 
    updateLifePositions(); 
    for(let i=0; i<5; i++) { if(DECK_ARR.length) createCard(DECK_ARR.shift(), 0, 0, {inHand: true}); } 
    refreshStats();
    saveState();
}

function createLobby() { 
    if(!prepActiveDeck()) { showModal("Select an active deck first!", "alert"); return; } 
    socket.emit('create_room', (res) => { document.getElementById('menu-main').style.display = 'none'; document.getElementById('menu-deck').style.display = 'block'; document.getElementById('display-room-code').innerText = res.roomId; document.getElementById('lobby-status').innerText = "Waiting for opponent..."; socket.emit('deck_selected', activeLobbyDeckUrlArray); }); 
}

function showJoinLobby() { 
    if(!prepActiveDeck()) { showModal("Select an active deck first!", "alert"); return; } 
    document.getElementById('menu-main').style.display = 'none'; document.getElementById('menu-join').style.display = 'block'; 
}

function joinLobby() { 
    socket.emit('join_room', document.getElementById('room-code-input').value.trim(), (res) => { if(res.success) { document.getElementById('menu-join').style.display = 'none'; document.getElementById('menu-deck').style.display = 'block'; document.getElementById('display-room-code').innerText = document.getElementById('room-code-input').value.trim(); document.getElementById('lobby-status').innerText = "Waiting for opponent..."; socket.emit('deck_selected', activeLobbyDeckUrlArray); } else { showModal("Invalid room.", "alert"); } }); 
}

function backToMain() { document.getElementById('menu-join').style.display = 'none'; document.getElementById('menu-main').style.display = 'block'; }

function randomMatch() { 
    if(!prepActiveDeck()) { showModal("Select an active deck first!", "alert"); return; } 
    document.getElementById('menu-main').style.display = 'none'; document.getElementById('menu-deck').style.display = 'block'; document.getElementById('lobby-status').innerText = "Searching for opponent..."; 
    socket.emit('join_random', (res) => { document.getElementById('display-room-code').innerText = res.roomId; if(!res.waiting) { document.getElementById('lobby-status').innerText = "Opponent found! Connecting..."; socket.emit('deck_selected', activeLobbyDeckUrlArray); } else { socket.emit('deck_selected', activeLobbyDeckUrlArray); } }); 
}

function copyCode() { navigator.clipboard.writeText(document.getElementById('display-room-code').innerText).then(()=> { showModal("Code copied!", "alert"); }); }

// --- GAME INITIALIZATION ---
socket.on('player_joined', () => { document.getElementById('lobby-status').innerText = "Opponent joined! Connecting..."; });

socket.on('game_start', (data) => {
    document.getElementById('home-screen').style.display = 'none'; 
    isFirst = data.isFirst; isDevMode = false; myTurnCount = 0; turnNum = 1; 
    window.locked7Plus = false; window.leaderUsedThisTurn = false; window.magellanDefensiveUsed = false; window.stussyUsedThisTurn = false;
    window.sotuTurnState.vinsmokeCostDiscount = 0; window.sotuTurnState.judgeGlobalPowerBuff = 0;
    window.batchState.luffy6cBuffActive = false; window.batchState.extraTurnActive = false; window.batchState.blackMariaUsed = false; window.batchState.zoroFrozenDonCount = 0; window.batchState.donReturnedCount = 0; window.batchState.donReturnedThisTurn = false; window.batchState.magellanBuffActive = false; window.batchState.leaderCannotAttack = false; window.batchState.stussyRedEventBuffs = 0;
    
    setupPlayerBoardVisuals(); DECK_ARR = activeLobbyDeckUrlArray.slice(1); shuffleArray(DECK_ARR); 
    createCard(activeLobbyDeckUrlArray[0], 0, 0, {zone:'leader-zone'}); 
    
    const leaderLife = CARD_DB[activeLobbyDeckUrlArray[0]]?.life || 5; 
    for(let i=0; i<leaderLife; i++) { if(DECK_ARR.length) { const c = createCard(DECK_ARR.shift(), 0, 0, {isLife: true, isBack: true}); c.style.position = 'absolute'; document.getElementById('life-zone').appendChild(c); } } 
    updateLifePositions(); 
    for(let i=0; i<5; i++) { if(DECK_ARR.length) createCard(DECK_ARR.shift(), 0, 0, {inHand: true}); } 
    refreshStats();
    saveState();

    setTimeout(() => { 
        showModal("Mulligan? (Return hand, draw 5)", "confirm", () => { 
            document.querySelectorAll('#hand-bar .card').forEach(c => { DECK_ARR.push(c.dataset.url); c.remove(); }); 
            shuffleArray(DECK_ARR); 
            for(let i=0; i<5; i++) { if(DECK_ARR.length) createCard(DECK_ARR.shift(), 0, 0, {inHand: true}); } 
            refreshStats(); saveState();
            socket.emit('mulligan_done'); document.getElementById('sync-overlay').style.display = 'flex'; 
        }, () => { 
            socket.emit('mulligan_done'); document.getElementById('sync-overlay').style.display = 'flex'; 
        }); 
    }, 500);
});

socket.on('begin_game', () => { 
    document.getElementById('sync-overlay').style.display = 'none'; 
    isMyTurn = isFirst; if(isFirst) myTurnCount = 1; updateTurnUI(); 
    if(isFirst) { OPP_DON_TOTAL = 0; spawnDonLocal(); } 
    showModal(`Game Start! You go ${isFirst ? 'FIRST' : 'SECOND'}.`, "alert", () => saveState()); 
});

// --- UI & CHAT UTILITIES ---
function showModal(msg, type, onConfirm, onCancel, defaultVal = "") { 
    const over = document.getElementById('custom-modal-overlay'); document.getElementById('custom-modal-msg').innerHTML = msg; const inp = document.getElementById('custom-modal-input'); const b1 = document.getElementById('custom-modal-btn-1'); const b2 = document.getElementById('custom-modal-btn-2'); over.style.display = 'flex'; const newB1 = b1.cloneNode(true); b1.parentNode.replaceChild(newB1, b1); const newB2 = b2.cloneNode(true); b2.parentNode.replaceChild(newB2, b2); 
    if(type === 'alert') { inp.style.display = 'none'; newB2.style.display = 'none'; newB1.innerText = "OK"; newB1.style.background = "#3498db"; newB1.onclick = () => { over.style.display = 'none'; if(onConfirm) onConfirm(); }; } else if(type === 'confirm') { inp.style.display = 'none'; newB2.style.display = 'block'; newB1.innerText = "YES"; newB1.style.background = "#2ecc71"; newB2.innerText = "NO"; newB2.style.background = "#e74c3c"; newB1.onclick = () => { over.style.display = 'none'; if(onConfirm) onConfirm(); }; newB2.onclick = () => { over.style.display = 'none'; if(onCancel) onCancel(); }; } else if(type === 'prompt') { inp.style.display = 'block'; newB2.style.display = 'block'; inp.value = defaultVal; newB1.innerText = "SUBMIT"; newB1.style.background = "#2ecc71"; newB2.innerText = "CANCEL"; newB2.style.background = "#e74c3c"; newB1.onclick = () => { over.style.display = 'none'; if(onConfirm) onConfirm(inp.value); }; newB2.onclick = () => { over.style.display = 'none'; if(onCancel) onCancel(); }; } 
}

function sendChat(e) { e.preventDefault(); const inp = document.getElementById('chat-input'); const msg = inp.value.trim(); if(!msg) return; appendChat("You: " + msg, "#2ecc71"); socket.emit('chat_msg', msg); inp.value = ''; } 
socket.on('chat_msg', (msg) => { appendChat("Opp: " + msg, "#e74c3c"); });
function appendChat(str, col) { const box = document.getElementById('chat-messages'); const div = document.createElement('div'); div.style.color = col; div.innerText = str; box.appendChild(div); box.scrollTop = box.scrollHeight; }
function updateTurnUI() { if(isDevMode) return; const ti = document.getElementById('turn-indicator'); ti.style.display = 'block'; if(isMyTurn) { ti.innerText = "YOUR TURN"; ti.style.background = "#2ecc71"; document.getElementById('btn-end-turn').disabled = false; } else { ti.innerText = "OPPONENT'S TURN"; ti.style.background = "#e74c3c"; document.getElementById('btn-end-turn').disabled = true; } }

function concedeGame() { showModal("Are you sure you want to concede?", "confirm", () => { socket.emit('game_action', {type: 'concede'}); showModal("You Conceded. GAME OVER.", "alert", () => window.location.reload()); }); }
// ==========================================
// CORE ENGINE - PART 2 (SYNC, COMBAT, EOT)
// ==========================================

// --- PURE NETWORK COMBAT LOGIC & SYNC ---
socket.on('board_update', (data) => {
    if(isDevMode) return;
    document.getElementById('opp-deck-count').innerText = data.deck;
    document.getElementById('opp-hand-count').innerText = data.handCount;
    OPP_DON_TOTAL = data.totalDon;
    
    if(data.playmat) {
        document.getElementById('opp-board').style.backgroundImage = `url('${data.playmat}')`;
        if(data.playmat.includes('WjiUDr0')) document.getElementById('opp-board').classList.add('mat-white');
        else document.getElementById('opp-board').classList.remove('mat-white');
    }

    const oppZones = ['opp-life-zone', 'opp-char-zone-front', 'opp-franky-extra-zone', 'opp-leader-zone', 'opp-stage-zone', 'opp-don-zone'];
    oppZones.forEach(z => document.getElementById(z).innerHTML = '');
    
    data.field.forEach(c => {
        const url = c.back ? 'https://m.media-amazon.com/images/I/51xnq29+enL._AC_.jpg' : c.url;
        const newC = createCard(url, 0, 0, {isOpponent: true, isBack: c.back});
        newC.id = 'opp-' + c.id;
        newC.dataset.url = c.url;
        newC.dataset.isDon = c.isDon;
        newC.dataset.isLife = c.isLife;
        newC.dataset.currentPower = c.tempPower;
        if(c.rested) newC.classList.add('rested');
        if(c.frozen) { newC.classList.add('frozen'); newC.dataset.frozenUntil = c.frozenUntil; }
        if(c.noRestand) { newC.classList.add('no-restand'); newC.dataset.noRestand = "true"; }
        if(c.unblockable) newC.dataset.unblockable = "true";
        
        if(c.rush) { newC.dataset.hasRush = "true"; newC.querySelector('.rush-tag').style.display='block'; }
        if(c.banish) { newC.dataset.banish = "true"; newC.querySelector('.banish-tag').style.display='block'; }
        if(c.doubleAttack) { newC.dataset.doubleAttack = "true"; newC.querySelector('.double-attack-tag').style.display='block'; }
        
        const targetZone = c.zone === 'hand-bar' ? 'opp-hand' : (c.zone.startsWith('opp-') ? c.zone : 'opp-' + c.zone);
        const tzEl = document.getElementById(targetZone);
        if(tzEl) {
            if(targetZone === 'opp-life-zone') newC.style.position = 'absolute';
            else newC.style.position = 'relative';
            tzEl.appendChild(newC);
        }
    });
    
    data.field.forEach(c => {
        if(c.parentId) {
            const don = document.getElementById('opp-' + c.id);
            const parent = document.getElementById('opp-' + c.parentId);
            if(don && parent) don.dataset.parentId = 'opp-' + c.parentId;
        }
    });
    
    const oppLifeCards = document.getElementById('opp-life-zone').children;
    for(let i=0; i<oppLifeCards.length; i++) {
        oppLifeCards[i].style.top = (i * 10) + 'px';
        oppLifeCards[i].style.left = (i * 2) + 'px';
        oppLifeCards[i].style.zIndex = i;
    }
    
    document.getElementById('opp-don').innerText = OPP_DON_TOTAL;
    updatePowerDisplay();
});

socket.on('game_action', (data) => {
    if(data.type === 'declare_attack') { 
        const att = document.getElementById('opp-' + data.attackerId); 
        const def = document.getElementById(data.defenderId.replace('opp-','')); 
        if(!att || !def) return;
        if (data.attackerPower !== undefined) { att.dataset.currentPower = data.attackerPower; }
        
        combatState = { active: true, attackerId: att.id, defenderId: def.id, step: 'counter' }; 
        openArena(att.id, def.id, "You are being attacked!"); 
        
        if(data.unblockable === "true" || att.dataset.unblockable === "true") { 
            appendChat("Attack is Unblockable!", "#e74c3c"); 
            askCounterPhase(); 
            return; 
        } 

        // MAGELLAN DEFENSIVE CHECK
        const checkMagellanAndBlockers = () => {
            const myLeader = document.querySelector('#leader-zone .card');
            if (myLeader && CARD_DB[myLeader.dataset.url]?.name === "Magellan" && !window.magellanDefensiveUsed && DON_DECK_COUNT < 10) {
                const activeDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).filter(d => !d.dataset.parentId);
                if(activeDons.length >= 1) {
                    showModal("Opponent Attacked! Use Magellan Defensive (-1 DON, +1000, Draw 1)?", "confirm", () => {
                        magellanLeaderDefensive(() => checkBlockers());
                    }, () => checkBlockers());
                    return;
                }
            }
            checkBlockers();
        };

        const checkBlockers = () => {
            const blockers = Array.from(document.querySelectorAll('#char-zone-front .card:not(.rested):not(.frozen)')).filter(c => CARD_DB[c.dataset.url]?.blocker || (CARD_DB[c.dataset.url]?.name==="Rob Lucci (Y)" && document.getElementById('life-zone').children.length<=1) || (CARD_DB[c.dataset.url]?.name==="Monkey D. Luffy" && c.dataset.luffyBuff==="true") || CARD_DB[c.dataset.url]?.name==="Spandam" || (c.dataset.reijuBuffExpires && turnNum < parseInt(c.dataset.reijuBuffExpires))); 
            
            if(blockers.length > 0) { 
                showModal("Opponent is attacking! Use a Blocker?", "confirm", () => { 
                    combatState.step = 'select_blocker'; 
                    document.body.classList.add('blocker-target-mode'); 
                    blockers.forEach(b => b.classList.add('valid-blocker')); 
                    appendChat("Select a Blocker.", "#3498db"); 
                }, () => askCounterPhase()); 
            } else { 
                askCounterPhase(); 
            } 
        };

        checkMagellanAndBlockers();
    }
    else if(data.type === 'block_declared') { 
        combatState.defenderId = data.newDef.startsWith('opp-') ? data.newDef : 'opp-'+data.newDef; 
        openArena(combatState.attackerId, combatState.defenderId, "Opponent Blocked! Counter Phase..."); 
        
        const hasRoger = Array.from(document.querySelectorAll('#char-zone-front .card')).some(c => CARD_DB[c.dataset.url]?.name === "Gol D. Roger" && CARD_DB[c.dataset.url]?.cost === 10);
        const myLife = document.getElementById('life-zone').children.length; 
        const oppLife = document.getElementById('opp-life-zone').children.length;
        if(hasRoger && (myLife === 0 || oppLife === 0)) { 
            showModal("GOL D. ROGER INSTANT WIN TRIGGERED!", "alert", () => { 
                socket.emit('game_action', {type: 'game_over'}); 
                window.location.reload(); 
            }); 
        }
    }
    else if(data.type === 'update_counter') { updateArenaCounter(data.counterValue); }
    else if(data.type === 'counter_declared') { executeCombatResolution(data.counterValue, data.finalDefPower); }
    else if(data.type === 'clear_combat') { clearCombatState(); }
    else if(data.type === 'resolve_kill') { 
        const myTarget = document.getElementById(data.target.replace('opp-','')); 
        if(myTarget) { 
            const db = CARD_DB[myTarget.dataset.url]; 
            if(db && db.name === "General Franky") { 
                const totalDon = document.querySelectorAll('#my-board .card[data-is-don="true"]').length; 
                if (totalDon >= 3) { 
                    showModal("General Franky would be K.O.'d! Return 3 DON!! to save him?", "confirm", () => { 
                        returnDonAndCheckSanji(3, () => { appendChat("Returned 3 DON!! to save General Franky!", "#3498db"); }); 
                    }, () => { 
                        trashCard(myTarget); appendChat("Your Character K.O.'d!", "#e74c3c"); 
                    }); 
                    return; 
                } 
            } 
            trashCard(myTarget); 
            appendChat("K.O.'d!", "#e74c3c"); 
        } 
    }
    else if(data.type === 'resolve_life') { 
        let attId = combatState.attackerId; 
        if(attId && !attId.startsWith('opp-')) attId = 'opp-' + attId; 
        if(!isMyTurn) handleLifeDamage(data.banish, data.double); 
        else appendChat("Opponent took damage!", "#2ecc71"); 
    }
    else if(data.type === 'reveal_card') { appendChat(`Opponent revealed: ${CARD_DB[data.url]?.name || 'Unknown Card'}`, "#3498db"); }
    else if(data.type === 'request_ko') { 
        const myTarget = document.getElementById(data.target.replace('opp-','')); 
        if(myTarget) { 
            const db = CARD_DB[myTarget.dataset.url]; 
            if(db && db.name === "General Franky") { 
                const totalDon = document.querySelectorAll('#my-board .card[data-is-don="true"]').length; 
                if (totalDon >= 3) { 
                    showModal("Opponent's effect would K.O. General Franky! Return 3 DON!! to save him?", "confirm", () => { 
                        returnDonAndCheckSanji(3, () => { appendChat("Returned 3 DON!! to save General Franky!", "#3498db"); }); 
                    }, () => { 
                        trashCard(myTarget); appendChat("Character K.O.'d by effect!", "#e74c3c"); 
                    }); 
                    return; 
                } 
            } 
            trashCard(myTarget); 
            appendChat("Character K.O.'d by effect!", "#e74c3c"); 
        } 
    }
    else if(data.type === 'apply_status') { 
        const myTarget = document.getElementById(data.target.replace('opp-','')); 
        if(myTarget) { 
            if(data.status === 'freeze') { myTarget.classList.add('frozen'); myTarget.dataset.frozenUntil = myTurnCount + 2; appendChat("Your card was Action Locked (Frozen) by opponent!", "#34dbdb"); } 
            else if(data.status === 'rest') { myTarget.classList.add('rested'); appendChat("Your card was Rested by opponent!", "#f1c40f"); } 
            else if(data.status === 'no_restand') { myTarget.classList.add('no-restand'); myTarget.dataset.noRestand = "true"; appendChat("Your card was Locked by opponent!", "#9b59b6"); } 
            else if(data.status === 'minus_power') { myTarget.dataset.tempPower = parseInt(myTarget.dataset.tempPower||0) - data.amount; updatePowerDisplay(); appendChat("Your card lost " + data.amount + " power!", "#e74c3c"); }
            else if(data.status === 'minus_cost') { myTarget.dataset.tempCost = parseInt(myTarget.dataset.tempCost || CARD_DB[myTarget.dataset.url]?.cost || 0) - data.amount; updatePowerDisplay(); appendChat("Your card received -" + data.amount + " Cost!", "#9b59b6"); }
            else if(data.status === 'minus_don') { 
                if(DON_DECK_COUNT < 10) {
                    const activeDon = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).find(d => !d.dataset.parentId);
                    if(activeDon) { activeDon.remove(); DON_DECK_COUNT++; organizeDon(); }
                }
            }
            saveState(); 
        } 
    }
    else if (data.type === 'concede') { showModal("Opponent Conceded! YOU WIN!", "alert", ()=>window.location.reload()); } 
    else if (data.type === 'game_over') { showModal("Opponent took damage at 0 Life! YOU WIN!", "alert", ()=>window.location.reload()); }
    else if (data.type === 'force_sync') { saveState(); }
    else if (data.type === 'end_turn') { isMyTurn = true; handleTurnStartLogic(); }
});

function createCard(url, x, y, opts = {}) { 
    const c = document.createElement('div'); c.className = 'card'; c.id = opts.id || 'c-' + cardIDCounter++; c.dataset.url = url; c.dataset.isDon = (url === DON_URL).toString(); c.dataset.isLife = (opts.isLife || false).toString(); c.style.backgroundImage = `url('${url}')`; 
    c.innerHTML = `<div class="don-badge">0</div><div class="power-badge hidden">+0</div><div class="keyword-tags"><div class="kw-tag blocker-tag">BLOCKER</div><div class="kw-tag rush-tag">RUSH</div><div class="kw-tag banish-tag">BANISH</div><div class="kw-tag double-attack-tag">DOUBLE ATK</div></div>`; 
    if (opts.isBack) c.classList.add('card-back'); 
    
    if (!opts.isOpponent) { bindCardEvents(c); } 
    else { 
        c.onmousedown = (e) => { if (e.button !== 0) return; if (selectConfig) { handleSelection(c); return; } }; 
        c.oncontextmenu = (e) => { e.preventDefault(); }; 
        c.onmouseenter = () => { if(!c.classList.contains('card-back')) { document.getElementById('right-col-inspector').style.backgroundImage = `url('${c.dataset.url}')`; } }; 
    } 
    if (opts.inHand) document.getElementById('hand-bar').appendChild(c); else if (opts.zone) document.getElementById(opts.zone).appendChild(c); 
    return c; 
}

function bindCardEvents(c) {
    c.onmouseenter = () => { hovered = c; if(!c.classList.contains('card-back') || isDevMode) { document.getElementById('right-col-inspector').style.backgroundImage = `url('${c.dataset.url}')`; } };
    c.onmouseleave = () => hovered = null;
    c.onmousedown = (e) => { 
        if (e.button !== 0 || combatState.step === 'wait_counter') return; 
        if (selectConfig) { handleSelection(c); return; }
        
        const db = CARD_DB[c.dataset.url] || {}; 

        if (combatState.step === 'counter') { 
            if (c.parentElement.id === 'hand-bar' && db && (db.counter !== undefined || db.isCounter)) { 
                
                if (db.name === "Divine Departure") {
                    if(selectedCounterCards.includes(c)) return;
                    startSelection('hand_trash', 1, "Trash 1 card to give +3000 Power", (cards) => { TRASH_ARR.push(cards[0].dataset.url); cards[0].remove(); TRASH_ARR.push(c.dataset.url); c.remove(); currentCounterTotal += 3000; updateArenaCounter(currentCounterTotal); socket.emit('game_action', {type:'update_counter', counterValue: currentCounterTotal}); appendChat("Divine Departure provided +3000 Defense!", "#3498db"); }); return;
                }
                if (db.name === "NoroNoro Beam Sword") {
                    if(selectedCounterCards.includes(c)) return;
                    const activeDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).filter(d => !d.dataset.parentId);
                    if(activeDons.length < 2) { showModal("Need 2 active DON!!", "alert"); return; }
                    for(let i=0; i<2; i++) activeDons[i].classList.add('rested');
                    startSelection('don_minus', 1, "Return 1 DON!! to Deck", (dons) => { dons[0].remove(); DON_DECK_COUNT++; organizeDon(); startSelection('lucci_g_rest', 1, "Rest 1 Opponent Character", (targets) => { targets[0].classList.add('rested'); if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'rest', target: targets[0].id}); TRASH_ARR.push(c.dataset.url); c.remove(); currentCounterTotal += 2000; updateArenaCounter(currentCounterTotal); socket.emit('game_action', {type:'update_counter', counterValue: currentCounterTotal}); appendChat("NoroNoro Beam Sword gave +2000 and rested an enemy!", "#8e44ad"); saveState(); }); }); return;
                }
                if (db.name === "Bad Manners Kick Course") {
                    if(selectedCounterCards.includes(c)) return;
                    startSelection('hand_trash', 1, "Trash 1 card to give +3000 Power", (cards) => { TRASH_ARR.push(cards[0].dataset.url); cards[0].remove(); TRASH_ARR.push(c.dataset.url); c.remove(); currentCounterTotal += 3000; updateArenaCounter(currentCounterTotal); socket.emit('game_action', {type:'update_counter', counterValue: currentCounterTotal}); appendChat("Bad Manners Kick Course provided +3000 Defense!", "#e74c3c"); }); return;
                }
                
                let cv = db.counter || 0; if (db.isCounter && !db.counter) { if (db.name === "Gum Gum Giant") cv = 4000; else cv = 2000; }
                
                if (selectedCounterCards.includes(c)) { 
                    selectedCounterCards = selectedCounterCards.filter(card => card !== c); c.style.outline = ""; currentCounterTotal -= cv; 
                    if(db.type === 'Event') { const restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested')); for(let i=0; i<db.cost; i++) if(restedDons[i]) restedDons[i].classList.remove('rested'); }
                } else { 
                    if(db.type === 'Event') { const activeDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]:not(.rested)')).filter(d => !d.dataset.parentId); if(activeDons.length < db.cost) { showModal(`Need ${db.cost} active DON!!`, "alert"); return; } for(let i=0; i<db.cost; i++) activeDons[i].classList.add('rested'); }
                    selectedCounterCards.push(c); c.style.outline = "4px solid #3498db"; currentCounterTotal += cv; 
                } 
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
        
        rightClickedCard = c; 
        const db = CARD_DB[c.dataset.url] || {}; 
        const menu = document.getElementById('context-menu'); 
        menu.style.display = 'block'; 
        menu.style.left = e.pageX + 'px'; 
        menu.style.top = e.pageY + 'px'; 
        
        let h = ""; 
        if(isDevMode) { h += `<div onclick="setPower(1000)">+1000 Power</div><div onclick="setPower(0)">Reset Power</div>`; }
        
        let canAttack = false; 
        if(c.parentElement.id === 'char-zone-front' || c.parentElement.id === 'leader-zone') { 
            if(!c.classList.contains('rested') && !c.classList.contains('frozen') && (isMyTurn || isDevMode)) { 
                if(db.type === 'Leader' && myTurnCount === 1) canAttack = false; 
                else if(db.type === 'Character' && c.dataset.turnPlayed == myTurnCount && c.dataset.hasRush !== "true") canAttack = false; 
                else canAttack = true; 
                if (window.batchState.leaderCannotAttack && c.parentElement.id === 'leader-zone') canAttack = false;
            } 
        }
        
        if(canAttack) h += `<div onclick="simulateAttack()" style="background:#c0392b; color:#fff">Attack</div>`; 
        else if ((c.parentElement.id === 'char-zone-front' || c.parentElement.id === 'leader-zone') && !c.classList.contains('rested')) {
            if(c.classList.contains('frozen')) h += `<div style="background:#34dbdb; color:#000; font-weight:bold; cursor:not-allowed;">FROZEN (Cannot Act)</div>`;
            else h += `<div style="background:#555; color:#999; cursor:not-allowed;">Attack Unavailable</div>`;
        }

        if (!c.classList.contains('frozen')) {
            const customMains = ["Franky", "Hattori", "Stussy", "Vinsmoke Judge", "Vinsmoke Ichiji", "Vinsmoke Yonji", "Monkey D. Luffy (Extra Turn)", "Black Maria", "Roronoa Zoro", "Vinsmoke Reiju (5c)", "Vinsmoke Sanji", "Impel Down", "Domino", "Magellan (10c)", "We News", "Morgans (5c)", "Morgans", "Rob Lucci (Y)", "Kaku", "Magellan"];
            if (db?.hasMain && !['hand-bar', 'life-zone'].includes(c.parentElement.id) && !customMains.includes(db?.name)) { h += `<div onclick="activateMain()" style="background:#f39c12; color:#000">Activate Main</div>`; } 
            if (db?.type === "Stage" && (db?.traits||[]).includes("Invention") && !['hand-bar', 'life-zone'].includes(c.parentElement.id)) h += `<div onclick="stageOncePerGame()" style="background:#8e44ad; color:#fff">Once Per Game (Gen. Franky)</div>`;
            
            if (db?.type === "Leader") {
                if (db.name === "Franky" && (isMyTurn || isDevMode) && !window.leaderUsedThisTurn) h += `<div onclick="frankyMainEffect()" style="background:#f39c12; color:#000">Activate Main (Return 2 DON!!)</div>`;
                if (db.name === "Stussy" && (isMyTurn || isDevMode) && !window.stussyUsedThisTurn) h += `<div onclick="stussyLeaderFlip()" style="background:#f39c12; color:#000">Activate: Flip Life & Freeze</div>`;
                if (db.name === "Morgans" && (isMyTurn || isDevMode) && !window.leaderUsedThisTurn) h += `<div onclick="morgansLeaderMain()" style="background:#f39c12; color:#000">Main: Look at top 3 for Big News</div>`;
                if (db.name === "Magellan") {
                    if ((isMyTurn || isDevMode) && !window.leaderUsedThisTurn) h += `<div onclick="magellanLeaderMain()" style="background:#f39c12; color:#000">Main: DON-1 -> Play ≤4c Impel from Trash</div>`;
                    if (!window.magellanDefensiveUsed && (!isMyTurn || isDevMode)) h += `<div onclick="magellanLeaderDefensive()" style="background:#34dbdb; color:#000">Defensive: DON-1 -> +1000 & Draw 1</div>`;
                }
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

window.addEventListener('mousedown', (e) => { if(!e.target.closest('#context-menu') && !e.target.closest('#search-modal') && !e.target.closest('#custom-modal-box')) hideMenu(); if (combatState.step === 'wait_counter') { e.stopPropagation(); e.preventDefault(); return; } }, true);
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
    
    if (c.dataset.isDon === "true") {
        let attached = false; const targets = document.querySelectorAll('#char-zone-front .card, #leader-zone .card');
        targets.forEach(t => { if (t.dataset.isDon !== "true" && !t.id.includes('opp-')) { const r = t.getBoundingClientRect(); if (isInside(e, r)) { c.dataset.parentId = t.id; updateBadges(t.id); organizeDon(); saveState(); attached = true; } } });
        if (attached) return; 
    }
    
    if (isDevMode && c.dataset.isDon !== "true") {
        const charR = document.getElementById('char-zone-front').getBoundingClientRect();
        const stageR = document.getElementById('stage-zone').getBoundingClientRect();
        if (isInside(e, charR)) { document.getElementById('char-zone-front').appendChild(c); c.style.position = 'relative'; c.style.left = '0'; c.style.top = '0'; saveState(); return; }
        if (isInside(e, stageR)) { document.getElementById('stage-zone').appendChild(c); c.style.position = 'relative'; c.style.left = '0'; c.style.top = '0'; saveState(); return; }
    }
    
    c.style.zIndex = 20; const handR = document.getElementById('hand-bar').getBoundingClientRect(); 
    if (isInside(e, handR)) { if(c.dataset.origZone !== 'hand-bar' && isDevMode) toHand(c); else snapBack(c); } else { snapBack(c); } 
});

// --- ENGINE FIXES: CORE LOOP & UTILITIES ---
function snapBack(c) { const orig = document.getElementById(c.dataset.origZone); if(orig) { orig.appendChild(c); c.style.position = (orig.id === 'life-zone') ? 'absolute' : 'relative'; c.style.left = '0'; c.style.top = '0'; if(orig.id === 'life-zone') updateLifePositions(); saveState(); } }
function isInside(e, r) { return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; }
function toHand(c) { c.dataset.isLife="false"; c.classList.remove('card-back'); c.style.position='relative'; document.getElementById('hand-bar').appendChild(c); saveState(); }

function drawCardAction() {
    if (DECK_ARR.length === 0) { showModal("Deck out! You lose.", "alert"); return; }
    createCard(DECK_ARR.shift(), 0, 0, {inHand: true});
    refreshStats();
    saveState();
}

function spawnDonLocal(isRested = false) {
    if (DON_DECK_COUNT <= 0) return;
    DON_DECK_COUNT--;
    const d = createCard(DON_URL, 0, 0, {zone: 'don-zone'});
    if (isRested) d.classList.add('rested');
    organizeDon();
    refreshStats();
    saveState();
}

function killDon() {
    const dons = document.querySelectorAll('#my-board .card[data-is-don="true"]');
    if (dons.length > 0) {
        dons[dons.length - 1].remove();
        DON_DECK_COUNT++;
        organizeDon();
        refreshStats();
        saveState();
    }
}

function deckToLife() {
    if (DECK_ARR.length === 0) return;
    const url = DECK_ARR.shift();
    const c = createCard(url, 0, 0, {isLife: true, isBack: true});
    c.style.position = 'absolute';
    document.getElementById('life-zone').appendChild(c);
    updateLifePositions();
    saveState();
}

// --- EOT QUEUE SYSTEM ---
let eotQueue = [];

function processEndOfTurn() {
    eotQueue = [];
    const leader = document.querySelector('#leader-zone .card');
    const leaderName = leader ? CARD_DB[leader.dataset.url]?.name : "";
    const field = Array.from(document.querySelectorAll('#my-board .card'));

    // 1. Black Maria Auto-Return
    if(window.batchState.blackMariaUsed) {
        eotQueue.push((next) => {
            let myDon = document.querySelectorAll('#my-board .card[data-is-don="true"]').length;
            let diff = myDon - OPP_DON_TOTAL;
            if(diff > 0) {
                const dons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"]'));
                for(let i=0; i<diff && i<dons.length; i++) { dons[i].remove(); DON_DECK_COUNT++; }
                organizeDon(); refreshStats();
                appendChat("Black Maria auto-returned " + Math.min(diff, dons.length) + " DON!!", "#8e44ad");
            }
            next();
        });
    }

    // 2. Franky Leader Search (Interactive Search)
    if(leaderName === "Franky") {
        eotQueue.push((next) => {
            showModal("EOT: Franky Leader - Look at top 5 for Straw Hat type?", "confirm", () => {
                performTopDeckSearch(5, ["Straw Hat Crew", "Straw Hat Pirates"], null, true, true, null, () => {
                    appendChat("Franky End of Turn Search Complete.", "#f39c12");
                    next();
                });
            }, () => next());
        });
    }

    // 3. Saldeath
    const saldeaths = field.filter(c => CARD_DB[c.dataset.url]?.name === "Saldeath" && !c.classList.contains('rested') && c.parentElement.id === 'char-zone-front');
    saldeaths.forEach(sal => {
        eotQueue.push((next) => {
            showModal("EOT: Rest Saldeath to set 2 DON active?", "confirm", () => {
                sal.classList.add('rested');
                let restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested'));
                if(restedDons[0]) restedDons[0].classList.remove('rested');
                if(restedDons[1]) restedDons[1].classList.remove('rested');
                appendChat("Saldeath set 2 DON active!", "#8e44ad");
                saveState(); next();
            }, () => next());
        });
    });

    // 4. Rosinante
    const rosinantes = field.filter(c => CARD_DB[c.dataset.url]?.name === "Donquixote Rosinante" && c.parentElement.id === 'char-zone-front');
    rosinantes.forEach(ros => {
        eotQueue.push((next) => {
            showModal("EOT: Rosinante - Set 2 rested DON active?", "confirm", () => {
                let restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested'));
                if(restedDons[0]) restedDons[0].classList.remove('rested');
                if(restedDons[1]) restedDons[1].classList.remove('rested');
                appendChat("Rosinante set 2 DON active!", "#8e44ad");
                saveState(); next();
            }, () => next());
        });
    });

    // 5. Katakuri (8c)
    const katakuris = field.filter(c => CARD_DB[c.dataset.url]?.name === "Charlotte Katakuri (8c)" && c.parentElement.id === 'char-zone-front');
    katakuris.forEach(kat => {
        eotQueue.push((next) => {
            showModal("EOT: Katakuri (8c) - Set up to 2 Big Mom Pirates active & add 1 rested DON?", "confirm", () => {
                spawnDonLocal(true);
                let bmChars = Array.from(document.querySelectorAll('#char-zone-front .card.rested')).filter(c => {
                    let db = CARD_DB[c.dataset.url];
                    return db && (db.traits||[]).includes("Big Mom Pirates") && (db.cost >= 3);
                });
                if(bmChars[0]) bmChars[0].classList.remove('rested');
                if(bmChars[1]) bmChars[1].classList.remove('rested');
                appendChat("Katakuri set characters active and ramped 1 rested DON!", "#8e44ad");
                saveState(); next();
            }, () => next());
        });
    });

    // 6. Shark Submerge III
    const sharks = field.filter(c => CARD_DB[c.dataset.url]?.name === "Shark Submerge III" && c.classList.contains('rested') && (c.parentElement.id === 'stage-zone' || c.parentElement.id === 'franky-extra-zone'));
    sharks.forEach(sh => {
        eotQueue.push((next) => {
            let restedDons = Array.from(document.querySelectorAll('#don-zone .card[data-is-don="true"].rested'));
            if(restedDons.length > 0) {
                if(restedDons[0]) restedDons[0].classList.remove('rested');
                if(restedDons[1]) restedDons[1].classList.remove('rested');
                appendChat("Shark Submerge III set 2 DON active!", "#3498db");
                saveState();
            }
            next();
        });
    });

    runNextEOT();
}

function runNextEOT() {
    if(eotQueue.length > 0) {
        let func = eotQueue.shift();
        func(runNextEOT);
    } else {
        finishEndTurn();
    }
}

function finishEndTurn() {
    isMyTurn = false;
    document.querySelectorAll('[data-restand-at-eot="true"]').forEach(c => {
        c.classList.remove('rested');
        c.dataset.restandAtEOT = "false";
    });
    
    if (!isDevMode) {
        socket.emit('game_action', { type: 'end_turn' });
    } else {
        handleTurnStartLogic();
    }
    updateTurnUI();
}

function endTurn() {
    if (!isMyTurn && !isDevMode) return;
    processEndOfTurn(); // Fire the EOT queue before ending
}

function handleTurnStartLogic() {
    myTurnCount++;
    turnNum++;
    
    // Reset OPT Flags
    window.leaderUsedThisTurn = false;
    window.magellanDefensiveUsed = false;
    window.stussyUsedThisTurn = false;
    window.locked7Plus = false;
    window.sotuTurnState.vinsmokeCostDiscount = 0;
    window.sotuTurnState.judgeGlobalPowerBuff = 0;
    window.batchState.stussyRedEventBuffs = 0;
    window.batchState.leaderCannotAttack = false;
    window.batchState.blackMariaUsed = false;
    
    // Refresh Phase
    let frozenDon = window.batchState.zoroFrozenDonCount;
    window.batchState.zoroFrozenDonCount = 0;
    
    document.querySelectorAll('#my-board .card.rested').forEach(c => {
        if (c.dataset.noRestand === "true") {
            c.dataset.noRestand = "false";
            c.classList.remove('no-restand');
            return;
        }
        if (c.dataset.isDon === "true" && frozenDon > 0) {
            frozenDon--;
            return; 
        }
        c.classList.remove('rested');
    });

    // Return attached DON
    document.querySelectorAll('#my-board .card[data-is-don="true"]').forEach(d => {
        if (d.dataset.parentId) {
            d.dataset.parentId = "";
            d.classList.remove('rested');
            document.getElementById('don-zone').appendChild(d);
        }
    });

    // Draw Phase
    if (myTurnCount > 1 || !isFirst) {
        drawCardAction();
    }

    // DON!! Phase
    let donsToAdd = (myTurnCount === 1 && isFirst) ? 1 : 2;
    for (let i = 0; i < donsToAdd; i++) {
        if (DON_DECK_COUNT > 0) spawnDonLocal(false);
    }

    updateTurnUI();
    organizeDon();
    updatePowerDisplay();
    saveState();
}

// --- INTERACTIVE TOP DECK SEARCH ENGINE ---
function performTopDeckSearch(numToLook, validTraits, avoidNameStr, addRestToHand, toBottom, minCostTarget = null, onCompleteCallback = null) {
    if(DECK_ARR.length === 0) {
        if(onCompleteCallback) onCompleteCallback();
        return;
    }

    let actualNum = Math.min(numToLook, DECK_ARR.length);
    let lookCards = [];
    for(let i=0; i<actualNum; i++) {
        lookCards.push(DECK_ARR.shift());
    }

    document.getElementById('search-modal').style.display = 'flex';
    const grid = document.getElementById('insp-grid');
    grid.innerHTML = '';
    
    let targetSelected = false;

    // Custom Close Button Logic (if they choose to skip/take nothing)
    const closeBtn = document.getElementById('search-modal-close-btn');
    const oldCloseClick = closeBtn.onclick;
    closeBtn.onclick = () => {
        // They skipped. Put all cards back based on rules.
        if(toBottom) {
            lookCards.forEach(u => DECK_ARR.push(u));
        } else {
            lookCards.forEach(u => TRASH_ARR.push(u));
            if(TRASH_ARR.length > 0) document.getElementById('drop-trash').style.backgroundImage = `url('${TRASH_ARR[TRASH_ARR.length-1]}')`;
        }
        document.getElementById('search-modal').style.display = 'none';
        closeBtn.onclick = oldCloseClick; // Restore original click just in case
        refreshStats(); saveState();
        if(onCompleteCallback) onCompleteCallback();
    };

    lookCards.forEach((url, index) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.style.backgroundImage = `url('${url}')`;
        
        // Check if it's a legal target
        const db = CARD_DB[url];
        let isMatch = true;
        if (validTraits && !validTraits.some(t => (db?.traits||[]).includes(t)) && !validTraits.includes(db?.type)) isMatch = false;
        if (avoidNameStr && db?.name === avoidNameStr) isMatch = false;
        if (minCostTarget !== null && (db?.cost || 0) < minCostTarget) isMatch = false;

        if (isMatch) {
            div.style.outline = "3px solid #2ecc71"; // Green glow for valid targets
            div.style.boxShadow = "0 0 20px #2ecc71";
            
            div.onclick = () => {
                targetSelected = true;
                // 1. Take the selected card
                const selectedUrl = lookCards.splice(index, 1)[0];
                createCard(selectedUrl, 0, 0, {inHand: true});
                
                // 2. Process the remaining cards
                if(toBottom) {
                    lookCards.forEach(u => DECK_ARR.push(u));
                } else {
                    lookCards.forEach(u => TRASH_ARR.push(u));
                    if(TRASH_ARR.length > 0) document.getElementById('drop-trash').style.backgroundImage = `url('${TRASH_ARR[TRASH_ARR.length-1]}')`;
                }
                
                document.getElementById('search-modal').style.display = 'none';
                closeBtn.onclick = oldCloseClick; // Restore original close function
                refreshStats(); saveState();
                if(onCompleteCallback) onCompleteCallback();
            };
        } else {
            // Dim invalid targets so the user knows they can't click them
            div.style.filter = "brightness(0.4)";
            div.style.cursor = "not-allowed";
            div.onclick = () => {
                showModal("Invalid target for this search.", "alert");
            };
        }
        grid.appendChild(div);
    });
}

// Legacy search stub routing to the new Interactive Engine
function openStructuredSearch(num, traits, avoidNameStr, addRestToHand = true, toBottom = true) {
    performTopDeckSearch(num, traits, avoidNameStr, addRestToHand, toBottom);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
