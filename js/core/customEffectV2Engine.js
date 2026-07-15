// customEffectV2Engine.js
// Runtime executor for safe customEffectV2 effects in solo testing.

(function customEffectV2EngineFactory(global) {
    const V2 = global.CustomEffectV2;

    if (!V2) {
        throw new Error("customEffectV2Engine.js must be loaded after customEffectV2.js.");
    }

    function isV2Effect(effect) {
        return effect?.system === "customEffectV2";
    }

    function getEventType(effect) {
        return effect?.event?.type || effect?.type || "";
    }

    function canUseEffect(player, sourceCard, effect) {
        if (!player || !sourceCard || !isV2Effect(effect)) {
            return { ok: false, reason: "Effect could not resolve." };
        }

        if (effect.automationStatus !== V2.STATUSES.automated) {
            return { ok: false, reason: `${sourceCard.name}'s effect is marked ${effect.automationStatus || "not automated"}.` };
        }

        if (
            effect.limit?.type === "oncePerTurn" &&
            global.CardEffects?.hasUsedOncePerTurnEffect?.(sourceCard, effect.id, player.turns)
        ) {
            return { ok: false, reason: "This Once Per Turn effect has already been used this turn." };
        }

        const conditionFailure = getConditionFailure(player, sourceCard, effect);
        if (conditionFailure) return { ok: false, reason: conditionFailure };

        for (const cost of effect.costs || []) {
            const failure = getCostFailure(player, sourceCard, cost);
            if (failure) return { ok: false, reason: failure };
        }

        return { ok: true, reason: "" };
    }

    function getCostFailure(player, sourceCard, cost) {
        const amount = Math.max(1, Number(cost.amount || 1));

        if (cost.type === "trashCardsFromHand" || cost.type === "discardCards") {
            return player.hand.length >= amount
                ? ""
                : `${sourceCard.name} needs ${amount} card${amount === 1 ? "" : "s"} in hand.`;
        }

        if (cost.type === "restDon") {
            return Number(player.don || 0) >= amount
                ? ""
                : `${sourceCard.name} needs ${amount} active DON!!.`;
        }

        if (cost.type === "donMinus" || cost.type === "returnDon") {
            const totalDon = Number(player.don || 0) + Number(player.restedDon || 0);
            return totalDon >= amount
                ? ""
                : `${sourceCard.name} needs ${amount} DON!! to return.`;
        }

        if (cost.type === "trashLife") {
            return player.life.length >= amount
                ? ""
                : `${sourceCard.name} needs ${amount} life.`;
        }

        if (cost.type === "trashTopDeck") {
            return player.deck.length >= amount
                ? ""
                : `${sourceCard.name} needs ${amount} card${amount === 1 ? "" : "s"} in deck.`;
        }

        if (cost.type === "placeTrashBottomDeck") {
            return player.trash.length >= amount
                ? ""
                : `${sourceCard.name} needs ${amount} card${amount === 1 ? "" : "s"} in trash.`;
        }

        if (cost.type === "placeHandBottomDeck") {
            return player.hand.length >= amount
                ? ""
                : `${sourceCard.name} needs ${amount} card${amount === 1 ? "" : "s"} in hand.`;
        }

        if (cost.type === "addLifeToHand") {
            return player.life.length >= amount
                ? ""
                : `${sourceCard.name} needs ${amount} life card${amount === 1 ? "" : "s"}.`;
        }

        if ((cost.type === "trashThisCard" || cost.type === "returnThisCardToHand") && !canMoveSourceCard(player, sourceCard)) {
            return `${sourceCard.name} is not on the board.`;
        }

        if (cost.type === "restThisCard" && (sourceCard.state || "active") === "rested") {
            return `${sourceCard.name} is already rested.`;
        }

        return "";
    }

    function runEffect({ player, sourceCard, effect, gameState, ui, options = {} }) {
        const normalized = V2.normalizeEffect(effect);
        const usable = canUseEffect(player, sourceCard, normalized);
        let pendingReturned = false;

        if (!usable.ok) {
            return { success: false, pending: false, message: usable.reason };
        }

        if (!options.skipActivationPrompt && normalized.optional && ui?.chooseEffectActivation) {
            ui.chooseEffectActivation({
                player,
                sourceCard,
                effect: normalized,
                title: sourceCard.name,
                prompt: normalized.generatedText || normalized.sourceText || "Activate this effect?",
                activateText: "Activate",
                skipText: "Skip",
                onComplete: shouldActivate => {
                    if (!shouldActivate) {
                        global.addGameLog?.(`${player.name} skipped ${sourceCard.name}'s effect.`);
                        options.onComplete?.({ success: true, skipped: true });
                        return;
                    }

                    const result = runEffect({
                        player,
                        sourceCard,
                        effect: normalized,
                        gameState,
                        ui,
                        options: {
                            ...options,
                            skipActivationPrompt: true
                        }
                    });

                    if (result.message) global.addGameLog?.(result.message);
                }
            });

            return {
                success: true,
                pending: true,
                message: `${player.name} is choosing whether to activate ${sourceCard.name}'s effect.`
            };
        }

        const finishEffect = result => {
            const finalResult = typeof result === "string"
                ? { success: true, pending: false, message: result }
                : {
                    success: result?.success !== false,
                    pending: false,
                    message: result?.message || ""
                };

            if (normalized.limit?.type === "oncePerTurn" && finalResult.success) {
                global.CardEffects?.markOncePerTurnEffectUsed?.(sourceCard, normalized.id, player.turns);
            }

            renderBoard(ui);

            if (pendingReturned && finalResult.message) {
                global.addGameLog?.(finalResult.message);
            }

            options.onComplete?.(finalResult);
            return finalResult;
        };

        return payCosts(player, sourceCard, normalized, ui, () => {
            const actionResult = executeActionsSequential(player, sourceCard, normalized, ui, gameState, finishEffect);
            if (actionResult?.pending) pendingReturned = true;
            return actionResult;
        });

        function payCosts(player, sourceCard, effect, ui, onPaid) {
            const result = payEffectCosts(player, sourceCard, effect, ui, onPaid);
            if (result?.pending) pendingReturned = true;
            return result;
        }
    }

    function payEffectCosts(player, sourceCard, effect, ui, onPaid) {
        const costs = [...(effect.costs || [])];

        const payNext = () => {
            const cost = costs.shift();

            if (!cost) {
                return onPaid();
            }

            const amount = Math.max(1, Number(cost.amount || 1));

            if (cost.type === "trashCardsFromHand" || cost.type === "discardCards") {
                global.chooseCardsFromHandToTrash?.(player, sourceCard, ui, amount, () => {
                    payNext();
                });

                return {
                    success: true,
                    pending: true,
                    message: `${player.name} is choosing ${amount} card${amount === 1 ? "" : "s"} from hand to trash for ${sourceCard.name}.`
                };
            }

            if (cost.type === "restDon") {
                if (!global.restDonForCost?.(player, amount, ui)) {
                    return { success: false, pending: false, message: `${sourceCard.name} could not rest ${amount} DON!!.` };
                }
            }

            if (cost.type === "donMinus" || cost.type === "returnDon") {
                const returned = global.returnDonToDeck?.(player, amount, ui) || 0;
                if (returned < amount) {
                    return { success: false, pending: false, message: `${sourceCard.name} could not return ${amount} DON!!.` };
                }
            }

            if (cost.type === "restThisCard") {
                if ((sourceCard.state || "active") === "rested") {
                    return { success: false, pending: false, message: `${sourceCard.name} is already rested.` };
                }
                sourceCard.state = "rested";
            }

            if (cost.type === "trashThisCard") {
                const wasCurrentAttacker = isCurrentAttackingSource(sourceCard);
                const trashed = moveSourceCardToZone(player, sourceCard, ui, "trash");
                if (!trashed) {
                    return { success: false, pending: false, message: `${sourceCard.name} could not trash itself.` };
                }
                concludeAttackIfSourceLeft(wasCurrentAttacker, sourceCard);
            }

            if (cost.type === "trashLife") {
                for (let index = 0; index < amount; index += 1) {
                    const lifeCard = player.life.shift();
                    if (lifeCard) global.moveCardToTrash?.(player, lifeCard, ui);
                }
            }

            if (cost.type === "trashTopDeck") {
                for (let index = 0; index < amount; index += 1) {
                    const card = player.deck.shift();
                    if (card) global.moveCardToTrash?.(player, card, ui);
                }
            }

            if (cost.type === "placeTrashBottomDeck") {
                for (let index = 0; index < amount; index += 1) {
                    const card = player.trash.pop();
                    if (card) player.deck.push(card);
                }
            }

            if (cost.type === "placeHandBottomDeck") {
                for (let index = 0; index < amount; index += 1) {
                    const card = player.hand.shift();
                    if (card) player.deck.push(card);
                }
            }

            if (cost.type === "addLifeToHand") {
                for (let index = 0; index < amount; index += 1) {
                    const card = player.life.shift();
                    if (card) player.hand.push(card);
                }
            }

            if (cost.type === "returnThisCardToHand") {
                const wasCurrentAttacker = isCurrentAttackingSource(sourceCard);
                const moved = moveSourceCardToZone(player, sourceCard, ui, "hand");
                if (!moved) {
                    return { success: false, pending: false, message: `${sourceCard.name} could not return itself to hand.` };
                }
                concludeAttackIfSourceLeft(wasCurrentAttacker, sourceCard);
            }

            return payNext();
        };

        const result = payNext();
        if (result && typeof result === "object") return result;

        return {
            success: true,
            pending: false,
            message: result || `${sourceCard.name}'s effect resolved.`
        };
    }

    function executeActionsSequential(player, sourceCard, effect, ui, gameState, onComplete) {
        const actions = sortActionsByPrintedOrder(effect.sourceText || effect.generatedText || effect.text || "", effect.actions || [])
            .filter(action => action.type !== "preventEvent");
        const messages = [];

        const runNext = index => {
            const action = actions[index];

            if (!action) {
                return onComplete({ success: true, message: messages.filter(Boolean).join(" ") });
            }

            const finishAction = message => {
                if (message) messages.push(message);
                return runNext(index + 1);
            };

            const result = executeOneAction(player, sourceCard, action, effect, ui, gameState, finishAction);

            if (result?.pending) {
                if (result.message) messages.push(result.message);
                return { success: true, pending: true, message: result.message || `${sourceCard.name}'s effect is resolving.` };
            }

            if (result?.message) {
                messages.push(result.message);
                return runNext(index + 1);
            }

            if (typeof result === "string") {
                messages.push(result);
                return runNext(index + 1);
            }

            return runNext(index + 1);
        };

        return runNext(0);
    }

    function sortActionsByPrintedOrder(text, actions) {
        if (!Array.isArray(actions) || actions.length < 2) return [...(actions || [])];

        return [...actions]
            .map((action, index) => ({ action, index, order: actionSourceIndex(text, action, index) }))
            .sort((left, right) => {
                if (left.order !== right.order) return left.order - right.order;
                return left.index - right.index;
            })
            .map(entry => entry.action);
    }

    function actionSourceIndex(text, action, fallbackIndex = 0) {
        const source = String(text || "");
        const fallback = source.length + fallbackIndex;
        if (!source || !action) return fallback;

        if (action.type === "playFromTrash" || action.type === "playFromHand") {
            const zone = action.type === "playFromTrash" ? "trash" : "hand";
            return regexIndex(source, new RegExp(`\\bplay\\s+(?:up\\s+to\\s+)?\\d+\\s+.+?\\s+from\\s+(?:your\\s+)?${zone}\\b`, "i")) ?? fallback;
        }

        if (action.type === "modifyPower" || action.type === "setPower") {
            const amount = Number(action.amount || 0);
            const amountText = amount > 0 ? `\\+\\s*${amount}` : String(amount);
            return regexIndex(source, new RegExp(`${amountText}\\s*(?:power)?`, "i")) ??
                regexIndex(source, /\bgains?\b|\bgive\b|\bgets?\b|\bset\b/i) ??
                fallback;
        }

        if (action.type === "giveKeyword") return regexIndex(source, keywordRegex(action.keyword)) ?? fallback;
        if (action.type === "draw") return regexIndex(source, /\bdraw\s+\d+\s+cards?\b/i) ?? fallback;
        if (action.type === "ko") return regexIndex(source, /\bk\.?\s*o\.?\b|\bko\b/i) ?? fallback;
        if (action.type === "rest") return regexIndex(source, /\brest\s+(?!this\b|\d+\s+(?:of\s+your\s+)?don)/i) ?? fallback;
        if (action.type === "setActive") return regexIndex(source, /\bset\b[\s\S]{0,80}\bactive\b/i) ?? fallback;
        if (action.type === "searchTopDeck") return regexIndex(source, /\b(?:look\s+at|reveal|search)\b[\s\S]{0,80}\btop\b/i) ?? fallback;
        if (action.type === "trashCardsFromHand") return regexIndex(source, /\btrash\s+\d+\s+cards?\s+from\s+(?:your\s+)?hand\b/i) ?? fallback;
        if (action.type === "placeHandTopDeckSelected") return regexIndex(source, /\b(?:add|place|put)\s+\d+\s+cards?\s+from\s+(?:your\s+)?hand\s+(?:to|on|at)\s+the\s+top\s+of\s+(?:your\s+)?deck\b/i) ?? fallback;
        if (action.type === "attachRestedDon") return regexIndex(source, /\b(?:give|attach)\b[\s\S]{0,80}\brested\s+don!!?\s+cards?\b/i) ?? fallback;
        if (action.type === "addStatus") return regexIndex(source, /\bcannot\b/i) ?? fallback;
        if (action.type === "trashTopDeck") return regexIndex(source, /\btrash\s+the\s+top\s+\d+\s+cards?\b/i) ?? fallback;
        if (action.type === "trashThisCard") return regexIndex(source, /\btrash\s+this\b/i) ?? fallback;

        return fallback;
    }

    function regexIndex(text, regex) {
        const match = String(text || "").match(regex);
        return match ? match.index : null;
    }

    function keywordRegex(keyword) {
        const value = String(keyword || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        if (value === "rushcharacters") return /\brush\s*:\s*characters?\b|\bcharacters?\s*:\s*rush\b/i;
        if (value === "doubleattack") return /\bdouble\s+attack\b/i;
        if (value === "blocker") return /\bblocker\b/i;
        if (value === "rush") return /\brush\b/i;
        if (value === "banish") return /\bbanish\b/i;
        if (value === "unblockable") return /\bunblockable\b/i;
        return new RegExp(escapeRegExp(keyword), "i");
    }

    function escapeRegExp(value) {
        return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function executeOneAction(player, sourceCard, action, effect, ui, gameState, onComplete) {
        if (Array.isArray(action.conditions) && action.conditions.some(condition => !conditionMet(player, sourceCard, condition))) {
            return { message: "" };
        }

        if (action.type === "draw") {
            const amount = Math.max(1, Number(action.amount || 1));
            for (let index = 0; index < amount; index += 1) {
                global.drawCard?.(player, ui);
            }
            return { message: `${sourceCard.name} drew ${amount} card${amount === 1 ? "" : "s"}.` };
        }

        if (action.type === "opponentDraw") {
            const opponent = global.getOpponentPlayer?.(player);
            const amount = Math.max(1, Number(action.amount || 1));
            if (!opponent) return { message: `${sourceCard.name} could not find the opponent.` };
            for (let index = 0; index < amount; index += 1) {
                global.drawCard?.(opponent, ui);
            }
            return { message: `${opponent.name} drew ${amount} card${amount === 1 ? "" : "s"}.` };
        }

        if (action.type === "trashTopDeck") {
            const amount = Math.max(1, Number(action.amount || 1));
            for (let index = 0; index < amount; index += 1) {
                const card = player.deck.shift();
                if (card) global.moveCardToTrash?.(player, card, ui);
            }
            return { message: `${sourceCard.name} trashed the top ${amount} card${amount === 1 ? "" : "s"} of ${player.name}'s deck.` };
        }

        if (action.type === "setDonActive") {
            const amount = Math.max(1, Number(action.amount || 1));
            const refreshed = global.setRestedDonActive?.(player, amount, ui) || 0;
            return { message: `${sourceCard.name} set ${refreshed} DON!! active.` };
        }

        if (action.type === "addDon" || action.type === "addRestedDon") {
            const amount = Math.max(1, Number(action.amount || 1));
            const added = action.type === "addDon"
                ? global.addDon?.(player, amount, ui) || 0
                : global.addRestedDon?.(player, amount, ui) || 0;
            return { message: `${sourceCard.name} added ${added} ${action.type === "addDon" ? "active" : "rested"} DON!!.` };
        }

        if (action.type === "trashLife" || action.type === "trashOpponentLife") {
            const targetPlayer = action.type === "trashOpponentLife"
                ? global.getOpponentPlayer?.(player)
                : player;
            const amount = Math.max(1, Number(action.amount || 1));
            let trashed = 0;

            for (let index = 0; index < amount; index += 1) {
                const card = targetPlayer?.life?.shift();
                if (card) {
                    global.moveCardToTrash?.(targetPlayer, card, ui);
                    trashed += 1;
                }
            }

            return { message: `${sourceCard.name} trashed ${trashed} life card${trashed === 1 ? "" : "s"} from ${targetPlayer?.name || "a player"}.` };
        }

        if (action.type === "healLife") {
            const amount = Math.max(1, Number(action.amount || 1));
            let healed = 0;

            for (let index = 0; index < amount; index += 1) {
                const card = player.deck.shift();
                if (card) {
                    player.life.push(typeof global.setLifeCardFaceUpIfNeeded === "function"
                        ? global.setLifeCardFaceUpIfNeeded(card)
                        : card);
                    healed += 1;
                }
            }

            return { message: `${sourceCard.name} added ${healed} card${healed === 1 ? "" : "s"} to ${player.name}'s life.` };
        }

        if (action.type === "trashCardsFromHand" || action.type === "opponentTrashCardsFromHand") {
            const targetPlayer = action.type === "opponentTrashCardsFromHand"
                ? global.getOpponentPlayer?.(player)
                : player;
            const amount = Math.max(1, Number(action.amount || 1));

            if (!targetPlayer || targetPlayer.hand.length < amount) {
                return { message: `${sourceCard.name} found too few cards in hand to trash.` };
            }

            global.chooseCardsFromHandToTrash?.(targetPlayer, sourceCard, ui, amount, () => {
                onComplete(`${sourceCard.name} trashed ${amount} card${amount === 1 ? "" : "s"} from ${targetPlayer.name}'s hand.`);
            });

            return {
                pending: true,
                message: `${targetPlayer.name} is choosing ${amount} card${amount === 1 ? "" : "s"} from hand to trash for ${sourceCard.name}.`
            };
        }

        if (action.type === "opponentPlaceHandBottomDeck") {
            const opponent = global.getOpponentPlayer?.(player);
            const amount = Math.max(1, Number(action.amount || 1));
            if (!opponent || opponent.hand.length < amount) {
                return { message: `${sourceCard.name} found too few opponent hand cards.` };
            }
            let moved = 0;
            for (let index = 0; index < amount; index += 1) {
                const card = opponent.hand.shift();
                if (card) {
                    opponent.deck.push(card);
                    moved += 1;
                }
            }
            ui?.renderHands?.();
            ui?.renderDecks?.();
            return { message: `${sourceCard.name} placed ${moved} card${moved === 1 ? "" : "s"} from ${opponent.name}'s hand on the bottom of their deck.` };
        }

        if (action.type === "placeHandBottomDeck") {
            const amount = Math.max(1, Number(action.amount || 1));
            let moved = 0;
            for (let index = 0; index < amount; index += 1) {
                const card = player.hand.shift();
                if (card) {
                    player.deck.push(card);
                    moved += 1;
                }
            }
            return { message: `${sourceCard.name} placed ${moved} card${moved === 1 ? "" : "s"} from hand on the bottom of the deck.` };
        }

        if (action.type === "searchTopDeck") {
            return resolveSearchAction(player, sourceCard, action, effect, ui, onComplete);
        }

        if (action.type === "chooseOne") {
            return resolveChooseOneAction(player, sourceCard, action, effect, ui, gameState, onComplete);
        }

        if (["ko", "rest", "setActive", "bounceToHand", "placeBottomDeck", "placeTrashBottomDeckSelected", "trashBoardCard", "modifyPower", "setPower", "giveKeyword", "modifyCost", "addStatus", "attachRestedDon", "playFromHand", "playFromTrash", "playFromHandOrTrash", "addFromTrashToHand", "trashSelectedHand", "placeHandTopDeckSelected"].includes(action.type)) {
            return resolveTargetedAction(player, sourceCard, action, effect, ui, gameState, onComplete);
        }

        if (action.type === "addCardAliases") {
            sourceCard.aliases = Array.from(new Set([...(sourceCard.aliases || []), ...(action.aliases || [])]));
            return { message: `${sourceCard.name}'s alternate names were registered.` };
        }

        if (action.type === "playThisCard") {
            const message = global.playCardFromTrigger?.(player, sourceCard, ui);
            return { message: message || `${sourceCard.name} could not play itself.` };
        }

        if (action.type === "addThisCardToHand") {
            if (!player.hand.includes(sourceCard)) {
                player.hand.push(sourceCard);
            }
            ui?.renderHands?.();
            return { message: `${sourceCard.name} was added to ${player.name}'s hand.` };
        }

        if (action.type === "activateMainEffect") {
            const messages = global.resolveMainEffects?.(player, sourceCard, ui, {
                skipActivationPrompt: true
            }) || [];
            return {
                message: messages.length
                    ? `${sourceCard.name}'s Main effect resolved. ${messages.join(" ")}`
                    : `${sourceCard.name}'s Main effect resolved.`
            };
        }

        if (action.type === "trashThisCard") {
            const wasCurrentAttacker = isCurrentAttackingSource(sourceCard);
            const moved = moveSourceCardToZone(player, sourceCard, ui, "trash");
            concludeAttackIfSourceLeft(wasCurrentAttacker && moved, sourceCard);
            return { message: moved ? `${sourceCard.name} trashed itself.` : `${sourceCard.name} could not trash itself.` };
        }

        return { message: `${sourceCard.name}'s ${action.type} action is not supported yet.` };
    }

    function runOpponentPlaysStageEffects(stagePlayer, playedStage, ui, gameState) {
        const opponent = global.getOpponentPlayer?.(stagePlayer);
        if (!opponent) return [];

        return getOwnerEffectSources(opponent)
            .flatMap(source => (source.card.effects || [])
                .filter(effect => isV2Effect(effect) && getEventType(effect) === V2.EVENTS.opponentPlaysStage)
                .map(effect => ({ sourceCard: source.card, effect })))
            .map(entry => runEffect({
                player: opponent,
                sourceCard: entry.sourceCard,
                effect: entry.effect,
                gameState,
                ui
            }))
            .map(result => result?.message)
            .filter(Boolean);
    }

    function resolveTargetedAction(player, sourceCard, action, effect, ui, gameState, onComplete) {
        const directTargets = resolveDirectTargets(player, sourceCard, action.target);

        if (directTargets.length && !effect?.targets?.some(entry => entry.id === action.target)) {
            if (action.optional && ui?.chooseEffectActivation) {
                ui.chooseEffectActivation({
                    player,
                    sourceCard,
                    effect,
                    title: sourceCard.name,
                    prompt: `${sourceCard.name}: ${actionPrompt(action)}`,
                    activateText: "Resolve",
                    skipText: "Skip",
                    onComplete: shouldResolve => {
                        if (!shouldResolve) {
                            onComplete(`${player.name} skipped ${sourceCard.name}'s optional ${action.type} action.`);
                            return;
                        }

                        const messages = directTargets
                            .map(card => applyDirectCardAction(player, sourceCard, action, card, ui))
                            .filter(Boolean);
                        onComplete(messages.join(" "));
                    }
                });

                return {
                    pending: true,
                    message: `${player.name} is choosing whether to resolve ${sourceCard.name}'s optional action.`
                };
            }

            const messages = directTargets
                .map(card => applyDirectCardAction(player, sourceCard, action, card, ui))
                .filter(Boolean);
            return { message: messages.join(" ") };
        }

        const selectionTarget = effect?.targets?.find(entry => entry.id === String(action.target || ""));

        if (!selectionTarget) {
            return { message: `${sourceCard.name}'s ${action.type} action needs a selectable target.` };
        }

        const cachedSelection = getCachedSelection(effect, action.target);
        if (cachedSelection !== undefined) {
            if (!cachedSelection) {
                return { message: "" };
            }

            return {
                message: applyChoiceActions(player, sourceCard, action, cachedSelection, ui, gameState)
            };
        }

        if (selectionTarget.zone === "hand") {
            return resolveHandSelectionAction(player, sourceCard, action, selectionTarget, ui, onComplete);
        }

        if (selectionTarget.zone === "trash") {
            return resolveTrashSelectionAction(player, sourceCard, action, selectionTarget, ui, onComplete);
        }

        if (selectionTarget.zone === "handOrTrash") {
            return resolveHandOrTrashSelectionAction(player, sourceCard, action, selectionTarget, ui, onComplete);
        }

        const choices = getChoicesForSelectionTarget(player, selectionTarget);
        const validChoices = choices.filter(choice => matchesFilters(choice.card, selectionTarget.filters || []));

        if (!validChoices.length) {
            return { message: `${sourceCard.name} found no valid targets.` };
        }

        const maxChoices = Math.max(1, Number(selectionTarget.count?.max || 1));
        if (maxChoices > 1 && action.type !== "placeBottomDeck" && global.chooseBoardCard) {
            return resolveMultiBoardSelection(player, sourceCard, action, effect, selectionTarget, validChoices, ui, gameState, onComplete);
        }

        const message = global.chooseBoardCard?.(player, sourceCard, validChoices, {
            prompt: actionPrompt(action),
            optional: selectionTarget.optional !== false,
            filter: choiceCard => matchesFilters(choiceCard, selectionTarget.filters || []),
            onSelect: choice => {
                if (action.type === "placeBottomDeck" && action.destination === "topOrBottom" && ui?.chooseEffectOption) {
                    ui.chooseEffectOption({
                        player,
                        sourceCard,
                        title: sourceCard.name,
                        prompt: `Place ${choice.card.name} on the top or bottom of its owner's deck?`,
                        options: [
                            { label: "Top of deck", value: "top_deck" },
                            { label: "Bottom of deck", value: "bottom_deck" }
                        ],
                        onComplete: destination => {
                            const actionMessage = applyChoiceAction(
                                player,
                                sourceCard,
                                { ...action, resolvedDestination: destination },
                                choice,
                                ui,
                                gameState
                            );
                            onComplete(actionMessage);
                        }
                    });
                    return;
                }

                const actionMessage = applyChoiceAction(player, sourceCard, action, choice, ui, gameState);
                cacheSelection(effect, action.target, choice);
                onComplete(actionMessage);
            },
            onSkip: () => {
                cacheSelection(effect, action.target, null);
                onComplete(`${player.name} did not choose a target for ${sourceCard.name}.`);
            },
            onEmpty: () => {
                cacheSelection(effect, action.target, null);
                onComplete(`${sourceCard.name} found no valid targets.`);
            },
            skipMessage: `${player.name} did not choose a target for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no valid targets.`
        });

        return { pending: Boolean(global.chooseBoardCard), message };
    }

    function resolveMultiBoardSelection(player, sourceCard, action, effect, selectionTarget, validChoices, ui, gameState, onComplete) {
        const maxChoices = Math.max(1, Number(selectionTarget.count?.max || 1));
        const minChoices = Math.max(0, Number(selectionTarget.count?.min || 0));
        const selected = [];
        const selectedKeys = new Set();

        const choiceKey = choice => [
            choice?.playerKey || "",
            choice?.cardType || "",
            choice?.slotIndex ?? "",
            choice?.card?.cardNumber || choice?.card?.id || choice?.card?.name || ""
        ].join(":");

        const finishSelection = message => {
            if (!selected.length) {
                cacheSelection(effect, action.target, null);
                onComplete(message || `${player.name} did not choose a target for ${sourceCard.name}.`);
                return;
            }

            cacheSelection(effect, action.target, selected.slice());
            onComplete(applyChoiceActions(player, sourceCard, action, selected, ui, gameState));
        };

        const chooseNext = () => {
            if (selected.length >= maxChoices) {
                finishSelection();
                return;
            }

            const remainingChoices = validChoices.filter(choice => !selectedKeys.has(choiceKey(choice)));
            if (!remainingChoices.length) {
                if (selected.length >= minChoices) finishSelection();
                else finishSelection(`${sourceCard.name} found no more valid targets.`);
                return;
            }

            global.chooseBoardCard(player, sourceCard, remainingChoices, {
                prompt: `${actionPrompt(action)} Choose up to ${maxChoices}. (${selected.length}/${maxChoices} selected)`,
                optional: true,
                filter: choiceCard => matchesFilters(choiceCard, selectionTarget.filters || []),
                onSelect: choice => {
                    const key = choiceKey(choice);
                    if (!selectedKeys.has(key)) {
                        selectedKeys.add(key);
                        selected.push(choice);
                    }
                    chooseNext();
                },
                onSkip: () => {
                    if (selected.length >= minChoices) finishSelection();
                    else finishSelection(`${player.name} did not choose enough targets for ${sourceCard.name}.`);
                },
                onEmpty: () => finishSelection(`${sourceCard.name} found no valid targets.`),
                skipMessage: selected.length
                    ? `Done selecting targets for ${sourceCard.name}.`
                    : `${player.name} did not choose a target for ${sourceCard.name}.`,
                emptyMessage: `${sourceCard.name} found no valid targets.`
            });
        };

        chooseNext();

        return {
            pending: true,
            message: `${player.name} is choosing up to ${maxChoices} targets for ${sourceCard.name}.`
        };
    }

    function getCachedSelection(effect, targetId) {
        if (!targetId || !effect?.__resolvedSelections) return undefined;
        return Object.prototype.hasOwnProperty.call(effect.__resolvedSelections, targetId)
            ? effect.__resolvedSelections[targetId]
            : undefined;
    }

    function cacheSelection(effect, targetId, choice) {
        if (!targetId || !effect) return;
        if (!effect.__resolvedSelections) effect.__resolvedSelections = {};
        effect.__resolvedSelections[targetId] = choice || null;
    }

    function resolveSearchAction(player, sourceCard, action, effect, ui, onComplete) {
        const selectionTarget = effect?.targets?.find(entry => entry.id === String(action.target || ""));
        const amount = Math.max(1, Number(action.amount || 5));
        const maxSelect = Math.max(1, Number(action.maxSelect || selectionTarget?.count?.max || 1));
        const filters = selectionTarget?.filters || [];
        const isSelectable = card => matchesFilters(card, filters);
        const message = global.lookTopCardsForType?.(player, sourceCard, amount, "", ui, {
            isSelectable,
            maxSelect,
            selectedDestination: action.selectedDestination || "hand",
            restDestination: action.restDestination || "bottomDeck",
            grantKeyword: action.grantKeyword,
            afterComplete: () => onComplete(`${sourceCard.name}'s search resolved.`)
        }) || `${sourceCard.name} could not search the deck.`;

        return { pending: Boolean(ui?.lookTopCardsAddToHand), message };
    }

    function resolveChooseOneAction(player, sourceCard, action, effect, ui, gameState, onComplete) {
        const options = Array.isArray(action.options) ? action.options.filter(option => option?.actions?.length) : [];

        if (!options.length) {
            return { message: `${sourceCard.name} had no available modes.` };
        }

        const runOption = option => {
            const optionEffect = {
                ...effect,
                actions: option.actions
            };
            return executeActionsSequential(player, sourceCard, optionEffect, ui, gameState, result => {
                onComplete(result?.message || `${sourceCard.name}'s selected mode resolved.`);
            });
        };

        if (options.length === 1 || !ui?.chooseEffectOption) {
            return runOption(options[0]);
        }

        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: "Choose one effect.",
            options: options.map(option => ({
                label: option.label || option.text || option.id,
                value: option.id
            })),
            onComplete: optionId => {
                const option = options.find(entry => entry.id === optionId) || options[0];
                runOption(option);
            }
        });

        return {
            pending: true,
            message: `${player.name} is choosing a mode for ${sourceCard.name}.`
        };
    }

    function resolveHandSelectionAction(player, sourceCard, action, target, ui, onComplete) {
        const owner = target.controller === "opponent"
            ? global.getOpponentPlayer?.(player)
            : player;
        const choices = global.getHandCardChoices?.(owner, card => matchesFilters(card, target.filters || [])) || [];
        if (!choices.length) {
            return { message: `${sourceCard.name} found no valid cards in hand.` };
        }

        const finishWithChoice = choice => {
            if (!choice) {
                onComplete(`${sourceCard.name} did not resolve a hand choice.`);
                return;
            }

            let actionMessage = "";

            if (action.type === "playFromHand") {
                const playResult = global.playCharacterFromHandWithoutCost?.(
                    player,
                    choice.handIndex,
                    ui,
                    sourceCard,
                    message => onComplete(message || `${sourceCard.name} played a character from hand.`)
                );

                if (playResult?.pending) {
                    return;
                }

                actionMessage = actionResultMessage(playResult);
            } else if (action.type === "trashSelectedHand") {
                const card = owner.hand.splice(choice.handIndex, 1)[0];
                if (card) {
                    global.moveCardToTrash?.(owner, card, ui);
                    ui?.renderHands?.();
                    ui?.renderTrash?.();
                    actionMessage = `${sourceCard.name} trashed ${card.name} from ${owner.name}'s hand.`;
                }
            } else if (action.type === "placeHandTopDeckSelected") {
                const card = owner.hand.splice(choice.handIndex, 1)[0];
                if (card) {
                    owner.deck.unshift(card);
                    ui?.renderHands?.();
                    ui?.renderDecks?.();
                    actionMessage = `${sourceCard.name} placed ${card.name} from ${owner.name}'s hand on top of their deck.`;
                }
            } else {
                actionMessage = `${sourceCard.name} cannot use that hand action yet.`;
            }

            onComplete(actionMessage);
        };

        if (ui?.chooseEffectOption && choices.length > 1) {
            const options = choices.map(choice => ({
                label: choice.card.name,
                value: choice.handIndex,
                card: choice.card
            }));

            if (target.optional) {
                options.push({ label: "Skip", value: "__skip__" });
            }

            ui.chooseEffectOption({
                player,
                sourceCard,
                title: sourceCard.name,
                prompt: actionPrompt(action),
                options,
                onComplete: handIndex => {
                    if (handIndex === "__skip__") {
                        onComplete(`${player.name} did not choose a hand card for ${sourceCard.name}.`);
                        return;
                    }

                    const choice = choices.find(entry => Number(entry.handIndex) === Number(handIndex));
                    finishWithChoice(choice);
                }
            });

            return { pending: true, message: `${player.name} is choosing a hand card for ${sourceCard.name}.` };
        }

        if (target.optional && ui?.chooseEffectOption) {
            ui.chooseEffectOption({
                player,
                sourceCard,
                title: sourceCard.name,
                prompt: `Use ${choices[0].card.name} from hand for ${sourceCard.name}?`,
                options: [
                    { label: choices[0].card.name, value: choices[0].handIndex, card: choices[0].card },
                    { label: "Skip", value: "__skip__", secondary: true }
                ],
                onComplete: value => {
                    if (value === "__skip__") {
                        onComplete(`${player.name} did not choose a hand card for ${sourceCard.name}.`);
                        return;
                    }
                    finishWithChoice(choices[0]);
                }
            });

            return { pending: true, message: `${player.name} is choosing a hand card for ${sourceCard.name}.` };
        }

        finishWithChoice(choices[0]);
        return { pending: true, message: `${player.name} chose ${choices[0].card.name} for ${sourceCard.name}.` };
    }

    function resolveTrashSelectionAction(player, sourceCard, action, target, ui, onComplete) {
        const owner = target.controller === "opponent"
            ? global.getOpponentPlayer?.(player)
            : player;
        const playerKey = global.getPlayerKey?.(owner);
        const choices = (owner?.trash || [])
            .map((card, trashIndex) => ({ playerKey, cardType: "trash", trashIndex, card }))
            .filter(choice => choice.card && matchesFilters(choice.card, target.filters || []));

        if (!choices.length) {
            return { message: `${sourceCard.name} found no valid cards in trash.` };
        }

        const finishWithChoice = choice => {
            let message = "";
            if (action.type === "addFromTrashToHand") {
                const card = owner.trash.splice(choice.trashIndex, 1)[0];
                if (card) {
                    player.hand.push(card);
                    message = `${sourceCard.name} returned ${card.name} from trash to hand.`;
                }
            } else if (action.type === "playFromTrash") {
                const card = owner.trash.splice(choice.trashIndex, 1)[0];
                if (normalizeCardType(card?.cardType) === "character") {
                    player.hand.push(card);
                    const handIndex = player.hand.length - 1;
                    const playResult = global.playCharacterFromHandWithoutCost?.(
                        player,
                        handIndex,
                        ui,
                        sourceCard,
                        resolvedMessage => {
                            ui?.renderTrash?.();
                            ui?.renderDecks?.();
                            onComplete(resolvedMessage || `${sourceCard.name} played ${card.name} from trash.`);
                        }
                    );

                    if (playResult?.pending) {
                        return;
                    }

                    message = actionResultMessage(playResult);
                } else if (card) {
                    owner.trash.splice(choice.trashIndex, 0, card);
                    message = `${sourceCard.name} can only play character cards from trash right now.`;
                }
            } else if (action.type === "placeTrashBottomDeckSelected") {
                const card = owner.trash.splice(choice.trashIndex, 1)[0];
                if (card) {
                    owner.deck.push(card);
                    message = `${sourceCard.name} placed ${card.name} from ${owner.name}'s trash on the bottom of their deck.`;
                }
            }
            ui?.renderTrash?.();
            ui?.renderDecks?.();
            onComplete(message);
        };

        if (choices.length === 1 || !ui?.chooseEffectOption) {
            if (target.optional && ui?.chooseEffectOption) {
                ui.chooseEffectOption({
                    player,
                    sourceCard,
                    title: sourceCard.name,
                    prompt: `Use ${choices[0].card.name} from trash for ${sourceCard.name}?`,
                    options: [
                        { label: choices[0].card.name, value: choices[0].trashIndex, card: choices[0].card },
                        { label: "Skip", value: "__skip__", secondary: true }
                    ],
                    onComplete: value => {
                        if (value === "__skip__") {
                            onComplete(`${player.name} did not choose a trash card for ${sourceCard.name}.`);
                            return;
                        }
                        finishWithChoice(choices[0]);
                    }
                });
                return { pending: true, message: `${player.name} is choosing a trash card for ${sourceCard.name}.` };
            }

            finishWithChoice(choices[0]);
            return { pending: true, message: `${player.name} chose ${choices[0].card.name} for ${sourceCard.name}.` };
        }

        const options = choices.map(choice => ({
            label: choice.card.name,
            value: choice.trashIndex,
            card: choice.card
        }));

        if (target.optional) {
            options.push({ label: "Skip", value: "__skip__", secondary: true });
        }

        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: actionPrompt(action),
            options,
            onComplete: trashIndex => {
                if (trashIndex === "__skip__") {
                    onComplete(`${player.name} did not choose a trash card for ${sourceCard.name}.`);
                    return;
                }

                const choice = choices.find(entry => Number(entry.trashIndex) === Number(trashIndex));
                finishWithChoice(choice);
            }
        });

        return { pending: true, message: `${player.name} is choosing a trash card for ${sourceCard.name}.` };
    }

    function resolveHandOrTrashSelectionAction(player, sourceCard, action, target, ui, onComplete) {
        const handChoices = (global.getHandCardChoices?.(player, card => matchesFilters(card, target.filters || [])) || [])
            .map(choice => ({ ...choice, zone: "hand", value: `hand:${choice.handIndex}` }));
        const playerKey = global.getPlayerKey?.(player);
        const trashChoices = (player.trash || [])
            .map((card, trashIndex) => ({ playerKey, cardType: "trash", trashIndex, card, zone: "trash", value: `trash:${trashIndex}` }))
            .filter(choice => choice.card && matchesFilters(choice.card, target.filters || []));
        const choices = [...handChoices, ...trashChoices];

        if (!choices.length) {
            return { message: `${sourceCard.name} found no valid cards in hand or trash.` };
        }

        const finishWithChoice = choice => {
            if (!choice) {
                onComplete(`${sourceCard.name} did not resolve a hand/trash choice.`);
                return;
            }

            if (choice.zone === "hand") {
                const playResult = global.playCharacterFromHandWithoutCost?.(
                    player,
                    choice.handIndex,
                    ui,
                    sourceCard,
                    message => onComplete(message || `${sourceCard.name} played a character from hand.`)
                );
                if (playResult?.pending) return;
                onComplete(actionResultMessage(playResult));
                return;
            }

            const card = player.trash.splice(choice.trashIndex, 1)[0];
            if (normalizeCardType(card?.cardType) === "character") {
                player.hand.push(card);
                const handIndex = player.hand.length - 1;
                const playResult = global.playCharacterFromHandWithoutCost?.(
                    player,
                    handIndex,
                    ui,
                    sourceCard,
                    message => {
                        ui?.renderTrash?.();
                        onComplete(message || `${sourceCard.name} played ${card.name} from trash.`);
                    }
                );
                if (playResult?.pending) return;
                onComplete(actionResultMessage(playResult));
                return;
            }
            if (card) player.trash.splice(choice.trashIndex, 0, card);
            onComplete(`${sourceCard.name} can only play character cards from trash right now.`);
        };

        if (!ui?.chooseEffectOption) {
            finishWithChoice(choices[0]);
            return { pending: true, message: `${player.name} chose ${choices[0].card.name} for ${sourceCard.name}.` };
        }

        const options = choices.map(choice => ({
            label: `${choice.card.name} (${choice.zone})`,
            value: choice.value,
            card: choice.card
        }));

        if (target.optional) options.push({ label: "Skip", value: "__skip__", secondary: true });

        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: actionPrompt(action),
            options,
            onComplete: value => {
                if (value === "__skip__") {
                    onComplete(`${player.name} did not choose a card for ${sourceCard.name}.`);
                    return;
                }
                finishWithChoice(choices.find(choice => choice.value === value));
            }
        });

        return { pending: true, message: `${player.name} is choosing a card from hand or trash for ${sourceCard.name}.` };
    }


    function getChoicesForSelectionTarget(player, target) {
        const controllers = target.controller === "any"
            ? ["self", "opponent"]
            : [target.controller || "self"];

        return controllers.flatMap(controller => {
            const owner = controller === "opponent"
                ? global.getOpponentPlayer?.(player)
                : player;

            if (!owner) return [];

            const includeLeader = target.zone === "leader" || target.zone === "leaderOrCharacters" || target.zone === "board";
            const includeStage = target.zone === "stage" || target.zone === "board";

            if (controller === "opponent") {
                if (target.zone === "characters") return global.getOpponentCharacterChoices?.(player) || [];
                return global.getOpponentBoardChoices?.(player, { includeLeader, includeStage }) || [];
            }

            if (target.zone === "characters") {
                return global.getOwnBoardChoices?.(player, { includeLeader: false, includeStage: false }) || [];
            }

            return global.getOwnBoardChoices?.(player, { includeLeader, includeStage }) || [];
        }).filter(choice => {
            if (!choice.card) return false;
            const choiceType = normalizeCardType(choice.cardType || choice.card?.cardType);
            if (target.zone === "characters") return choiceType === "character";
            if (target.zone === "leader") return choiceType === "leader";
            if (target.zone === "stage") return choiceType === "stage";
            if (target.zone === "leaderOrCharacters") return choiceType === "leader" || choiceType === "character";
            return true;
        });
    }

    function actionPrompt(action) {
        if (action.type === "ko") return "Choose a character to K.O.";
        if (action.type === "rest") return "Choose a card to rest.";
        if (action.type === "setActive") return "Choose a card to set active.";
        if (action.type === "bounceToHand") return "Choose a card to return to hand.";
        if (action.type === "placeBottomDeck") return "Choose a card to place on the bottom of its owner's deck.";
        if (action.type === "placeTrashBottomDeckSelected") return "Choose a trash card to place on the bottom of its owner's deck.";
        if (action.type === "modifyPower") return "Choose a leader or character to modify power.";
        if (action.type === "setPower") return "Choose a leader or character to set power.";
        if (action.type === "modifyCost") return "Choose a character to modify cost.";
        if (action.type === "giveKeyword") return "Choose a leader or character to gain a keyword.";
        if (action.type === "addStatus") return "Choose a card to receive the status.";
        if (action.type === "attachRestedDon") return "Choose a leader or character to receive rested DON!!.";
        if (action.type === "playFromHand") return "Choose a card from hand to play.";
        if (action.type === "trashSelectedHand") return "Choose a card from hand to trash.";
        if (action.type === "playFromTrash") return "Choose a card from trash to play.";
        if (action.type === "addFromTrashToHand") return "Choose a card from trash to add to hand.";
        return "Choose a target.";
    }

    function matchesFilters(card, filters) {
        return filters.every(filter => {
            if (filter.field === "any") {
                return (filter.branches || []).some(branch => matchesFilters(card, branch));
            }
            const value = getCardFieldValue(card, filter.field);
            if (filter.operator === "<=") return Number(value) <= Number(filter.value);
            if (filter.operator === ">=") return Number(value) >= Number(filter.value);
            if (filter.operator === "==") {
                if (filter.field === "notSelf") return Boolean(value) === Boolean(filter.value);
                return String(value).toLowerCase() === String(filter.value).toLowerCase();
            }
            if (filter.operator === "!=") {
                if (filter.value === "__SOURCE_CARD__") return true;
                return String(value).toLowerCase() !== String(filter.value).toLowerCase();
            }
            if (filter.operator === "includes") {
                if (filter.field === "keyword" && global.CardEffects?.hasKeyword) {
                    return global.CardEffects.hasKeyword(card, filter.value);
                }
                if (filter.field === "type" && typeof global.hasExactTypeText === "function") {
                    return global.hasExactTypeText(card, filter.value);
                }
                return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
            }
            return true;
        });
    }

    function getCardFieldValue(card, field) {
        if (field === "cost") return global.getCardEffectiveCost?.(card) ?? Number(card.cost || 0);
        if (field === "power") return global.getCardBattlePower?.(card, global.getPlayerForBoardCard?.(card)) ?? Number(card.power || 0);
        if (field === "basePower") return Number(card.power || 0);
        if (field === "attachedDon") return Number(card.attachedDon || 0);
        if (field === "type") return card.type || "";
        if (field === "cardType") return normalizeCardType(card.cardType || "");
        if (field === "color") return Array.isArray(card.colors) ? card.colors.join(" ") : (card.color || "");
        if (field === "keyword") return [
            ...(card.keywords || []),
            ...(card.temporaryKeywords || []),
            ...(card.battleKeywords || [])
        ].join(" ");
        if (field === "rested") return (card.state || "active") === "rested";
        if (field === "active") return (card.state || "active") === "active";
        if (field === "notSelf") return true;
        if (field === "name") return card.name || "";
        return card[field] ?? "";
    }

    function normalizeCardType(value) {
        return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
    }

    function applyChoiceAction(player, sourceCard, action, choice, ui, gameState) {
        if (!choice?.card) return "";

        return applyDirectCardAction(player, sourceCard, action, choice.card, ui, choice);
    }

    function actionResultMessage(result) {
        if (!result) return "";
        if (typeof result === "string") return result;
        if (typeof result.message === "string") return result.message;
        return "";
    }

    function applyChoiceActions(player, sourceCard, action, choices, ui, gameState) {
        const list = Array.isArray(choices) ? choices : [choices];
        return list
            .map(choice => applyChoiceAction(player, sourceCard, action, choice, ui, gameState))
            .filter(Boolean)
            .join(" ");
    }

    function applyDirectCardAction(player, sourceCard, action, card, ui, choice = null) {
        if (!card) return "";

        if (action.type === "ko") {
            return koChoiceCharacter(player, sourceCard, choice || choiceForBoardCard(card), ui);
        }

        if (action.type === "trashBoardCard") {
            return trashChoiceBoardCard(player, sourceCard, choice || choiceForBoardCard(card), ui);
        }

        if (action.type === "rest") {
            if (isStatusActive(card.cannotBeRestedUntil, global.getPlayerForBoardCard?.(card) || player)) {
                return `${card.name} cannot be rested right now.`;
            }

            card.state = "rested";
            renderBoard(ui);
            return `${sourceCard.name} rested ${card.name}.`;
        }

        if (action.type === "setActive") {
            if (isStatusActive(card.cannotBecomeActiveUntil, global.getPlayerForBoardCard?.(card) || player)) {
                return `${card.name} cannot become active right now.`;
            }
            card.state = "active";
            renderBoard(ui);
            return `${sourceCard.name} set ${card.name} active.`;
        }

        if (action.type === "bounceToHand") {
            return moveChoiceToHand(player, sourceCard, choice, ui);
        }

        if (action.type === "placeBottomDeck") {
            const destination = action.resolvedDestination ||
                (action.destination === "top" ? "top_deck" : "bottom_deck");
            return global.moveBoardCardToOwnersDeck?.(player, choice, sourceCard, ui, destination) || "";
        }

        if (action.type === "modifyPower") {
            const amount = Number(action.amount || 0);
            if (action.duration === V2.DURATIONS.duringBattle) {
                global.addBattlePowerBonus?.(card, amount);
            } else if (action.duration === V2.DURATIONS.permanent) {
                card.power = Number(card.power || 0) + amount;
            } else {
                global.addTemporaryPowerBonus?.(card, amount);
            }
            renderBoard(ui);
            return `${sourceCard.name} gave ${card.name} ${amount >= 0 ? "+" : ""}${amount} power${durationText(action.duration)}.`;
        }

        if (action.type === "setPower") {
            const amount = Number(action.amount || 0);
            if (!Number.isFinite(amount)) {
                return `${sourceCard.name} could not set ${card.name}'s power.`;
            }

            if (action.duration === V2.DURATIONS.duringBattle) {
                const current = global.getCardBattlePower?.(card, global.getPlayerForBoardCard?.(card) || player) ?? Number(card.power || 0);
                global.addBattlePowerBonus?.(card, amount - Number(current || 0));
            } else if (action.duration === V2.DURATIONS.untilEndOfTurn) {
                const current = global.getCardBattlePower?.(card, global.getPlayerForBoardCard?.(card) || player) ?? Number(card.power || 0);
                global.addTemporaryPowerBonus?.(card, amount - Number(current || 0));
            } else {
                card.power = amount;
                card.setPowerValue = amount;
            }

            renderBoard(ui);
            return `${sourceCard.name} set ${card.name}'s power to ${amount}${durationText(action.duration)}.`;
        }

        if (action.type === "giveKeyword") {
            const keyword = action.keyword || "Rush";
            if (action.duration === V2.DURATIONS.duringBattle) {
                global.addBattleKeyword?.(card, keyword);
            } else if (action.duration === V2.DURATIONS.permanent) {
                if (!Array.isArray(card.keywords)) card.keywords = [];
                if (!card.keywords.includes(keyword)) card.keywords.push(keyword);
            } else {
                global.addTemporaryKeyword?.(card, keyword);
            }
            renderBoard(ui);
            return `${sourceCard.name} gave ${card.name} ${keyword}.`;
        }

        if (action.type === "modifyCost") {
            global.addCostModifier?.(card, Number(action.amount || 0));
            renderBoard(ui);
            return `${sourceCard.name} changed ${card.name}'s cost by ${Number(action.amount || 0)} this turn.`;
        }

        if (action.type === "addStatus") {
            applyStatus(card, action, player);
            renderBoard(ui);
            return `${sourceCard.name} gave ${card.name} ${statusLabel(action.status)}.`;
        }

        if (action.type === "attachRestedDon") {
            const amount = Math.max(1, Number(action.amount || 1));
            if (action.distribute) {
                return attachRestedDonDistributed(player, sourceCard, amount, ui);
            }
            const result = global.attachRestedDonToCard?.(player, card, ui, Math.min(amount, Number(player.restedDon || 0)));
            return result?.message || `${sourceCard.name} attached rested DON!! to ${card.name}.`;
        }

        return "";
    }

    function koChoiceCharacter(player, sourceCard, choice, ui) {
        if (choice?.cardType !== "character") {
            return `${sourceCard.name} can only K.O. character cards.`;
        }

        const targetPlayer = global.gameState?.[choice.playerKey] || global.getPlayerForBoardCard?.(choice.card);
        const slotIndex = Number(choice.slotIndex);

        if (!targetPlayer || !Number.isInteger(slotIndex)) {
            return `${sourceCard.name} could not find the chosen character.`;
        }

        if (isStatusActive(choice.card?.cannotBeKOdUntil, targetPlayer)) {
            return `${choice.card.name} cannot be K.O.'d right now.`;
        }

        if (typeof global.removeCharacterByOpponentEffect === "function") {
            const message = global.removeCharacterByOpponentEffect(player, targetPlayer, slotIndex, sourceCard, ui);
            if (typeof message === "string") return message;
        }

        if (typeof global.KOCharacter === "function") {
            const result = global.KOCharacter(targetPlayer, slotIndex, ui, {
                byEffect: true,
                actingPlayer: player,
                sourceCard
            });
            if (result?.message) return result.message;
        }

        const card = targetPlayer.characters?.[slotIndex];
        if (!card) return "No character was found in that slot.";

        targetPlayer.characters[slotIndex] = null;
        if (typeof global.moveCardToTrash === "function") {
            global.moveCardToTrash(targetPlayer, card, ui);
        } else {
            targetPlayer.trash.push(card);
        }
        global.resolveGutsLeaderCharacterRemovedBonus?.(targetPlayer, ui);
        global.resolveOnKOEffects?.(targetPlayer, card, ui);
        renderBoard(ui);

        return `${sourceCard.name} K.O.'d ${card.name}.`;
    }

    function trashChoiceBoardCard(player, sourceCard, choice, ui) {
        const targetPlayer = global.gameState?.[choice?.playerKey] || global.getPlayerForBoardCard?.(choice?.card);
        if (!targetPlayer || !choice?.card) return `${sourceCard.name} could not find the chosen card.`;

        if (choice.cardType === "character") {
            const slotIndex = Number(choice.slotIndex);
            if (!Number.isInteger(slotIndex) || !targetPlayer.characters?.[slotIndex]) {
                return `${sourceCard.name} could not find the chosen character.`;
            }
            const card = targetPlayer.characters[slotIndex];
            targetPlayer.characters[slotIndex] = null;
            global.moveCardToTrash?.(targetPlayer, card, ui);
            global.resolveGutsLeaderCharacterRemovedBonus?.(targetPlayer, ui);
            global.resolveOnKOEffects?.(targetPlayer, card, ui);
            renderBoard(ui);
            return `${sourceCard.name} trashed ${card.name}.`;
        }

        if (choice.cardType === "stage" && targetPlayer.stage === choice.card) {
            const card = targetPlayer.stage;
            targetPlayer.stage = null;
            global.moveCardToTrash?.(targetPlayer, card, ui);
            renderBoard(ui);
            return `${sourceCard.name} trashed ${card.name}.`;
        }

        return `${sourceCard.name} can only trash board cards.`;
    }

    function choiceForBoardCard(card) {
        const owner = global.getPlayerForBoardCard?.(card);
        const playerKey = global.getPlayerKey?.(owner);
        const slotIndex = owner?.characters?.indexOf(card);

        if (!owner || !playerKey || slotIndex < 0) {
            return { card, cardType: card?.cardType || "" };
        }

        return {
            playerKey,
            cardType: "character",
            slotIndex,
            card
        };
    }

    function getConditionFailure(player, sourceCard, effect) {
        for (const condition of effect.conditions || []) {
            if (!conditionMet(player, sourceCard, condition)) {
                return `${sourceCard.name}'s condition is not met.`;
            }
        }

        return "";
    }

    function conditionMet(player, sourceCard, condition) {
        const opponent = global.getOpponentPlayer?.(player);
        const type = condition.type;
        const operator = condition.operator || ">=";
        const expected = Number(condition.value ?? condition.amount ?? 0);

        if (type === "selfLife") return compareNumber(player.life.length, operator, expected);
        if (type === "opponentLife") return compareNumber(opponent?.life?.length || 0, operator, expected);
        if (type === "selfTrash") return compareNumber(player.trash.length, operator, expected);
        if (type === "selfHand") return compareNumber(player.hand.length, operator, expected);
        if (type === "opponentHand") return compareNumber(opponent?.hand?.length || 0, operator, expected);
        if (type === "selfTotalDon") return compareNumber(totalDonInField(player), operator, expected);
        if (type === "opponentActiveDon") return compareNumber(opponent?.don || 0, operator, expected);
        if (type === "opponentRestedCharacters") {
            const rested = (opponent?.characters || []).filter(card => card && (card.state || "active") === "rested").length;
            return compareNumber(rested, operator, expected);
        }
        if (type === "opponentControlsCharacterPower") {
            return (opponent?.characters || [])
                .filter(Boolean)
                .some(card => compareNumber(getConditionCardPower(card), operator, expected));
        }
        if (type === "selfControlsCharacterPower") {
            return (player?.characters || [])
                .filter(Boolean)
                .some(card => compareNumber(getConditionCardPower(card), operator, expected));
        }
        if (type === "selfCharacters") return compareNumber(player.characters.filter(Boolean).length, operator, expected);
        if (type === "leaderTypeIncludes") return typeIncludes(player.leader, condition.value);
        if (type === "leaderNameEquals") return nameEquals(player.leader, condition.value);
        if (type === "leaderNameIncludes") return nameIncludes(player.leader, condition.value);
        if (type === "leaderColorIs") return colorIncludes(player.leader, condition.value);
        if (type === "selfHasStage") return Boolean(player.stage);
        if (type === "selfHasNoStage") return !player.stage;
        if (type === "any") return (condition.conditions || []).some(entry => conditionMet(player, sourceCard, entry));
        if (type === "controlCardName") return controlsCardName(player, condition.value);
        if (type === "leaderPower") return compareNumber(global.getCardBattlePower?.(player.leader, player) || Number(player.leader?.power || 0), operator, expected);
        if (type === "leaderPowerBelowBase") {
            const current = global.getCardBattlePower?.(player.leader, player) || Number(player.leader?.power || 0);
            const base = Number(player.leader?.printedPower || player.leader?.basePower || player.leader?.originalPower || player.leader?.power || 0);
            return Number(current) < Number(base);
        }
        if (type === "sourceAttachedDonAtLeast") return Number(sourceCard.attachedDon || 0) >= Number(condition.amount || condition.value || 0);
        if (type === "sourcePower") return compareNumber(global.getCardBattlePower?.(sourceCard, player) || Number(sourceCard.power || 0), operator, expected);
        if (type === "lifeComparison") {
            if (condition.operator === "<") return player.life.length < (opponent?.life?.length || 0);
            if (condition.operator === ">") return player.life.length > (opponent?.life?.length || 0);
        }
        if (type === "isYourTurn") return global.gameState?.currentPlayer === player;
        if (type === "isOpponentTurn") return global.gameState?.currentPlayer !== player;

        return true;
    }

    function getConditionCardPower(card) {
        const printed = Number(card?.printedPower ?? card?.basePower ?? card?.originalPower ?? card?.power ?? 0);
        const attachedDonPower = Number(card?.attachedDon || 0) * 1000;
        const temporary = Number(card?.temporaryPower || card?.turnPowerModifier || 0);
        const battle = Number(card?.battlePower || card?.battlePowerModifier || 0);
        return printed + attachedDonPower + temporary + battle;
    }

    function compareNumber(actual, operator, expected) {
        if (operator === "<=") return Number(actual) <= Number(expected);
        if (operator === ">=") return Number(actual) >= Number(expected);
        if (operator === "==") return Number(actual) === Number(expected);
        if (operator === "<") return Number(actual) < Number(expected);
        if (operator === ">") return Number(actual) > Number(expected);
        return true;
    }

    function totalDonInField(player) {
        return Number(player.don || 0) +
            Number(player.restedDon || 0) +
            [player.leader, ...player.characters.filter(Boolean)]
                .reduce((total, card) => total + Number(card?.attachedDon || 0), 0);
    }

    function typeIncludes(card, typeText) {
        if (!typeText) return true;
        if (typeof global.hasExactTypeText === "function") return global.hasExactTypeText(card, typeText);
        return String(card?.type || "").toLowerCase().includes(String(typeText).toLowerCase());
    }

    function colorIncludes(card, colorText) {
        const needle = String(colorText || "").trim().toLowerCase();
        if (!needle) return true;
        const colors = Array.isArray(card?.colors)
            ? card.colors
            : String(card?.color || "").split(/[\/,]/);
        return colors.some(color => String(color || "").trim().toLowerCase() === needle);
    }

    function nameIncludes(card, nameText) {
        if (!nameText) return true;
        return String(card?.name || "").toLowerCase().includes(String(nameText).toLowerCase());
    }

    function nameEquals(card, nameText) {
        if (!nameText) return true;
        return normalizeText(card?.name) === normalizeText(nameText);
    }

    function normalizeText(value) {
        return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    }

    function durationText(duration) {
        if (duration === V2.DURATIONS.duringBattle) return " during this battle";
        if (duration === V2.DURATIONS.untilEndOfTurn) return " during this turn";
        if (duration === V2.DURATIONS.untilOpponentNextTurn) return " until the opponent's next turn";
        return "";
    }

    function controlsCardName(player, nameText) {
        const needle = String(nameText || "").trim().toLowerCase();
        if (!needle) return true;

        return [
            player?.leader,
            ...(player?.characters || []).filter(Boolean),
            player?.stage
        ].filter(Boolean).some(card => String(card?.name || "").toLowerCase().includes(needle));
    }

    function canMoveSourceCard(player, sourceCard) {
        if (!player || !sourceCard) return false;
        return player.characters.includes(sourceCard) || player.stage === sourceCard;
    }

    function isCurrentAttackingSource(sourceCard) {
        return Boolean(sourceCard && global.isCurrentAttackingCard?.(sourceCard));
    }

    function concludeAttackIfSourceLeft(wasCurrentAttacker, sourceCard) {
        if (!wasCurrentAttacker || !sourceCard) return;
        global.concludeAttackBecauseAttackerLeft?.(sourceCard);
    }

    function moveSourceCardToZone(player, sourceCard, ui, zone) {
        if (!canMoveSourceCard(player, sourceCard)) return false;

        const characterIndex = player.characters.findIndex(card => card === sourceCard);
        if (characterIndex !== -1) {
            player.characters[characterIndex] = null;
            global.resolveGutsLeaderCharacterRemovedBonus?.(player, ui);
        }

        if (player.stage === sourceCard) {
            player.stage = null;
        }

        sourceCard.state = "active";

        if (zone === "hand") {
            sourceCard.attachedDon = 0;
            player.hand.push(sourceCard);
        } else {
            global.moveCardToTrash?.(player, sourceCard, ui);
        }

        renderBoard(ui);
        return true;
    }

    function moveChoiceToHand(player, sourceCard, choice, ui) {
        const owner = global.gameState?.[choice?.playerKey];
        if (!owner || !choice?.card) return "";

        if (choice.cardType === "character") {
            owner.characters[choice.slotIndex] = null;
            choice.card.state = "active";
            choice.card.attachedDon = 0;
            owner.hand.push(choice.card);
            global.resolveGutsLeaderCharacterRemovedBonus?.(owner, ui);
            renderBoard(ui);
            return `${sourceCard.name} returned ${choice.card.name} to ${owner.name}'s hand.`;
        }

        if (choice.cardType === "stage" && owner.stage === choice.card) {
            owner.stage = null;
            choice.card.state = "active";
            owner.hand.push(choice.card);
            renderBoard(ui);
            return `${sourceCard.name} returned ${choice.card.name} to ${owner.name}'s hand.`;
        }

        return `${sourceCard.name} could not return ${choice.card.name} to hand.`;
    }

    function applyStatus(card, action, player) {
        const expiration = getStatusExpiration(player, action.duration);
        const status = {
            expiresAtPlayerKey: expiration.expiresAtPlayerKey,
            expiresAtEndOfTurns: expiration.expiresAtEndOfTurns,
            duration: action.duration || V2.DURATIONS.untilEndOfTurn
        };

        if (action.status === "cannotAttack" || action.status === "cannotAttackLeader") {
            card.cannotAttackUntil = status;
        } else if (action.status === "cannotBlock") {
            card.cannotBlockUntil = status;
        } else if (action.status === "cannotBecomeActive") {
            card.cannotBecomeActiveUntil = status;
        } else if (action.status === "cannotBeRested") {
            card.cannotBeRestedUntil = status;
        } else if (action.status === "cannotBeKOd") {
            card.cannotBeKOdUntil = status;
        }
    }

    function getStatusExpiration(player, duration) {
        if (duration === V2.DURATIONS.permanent) {
            return {
                expiresAtPlayerKey: global.getPlayerKey?.(player),
                expiresAtEndOfTurns: Number.MAX_SAFE_INTEGER
            };
        }

        if (duration === V2.DURATIONS.untilOpponentNextTurn) {
            const opponent = global.getOpponentPlayer?.(player);
            return {
                expiresAtPlayerKey: global.getPlayerKey?.(opponent),
                expiresAtEndOfTurns: Number(opponent?.turns || 0) + 1
            };
        }

        return {
            expiresAtPlayerKey: global.getPlayerKey?.(player),
            expiresAtEndOfTurns: Number(player?.turns || 0)
        };
    }

    function isStatusActive(status, player) {
        if (!status || !player) return false;
        const playerKey = global.getPlayerKey?.(player);
        if (!playerKey || status.expiresAtPlayerKey !== playerKey) return false;
        return Number(player.turns || 0) <= Number(status.expiresAtEndOfTurns ?? 0);
    }

    function statusLabel(status) {
        if (status === "cannotAttackLeader") return "cannot attack leaders";
        if (status === "cannotAttack") return "cannot attack";
        if (status === "cannotBlock") return "cannot block";
        if (status === "cannotBecomeActive") return "cannot become active";
        if (status === "cannotBeRested") return "cannot be rested";
        if (status === "cannotBeKOd") return "cannot be K.O.'d";
        return status || "a status";
    }

    function attachRestedDonDistributed(player, sourceCard, maxAmount, ui) {
        if (typeof global.attachRestedDonToLeaderOrCharacter === "function") {
            return global.attachRestedDonToLeaderOrCharacter(player, sourceCard, {
                amount: maxAmount,
                distribute: true
            }, ui);
        }

        return `${sourceCard.name} could not distribute rested DON!!.`;
    }

    function resolveDirectTargets(player, sourceCard, target) {
        const opponent = global.getOpponentPlayer?.(player);
        const normalized = typeof target === "string" ? target : target?.type;

        if (normalized === "thisLeader" || normalized === "yourLeader") return player.leader ? [player.leader] : [];
        if (normalized === "thisCard") return sourceCard ? [sourceCard] : [];
        if (normalized === "opponentLeader") return opponent?.leader ? [opponent.leader] : [];
        if (normalized === "yourCharacters") return player.characters.filter(Boolean);
        if (normalized === "opponentCharacters") return opponent?.characters.filter(Boolean) || [];
        if (normalized === "yourLeaderOrCharacters") return [player.leader, ...player.characters.filter(Boolean)].filter(Boolean);
        if (normalized === "opponentLeaderOrCharacters") return [opponent?.leader, ...(opponent?.characters || []).filter(Boolean)].filter(Boolean);

        return [];
    }

    function tryWouldBeKOdReplacement({ owner, targetCard, actingPlayer, sourceCard, ui, onDecline }) {
        if (!owner || !targetCard) return "";

        const replacementEntries = getOwnerEffectSources(owner)
            .flatMap(source => (source.card.effects || [])
                .filter(effect => isV2Effect(effect) && effect.event?.type === V2.EVENTS.wouldBeKOd)
                .map(effect => ({ sourceCard: source.card, effect })))
            .filter(entry => canReplacementApply(owner, targetCard, actingPlayer, entry.sourceCard, entry.effect));

        const entry = replacementEntries[0];
        if (!entry) return "";

        const useReplacement = () => {
            const normalized = V2.normalizeEffect(entry.effect);

            if (normalized.limit?.type === "oncePerTurn") {
                global.CardEffects?.markOncePerTurnEffectUsed?.(entry.sourceCard, normalized.id, owner.turns);
            }

            executeActionsSequential(owner, entry.sourceCard, normalized, ui, global.gameState, result => {
                if (result?.message) {
                    global.addGameLog?.(result.message);
                }

                renderBoard(ui);
                global.addGameLog?.(`${entry.sourceCard.name} prevented ${targetCard.name} from being K.O.'d.`);
                return result;
            });
        };

        if (ui?.chooseEffectActivation) {
            ui.chooseEffectActivation({
                player: owner,
                sourceCard: entry.sourceCard,
                effect: entry.effect,
                title: entry.sourceCard.name,
                prompt: `${targetCard.name} would be K.O.'d by ${sourceCard?.name || "a card effect"}. Use ${entry.sourceCard.name}'s replacement effect?`,
                activateText: "Prevent K.O.",
                skipText: "Let K.O.",
                onComplete: shouldActivate => {
                    if (shouldActivate) {
                        useReplacement();
                        return;
                    }

                    onDecline?.();
                }
            });

            return `${owner.name} is choosing whether to use ${entry.sourceCard.name}'s replacement effect.`;
        }

        useReplacement();
        return `${entry.sourceCard.name} prevented ${targetCard.name} from being K.O.'d.`;
    }

    function canReplacementApply(owner, targetCard, actingPlayer, sourceCard, effect) {
        const normalized = V2.normalizeEffect(effect);

        if (normalized.automationStatus !== V2.STATUSES.automated) return false;
        if (normalized.event.sourceType === "cardEffect" && !actingPlayer) return false;
        if (normalized.limit?.type === "oncePerTurn" && global.CardEffects?.hasUsedOncePerTurnEffect?.(sourceCard, normalized.id, owner.turns)) {
            return false;
        }

        const eventTarget = normalized.event.target || { controller: "self", zone: "characters" };
        if (eventTarget.zone === "thisCard" && sourceCard !== targetCard) return false;
        if (eventTarget.controller === "self" && eventTarget.zone !== "thisCard") {
            const isOwnCharacter = owner.characters.includes(targetCard);
            const isOwnLeader = owner.leader === targetCard;
            if (eventTarget.zone === "leaderOrCharacters" && !isOwnCharacter && !isOwnLeader) return false;
            if (eventTarget.zone === "characters" && !isOwnCharacter) return false;
        }
        if (eventTarget.zone === "characters" && targetCard.cardType !== "character") return false;

        return normalized.actions.some(action => action.type === "preventEvent");
    }

    function getOwnerEffectSources(owner) {
        return [
            { card: owner.leader, zone: "leader" },
            ...owner.characters.filter(Boolean).map(card => ({ card, zone: "character" })),
            { card: owner.stage, zone: "stage" }
        ].filter(entry => entry.card);
    }

    function trashSourceCharacter(player, sourceCard, ui) {
        const slotIndex = player.characters.findIndex(card => card === sourceCard);
        if (slotIndex === -1) return false;

        player.characters[slotIndex] = null;
        global.moveCardToTrash?.(player, sourceCard, ui);
        renderBoard(ui);
        return true;
    }

    function renderBoard(ui) {
        ui?.renderHands?.();
        ui?.renderLeaders?.();
        ui?.renderCharacters?.();
        ui?.renderTrash?.();
        ui?.renderDonDecks?.();
        ui?.updateDonDisplay?.();
    }

    global.CustomEffectV2Engine = {
        isV2Effect,
        getEventType,
        canUseEffect,
        conditionMet,
        runEffect,
        tryWouldBeKOdReplacement,
        runOpponentPlaysStageEffects
    };
})(typeof window !== "undefined" ? window : globalThis);
