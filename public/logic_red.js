// ==========================================
// RED CARD LOGIC & ABILITIES
// ==========================================

function morgansLeaderMain() { 
    hideMenu(); 
    performTopDeckSearch(3, ["Big News"], null, true, true); 
    window.leaderUsedThisTurn = true; 
    saveState(); 
    appendChat("Morgans checked top 3 cards.", "#e74c3c"); 
}

function weNewsMain() { 
    hideMenu(); 
    rightClickedCard.classList.add('rested'); 
    startSelection('hand_trash', 2, "Trash 2 cards to play Lackey from Trash", (cards) => { 
        cards.forEach(c => { TRASH_ARR.push(c.dataset.url); c.remove(); }); 
        const trIdx = TRASH_ARR.findIndex(u => CARD_DB[u]?.name === "News Lackey"); 
        if(trIdx !== -1) { 
            createCard(TRASH_ARR.splice(trIdx, 1)[0], 0, 0, {zone: 'char-zone-front'}); 
            window.batchState.leaderCannotAttack = true; 
            appendChat("We News played Lackey from trash! Leader cannot attack.", "#f39c12"); 
        } else { 
            appendChat("No News Lackey in trash.", "#ccc"); 
        } 
        saveState(); 
        if(TRASH_ARR.length > 0) document.getElementById('drop-trash').style.backgroundImage = `url('${TRASH_ARR[TRASH_ARR.length-1]}')`; 
        else document.getElementById('drop-trash').style.backgroundImage = 'none'; 
    }); 
}

function morgansCharMain() { 
    hideMenu(); 
    rightClickedCard.classList.add('rested'); 
    startSelection('hand_trash', 1, "Trash 1 to Search Top 6", (cards) => { 
        TRASH_ARR.push(cards[0].dataset.url); 
        cards[0].remove(); 
        performTopDeckSearch(6, null, null, true, true, 5); 
    }); 
}

function bottomGeneralFranky() { 
    hideMenu(); 
    DECK_ARR.unshift(rightClickedCard.dataset.url); 
    rightClickedCard.remove(); 
    drawCardAction(); 
    saveState(); 
    appendChat("Bottomed General Franky to draw 1.", "#8e44ad"); 
    socket.emit('game_action', {type: 'reveal_card', url: rightClickedCard.dataset.url}); 
}

function stageOncePerGame() { 
    hideMenu(); 
    if(!isDevMode && !isMyTurn) { showModal("Not your turn!", "alert"); return; } 
    if(document.body.dataset.merryUsed === "true") { showModal("Once Per Game effect already used!", "alert"); return; } 
    const stages = Array.from(document.querySelectorAll('#stage-zone .card:not(.rested), #franky-extra-zone .card:not(.rested)')).map(s => CARD_DB[s.dataset.url]?.name); 
    const hasExodia = stages.includes("Mini Merry") && stages.includes("Waver") && stages.includes("Brachio Tank V") && stages.includes("Kurosai Fr-U IV") && stages.includes("Shark Submerge III"); 
    if(hasExodia) { 
        const idx = DECK_ARR.findIndex(u => CARD_DB[u]?.name === "General Franky"); 
        if (idx === -1) { showModal("General Franky is not in Deck.", "alert"); return; } 
        showModal("Rest 5 Invention Stages to search General Franky?", "confirm", () => { 
            document.body.dataset.merryUsed = "true"; 
            document.querySelectorAll('#stage-zone .card, #franky-extra-zone .card').forEach(s => s.classList.add('rested')); 
            const gf = createCard(DECK_ARR.splice(idx,1)[0], 0, 0, {zone: 'char-zone-front'}); 
            gf.dataset.turnPlayed = myTurnCount; 
            saveState(); 
        }); 
    } else { 
        showModal("Need exactly 1 of each of the 5 unique active Invention stages.", "alert"); 
    } 
}
