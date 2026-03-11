// ==========================================
// PURPLE CARD LOGIC & ABILITIES
// ==========================================

function magellanLeaderMain() { 
    hideMenu(); 
    const myChars = document.getElementById('char-zone-front').children.length; 
    if(myChars > 3) { showModal("You have more than 3 Characters!", "alert"); return; } 
    startSelection('don_minus', 1, "Return 1 DON!! to play ≤4c Impel Down from Trash", (dons) => { 
        dons[0].remove(); DON_DECK_COUNT++; organizeDon(); 
        window.leaderUsedThisTurn = true; 
        openInspector('trash', 'play_rested_impel_4', null); 
    }); 
}

function magellanLeaderDefensive(callback) { 
    hideMenu(); 
    startSelection('don_minus', 1, "Defensive: Return 1 DON!! to gain +1000 and Draw", (dons) => { 
        dons[0].remove(); DON_DECK_COUNT++; organizeDon(); 
        const c = document.querySelector('#leader-zone .card'); 
        if(c) c.dataset.tempPower = (parseInt(c.dataset.tempPower || 0) + 1000); 
        drawCardAction(); 
        updatePowerDisplay(); 
        window.magellanDefensiveUsed = true; 
        saveState(); 
        appendChat("Magellan Defensive: -1 DON, +1000 Power, Draw 1!", "#8e44ad"); 
        if(callback) callback(); 
    }, () => { if(callback) callback(); }); 
}

function frankyMainEffect() { 
    hideMenu(); 
    if(!isMyTurn && !isDevMode) return; 
    const totalDon = document.querySelectorAll('#my-board .card[data-is-don="true"]').length; 
    if(totalDon < 2) { showModal("Need 2 DON!! to return", "alert"); return; } 
    showModal("Return 2 DON!! to play 5-cost Stage from hand?", "confirm", () => { 
        returnDonAndCheckSanji(2, () => { 
            startSelection('hand_stage', 1, "Select a Stage from hand", (cards) => { 
                rightClickedCard = cards[0]; 
                playCard(true); 
                window.leaderUsedThisTurn = true; 
                appendChat("Franky returned 2 DON!! and played a Stage!", "#f39c12"); 
            }); 
        }); 
    }); 
}

function luffy10cMain() { 
    hideMenu(); 
    rightClickedCard.classList.add('rested'); 
    startSelection('rest_active_don', 1, "Select 1 Active DON!! to Rest", (cards) => { 
        cards[0].classList.add('rested'); 
        spawnDonLocal(false); 
        saveState(); 
        appendChat("10c Luffy swapped a rested DON for an active one!", "#8e44ad"); 
    }); 
}

function blackMariaMain() { 
    hideMenu(); 
    const hasOther = Array.from(document.querySelectorAll('#char-zone-front .card')).filter(c => CARD_DB[c.dataset.url]?.name === "Black Maria").length > 1; 
    if(hasOther) { showModal("Cannot use if you have other Black Marias.", "alert"); return; } 
    rightClickedCard.classList.add('rested'); 
    window.batchState.blackMariaUsed = true; 
    showModal("How many rested DON!! to add? (Max 5)", "prompt", (val) => { 
        let num = Math.min(5, parseInt(val) || 0); 
        for(let i=0; i<num; i++) spawnDonLocal(true); 
        saveState(); 
        appendChat(`Black Maria generated ${num} rested DON!!`, "#8e44ad"); 
    }, null, "5"); 
}

function zoro1cMain() { 
    hideMenu(); 
    rightClickedCard.classList.add('rested'); 
    spawnDonLocal(true); 
    window.batchState.zoroFrozenDonCount++; 
    saveState(); 
    appendChat("Zoro generated 1 rested DON!! (1 DON will not refresh next turn).", "#8e44ad"); 
}

function impelStageMain() { 
    hideMenu(); 
    rightClickedCard.classList.add('rested'); 
    startSelection('hand_trash', 1, "Trash 1 card", (cards) => { 
        TRASH_ARR.push(cards[0].dataset.url); 
        cards[0].remove(); 
        performTopDeckSearch(3, ["Impel Down"], null, true, true); 
        appendChat("Impel Down searched top 3!", "#8e44ad"); 
    }); 
}

function dominoMain() { 
    hideMenu(); 
    rightClickedCard.classList.add('rested'); 
    if(!window.batchState.donReturnedThisTurn) { showModal("No DON returned this turn!", "alert"); return; } 
    drawCardAction(); 
    startSelection('hand_trash', 1, "Trash 1 card", (cards) => { 
        TRASH_ARR.push(cards[0].dataset.url); 
        cards[0].remove(); 
        saveState(); 
        appendChat("Domino cycled 1 card!", "#8e44ad"); 
    }); 
}

function magellan10cMain() { 
    hideMenu(); 
    rightClickedCard.classList.add('rested'); 
    window.batchState.magellanBuffActive = true; 
    updatePowerDisplay(); 
    saveState(); 
    appendChat(`Magellan buffed Jailer Beasts by +${window.batchState.donReturnedCount * 1000}!`, "#8e44ad"); 
}
