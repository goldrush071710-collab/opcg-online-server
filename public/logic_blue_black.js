
// ==========================================
// BLUE & BLACK CARD LOGIC & ABILITIES
// ==========================================

function judgeLeaderMain() { 
    hideMenu(); 
    startSelection('judge_trash_germa', 1, "Trash 1 GERMA 66 from Hand or Field", (cards) => { 
        const trashedName = CARD_DB[cards[0].dataset.url]?.name; 
        const origZone = cards[0].parentElement.id; 
        moveToTrash(cards[0]); 
        drawCardAction(); 
        startSelection('sotu_cost_minus', 1, "Select Opponent Character to give -3 Cost (or Cancel)", (targets) => { 
            targets[0].dataset.tempCost = parseInt(targets[0].dataset.tempCost || CARD_DB[targets[0].dataset.url]?.cost || 0) - 3; 
            appendChat("Judge: Trashed 1 GERMA, Drew 1, gave target -3 Cost!", "#3498db"); 
            if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'minus_cost', amount: 3, target: targets[0].id}); 
            window.leaderUsedThisTurn = true; 
            saveState(); 
            if (trashedName === "Vinsmoke Sora") executeSotuTrashTriggers(trashedName, origZone); 
        }, () => { 
            appendChat("Judge: Trashed 1 GERMA and Drew 1! (Skipped -3 Cost)", "#3498db"); 
            window.leaderUsedThisTurn = true; 
            saveState(); 
            if (trashedName === "Vinsmoke Sora") executeSotuTrashTriggers(trashedName, origZone); 
        }); 
    }); 
}

function judgeMainEffect() { 
    hideMenu(); 
    const c = rightClickedCard; 
    c.classList.add('rested'); 
    startSelection('hand_trash', 1, "Trash 1 to give GERMA +1000", (cards) => { 
        const trashedName = CARD_DB[cards[0].dataset.url]?.name; 
        moveToTrash(cards[0]); 
        window.sotuTurnState.judgeGlobalPowerBuff += 1000; 
        updatePowerDisplay(); 
        saveState(); 
        appendChat("Judge: Trashed 1 card -> All GERMA gained +1000!", "#3498db"); 
        if (trashedName === "Vinsmoke Sora") executeSotuTrashTriggers(trashedName, "hand"); 
    }); 
}

function ichijiMainRamp() { 
    hideMenu(); 
    const c = rightClickedCard; 
    c.classList.add('rested'); 
    window.sotuTurnState.vinsmokeCostDiscount = 2; 
    saveState(); 
    appendChat("Ichiji: Rested -> Vinsmoke in Hand cost -2 this turn.", "#3498db"); 
}

function yonjiUnrest() { 
    hideMenu(); 
    const c = rightClickedCard; 
    c.classList.remove('rested'); 
    c.dataset.hasRush = "true"; 
    c.querySelector('.rush-tag').style.display='block'; 
    updatePowerDisplay(); 
    saveState(); 
    appendChat("Yonji (9c): Unrested and gained Rush!", "#3498db"); 
}

function reiju5cMain() { 
    hideMenu(); 
    rightClickedCard.dataset.reijuBuffExpires = turnNum + 3; 
    drawCardAction(); 
    drawCardAction(); 
    showModal("Trash 3 cards from hand.", "alert", () => { 
        startSelection('hand_trash', 3, "Select 3 to trash", (cards) => { 
            cards.forEach(c => { TRASH_ARR.push(c.dataset.url); c.remove(); }); 
            updatePowerDisplay(); 
            saveState(); 
            appendChat("Reiju modified her stats and gained Blocker!", "#3498db"); 
        }); 
    }); 
}

function sanji3cMain() { 
    hideMenu(); 
    rightClickedCard.classList.add('rested'); 
    startSelection('give_don_ramp', 1, "Attach rested DON!! to Leader/Character", (targets) => { 
        if(DON_DECK_COUNT > 0) { 
            DON_DECK_COUNT--; 
            const d = createCard(DON_URL,0,0,{zone:'don-zone'}); 
            d.classList.add('rested'); 
            d.dataset.parentId = targets[0].id; 
            updateBadges(targets[0].id); 
            organizeDon(); 
            saveState(); 
            appendChat("Sanji attached DON!!", "#3498db"); 
        } 
    }); 
}

function executeSotuTrashTriggers(cardName, origZone) { 
    if (cardName === "Vinsmoke Sora" && (origZone === "hand-bar" || origZone === "char-zone-front")) { 
        showModal("Sora Trashed! Look at top 5 for GERMA/Vinsmoke?", "confirm", () => { 
            performTopDeckSearch(5, ["GERMA 66", "Vinsmoke Family"], null, true, true); 
        }); 
    } 
}
