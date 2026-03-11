// ==========================================
// YELLOW & GREEN CARD LOGIC & ABILITIES
// ==========================================

function stussyLeaderFlip() { 
    hideMenu(); 
    const lifeCards = Array.from(document.getElementById('life-zone').children).filter(c => c.classList.contains('card')); 
    const top = lifeCards[lifeCards.length-1]; 
    if(!top || !top.classList.contains('card-back')) { showModal("Top Life must be face down.", "alert"); return; } 
    startSelection('stussy_freeze', 1, "Freeze 1 Character or Leader", (cards) => { 
        top.classList.remove('card-back'); 
        window.stussyUsedThisTurn = true; 
        window.leaderUsedThisTurn = true; 
        cards[0].classList.add('frozen'); 
        cards[0].dataset.frozenUntil = myTurnCount + 2; 
        if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'freeze', target: cards[0].id}); 
        saveState(); 
        appendChat("Stussy flipped life & froze target!", "#34dbdb"); 
    }); 
}

function lucciYellowMain() { 
    hideMenu(); 
    const lifeCards = Array.from(document.getElementById('life-zone').children).filter(c => c.classList.contains('card')); 
    const top = lifeCards[lifeCards.length-1]; 
    if(!top || top.classList.contains('card-back')) { showModal("Top Life must be face up.", "alert"); return; } 
    top.classList.add('card-back'); 
    rightClickedCard.dataset.restandAtEOT = "true"; 
    saveState(); 
    appendChat("Lucci prepares to restand at End of Turn!", "#f1c40f"); 
}

function kakuMain() { 
    hideMenu(); 
    const lifeCards = Array.from(document.getElementById('life-zone').children).filter(c => c.classList.contains('card')); 
    const top = lifeCards[lifeCards.length-1]; 
    if(!top || top.classList.contains('card-back')) { showModal("Top Life must be face up.", "alert"); return; } 
    top.classList.add('card-back'); 
    rightClickedCard.dataset.doubleAttack = "true"; 
    rightClickedCard.querySelector('.double-attack-tag').style.display='block'; 
    saveState(); 
    appendChat("Kaku gained Double Attack!", "#f1c40f"); 
}

function hattoriMain() { 
    hideMenu(); 
    const c = rightClickedCard; 
    c.classList.add('rested'); 
    saveState(); 
    startSelection('hattori_buff', 1, "Select a Rob Lucci to buff", (cards) => { 
        cards[0].dataset.tempPower = (parseInt(cards[0].dataset.tempPower||0) + 2000); 
        updatePowerDisplay(); 
        saveState(); 
        appendChat("Hattori rested to give Lucci +2000 power!", "#2ecc71"); 
    }, () => { 
        c.classList.remove('rested'); 
        saveState(); 
    }); 
}

function sSnakeEffect(c, onComplete) { 
    const lifeCards = Array.from(document.getElementById('life-zone').children).filter(card => card.classList.contains('card')); 
    const top = lifeCards[lifeCards.length-1]; 
    if(top && top.classList.contains('card-back')) { 
        showModal("S-Snake: Turn top Life face-up to give Opponent -2000 power?", "confirm", () => { 
            top.classList.remove('card-back'); 
            saveState(); 
            startSelection('ssnake_minus', 1, "Select Opp Character to give -2000", (cards) => { 
                cards[0].dataset.tempPower = parseInt(cards[0].dataset.tempPower||0) - 2000; 
                updatePowerDisplay(); 
                if(!isDevMode) socket.emit('game_action', {type: 'apply_status', status: 'minus_power', amount: 2000, target: cards[0].id}); 
                saveState(); 
                appendChat("S-Snake gave -2000 power!", "#f1c40f"); 
                if(onComplete) onComplete(); 
            }); 
        }, () => { if(onComplete) onComplete(); }); 
    } else { 
        if(onComplete) onComplete(); 
    } 
}
