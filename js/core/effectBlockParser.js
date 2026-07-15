// effectBlockParser.js
// Rule-based One Piece-style text to block-effect parser.

(function effectBlockParserFactory(global) {
    const Blocks = global.EffectBlocks;

    if (!Blocks) {
        throw new Error("effectBlockParser.js must be loaded after effectBlocks.js");
    }

    const TIMING_PATTERNS = [
        { type: Blocks.TIMINGS.onPlay, regex: /^\s*\[\s*on\s+play\s*\]\s*:?\s*/i },
        { type: Blocks.TIMINGS.onPlay, regex: /^\s*on\s+play\s*:?\s*/i },
        { type: Blocks.TIMINGS.whenAttacking, regex: /^\s*\[\s*when\s+attacking\s*\]\s*:?\s*/i },
        { type: Blocks.TIMINGS.whenAttacking, regex: /^\s*when\s+attacking\s*:?\s*/i },
        { type: Blocks.TIMINGS.activateMain, regex: /^\s*\[\s*activate\s*:?\s*main\s*\]\s*:?\s*/i },
        { type: Blocks.TIMINGS.activateMain, regex: /^\s*\[\s*main\s*\]\s*:?\s*/i },
        { type: Blocks.TIMINGS.activateMain, regex: /^\s*activate\s*:?\s*main\s*:?\s*/i },
        { type: Blocks.TIMINGS.activateMain, regex: /^\s*main\s*:?\s*/i },
        { type: Blocks.TIMINGS.onKO, regex: /^\s*\[\s*on\s+k\.?\s*o\.?\s*\]\s*:?\s*/i },
        { type: Blocks.TIMINGS.onKO, regex: /^\s*on\s+k\.?\s*o\.?\s*:?\s*/i },
        { type: Blocks.TIMINGS.trigger, regex: /^\s*\[\s*trigger\s*\]\s*:?\s*/i },
        { type: Blocks.TIMINGS.trigger, regex: /^\s*trigger\s*:?\s*/i },
        { type: Blocks.TIMINGS.counter, regex: /^\s*\[\s*counter\s*\]\s*:?\s*/i },
        { type: Blocks.TIMINGS.counter, regex: /^\s*counter\s*:?\s*/i },
        { type: Blocks.TIMINGS.endOfYourTurn, regex: /^\s*\[\s*end\s+of\s+your\s+turn\s*\]\s*:?\s*/i },
        { type: Blocks.TIMINGS.endOfYourTurn, regex: /^\s*end\s+of\s+your\s+turn\s*:?\s*/i },
        { type: Blocks.TIMINGS.startOfYourTurn, regex: /^\s*\[\s*start\s+of\s+your\s+turn\s*\]\s*:?\s*/i },
        { type: Blocks.TIMINGS.startOfYourTurn, regex: /^\s*start\s+of\s+your\s+turn\s*:?\s*/i }
    ];

    const TIMING_SPLIT_REGEX = /(?=\[\s*(?:on\s+play|when\s+attacking|activate\s*:?\s*main|main|on\s+k\.?\s*o\.?|trigger|counter|end\s+of\s+your\s+turn|start\s+of\s+your\s+turn)\s*\])/ig;

    function parseEffectText(text, options = {}) {
        const sourceText = String(text || "").trim();
        const chunks = splitEffectText(sourceText);
        const warnings = [];
        const effects = chunks
            .map((chunk, index) => parseSingleEffectText(chunk, {
                ...options,
                index,
                warnings
            }))
            .filter(Boolean);

        if (!effects.length && sourceText) {
            warnings.push("No effect blocks were parsed. Start effects with [On Play], [When Attacking], [Activate: Main], [Counter], or [Trigger].");
        }

        return {
            effects,
            warnings
        };
    }

    function splitEffectText(text) {
        if (!text.trim()) {
            return [];
        }

        const splitByTiming = text
            .split(TIMING_SPLIT_REGEX)
            .map(part => part.trim())
            .filter(Boolean);

        if (splitByTiming.length > 1) {
            return splitByTiming;
        }

        const lineChunks = [];
        let current = "";

        text.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            if (hasTimingPrefix(trimmed) && current) {
                lineChunks.push(current.trim());
                current = trimmed;
            } else {
                current = current ? `${current} ${trimmed}` : trimmed;
            }
        });

        if (current) {
            lineChunks.push(current.trim());
        }

        return lineChunks.length ? lineChunks : [text.trim()];
    }

    function hasTimingPrefix(text) {
        return TIMING_PATTERNS.some(pattern => pattern.regex.test(text));
    }

    function parseSingleEffectText(text, options = {}) {
        const warnings = [];
        let remaining = String(text || "").trim();
        let timing = null;

        for (const pattern of TIMING_PATTERNS) {
            const match = remaining.match(pattern.regex);
            if (match) {
                timing = { type: pattern.type };
                remaining = remaining.replace(pattern.regex, "").trim();
                break;
            }
        }

        if (!timing) {
            timing = { type: Blocks.TIMINGS.activateMain };
            warnings.push(`Could not detect timing for "${text}". Defaulted to Activate: Main.`);
        }

        const idPrefix = options.cardNumber || options.idPrefix || "generated";
        const effect = Blocks.createEffect({
            id: `${idPrefix}-block-${Number(options.index || 0) + 1}`,
            timing,
            text,
            limits: parseLimits(text)
        });

        effect.conditions.push(...parseConditions(text));

        const { costText, actionText } = splitCostsAndActions(remaining);
        effect.costs.push(...parseCosts(costText));
        parseActionsIntoEffect(effect, actionText || remaining, warnings);

        effect.warnings = warnings;
        return effect;
    }

    function parseLimits(text) {
        return /\bonce\s+per\s+turn\b/i.test(text)
            ? [{ type: "oncePerTurn" }]
            : [];
    }

    function splitCostsAndActions(text) {
        const colonIndex = text.indexOf(":");

        if (colonIndex === -1) {
            return {
                costText: "",
                actionText: text
            };
        }

        const beforeColon = text.slice(0, colonIndex).trim();
        const afterColon = text.slice(colonIndex + 1).trim();

        if (!looksLikeCostText(beforeColon)) {
            return {
                costText: "",
                actionText: text
            };
        }

        return {
            costText: beforeColon,
            actionText: afterColon
        };
    }

    function looksLikeCostText(text) {
        return /don!!?\s*-\s*\d+/i.test(text) ||
            /rest\s+this\s+card/i.test(text) ||
            /trash\s+this\s+(?:card|character)/i.test(text) ||
            /trash\s+\d+\s+cards?\s+from\s+(?:your\s+)?hand/i.test(text) ||
            /discard\s+\d+\s+cards?/i.test(text) ||
            /return\s+\d+\s+don/i.test(text) ||
            /rest\s+\d+\s+(?:of\s+your\s+)?don/i.test(text) ||
            /trash\s+\d+\s+(?:of\s+your\s+)?life/i.test(text);
    }

    function parseCosts(text) {
        const costs = [];
        const costText = String(text || "");

        for (const match of costText.matchAll(/don!!?\s*-\s*(\d+)/ig)) {
            costs.push({ type: Blocks.COST_TYPES.donMinus, amount: Number(match[1]) });
        }

        if (/rest\s+this\s+card/i.test(costText)) {
            costs.push({ type: Blocks.COST_TYPES.restThisCard });
        }

        if (/trash\s+this\s+(?:card|character)/i.test(costText)) {
            costs.push({ type: Blocks.COST_TYPES.trashThisCard });
        }

        for (const match of costText.matchAll(/trash\s+(\d+)\s+cards?\s+from\s+(?:your\s+)?hand/ig)) {
            costs.push({ type: Blocks.COST_TYPES.trashCardsFromHand, amount: Number(match[1]) });
        }

        for (const match of costText.matchAll(/discard\s+(\d+)\s+cards?/ig)) {
            costs.push({ type: Blocks.COST_TYPES.discardCards, amount: Number(match[1]) });
        }

        for (const match of costText.matchAll(/return\s+(\d+)\s+don/ig)) {
            costs.push({ type: Blocks.COST_TYPES.returnDon, amount: Number(match[1]) });
        }

        for (const match of costText.matchAll(/rest\s+(\d+)\s+(?:of\s+your\s+)?don/ig)) {
            costs.push({ type: Blocks.COST_TYPES.restDon, amount: Number(match[1]) });
        }

        for (const match of costText.matchAll(/trash\s+(\d+)\s+(?:of\s+your\s+)?life/ig)) {
            costs.push({ type: Blocks.COST_TYPES.trashLife, amount: Number(match[1]) });
        }

        return costs;
    }

    function parseConditions(text) {
        const conditions = [];
        const source = String(text || "");

        pushLifeConditions(conditions, source, "self", /\byour\s+life\s+is\s+(\d+)\s+or\s+(less|more)/ig);
        pushLifeConditions(conditions, source, "opponent", /\bopponent'?s?\s+life\s+is\s+(\d+)\s+or\s+(less|more)/ig);

        for (const match of source.matchAll(/you\s+have\s+(\d+)\s+or\s+more\s+don!!?/ig)) {
            conditions.push({
                type: Blocks.CONDITION_TYPES.donComparison,
                controller: "self",
                operator: ">=",
                value: Number(match[1])
            });
        }

        for (const match of source.matchAll(/you\s+have\s+(\d+)\s+or\s+more\s+cards?\s+in\s+(?:your\s+)?trash/ig)) {
            conditions.push({
                type: Blocks.CONDITION_TYPES.trashCountComparison,
                controller: "self",
                operator: ">=",
                value: Number(match[1])
            });
        }

        for (const match of source.matchAll(/(?:this\s+card|source\s+card).+?(\d+)\s+or\s+more\s+attached\s+don/ig)) {
            conditions.push({
                type: Blocks.CONDITION_TYPES.sourceAttachedDonComparison,
                operator: ">=",
                value: Number(match[1])
            });
        }

        for (const match of source.matchAll(/don!!?\s*x\s*(\d+)/ig)) {
            conditions.push({
                type: Blocks.CONDITION_TYPES.sourceAttachedDonComparison,
                operator: ">=",
                value: Number(match[1])
            });
        }

        const leaderName = firstMatch(source, /your\s+leader\s+(?:has\s+name|is)\s+\[([^\]]+)\]/i);
        if (leaderName) {
            conditions.push({
                type: Blocks.CONDITION_TYPES.leaderMatches,
                field: "name",
                operator: "includes",
                value: leaderName
            });
        }

        const leaderType = firstMatch(source, /your\s+leader\s+has\s+(?:the\s+)?\{([^}]+)\}\s+type/i);
        if (leaderType) {
            conditions.push({
                type: Blocks.CONDITION_TYPES.leaderMatches,
                field: "type",
                operator: "includes",
                value: leaderType
            });
        }

        const controlledName = firstMatch(source, /you\s+control\s+(?:a|1)\s+(?:character\s+)?(?:named\s+)?\[([^\]]+)\]/i);
        if (controlledName) {
            conditions.push({
                type: Blocks.CONDITION_TYPES.controlsCharacter,
                field: "name",
                operator: "includes",
                value: controlledName
            });
        }

        const controlledType = firstMatch(source, /you\s+control\s+(?:a|1)\s+\{([^}]+)\}\s+type\s+character/i);
        if (controlledType) {
            conditions.push({
                type: Blocks.CONDITION_TYPES.controlsCharacter,
                field: "type",
                operator: "includes",
                value: controlledType
            });
        }

        return dedupeConditions(conditions);
    }

    function pushLifeConditions(conditions, text, controller, regex) {
        for (const match of text.matchAll(regex)) {
            conditions.push({
                type: Blocks.CONDITION_TYPES.lifeComparison,
                controller,
                operator: match[2].toLowerCase() === "less" ? "<=" : ">=",
                value: Number(match[1])
            });
        }
    }

    function parseActionsIntoEffect(effect, text, warnings) {
        const actionText = String(text || "").trim();

        if (!actionText) {
            warnings.push("Effect has no action text.");
            return;
        }

        parseSearchActions(effect, actionText);
        parseDrawActions(effect, actionText);
        parseKoActions(effect, actionText);
        parseRestActions(effect, actionText);
        parseSetActiveActions(effect, actionText);
        parsePowerActions(effect, actionText);
        parseKeywordActions(effect, actionText);
        parseDonActions(effect, actionText);
        parsePlayActions(effect, actionText);
        parseDeckTrashActions(effect, actionText);
        parseLifeActions(effect, actionText);
        parseMoveActions(effect, actionText);
        parseSelfTrashAction(effect, actionText);

        if (!effect.actions.length) {
            warnings.push(`No supported action was parsed from: ${actionText}`);
        }
    }

    function parseSearchActions(effect, text) {
        const topAmount = numberFrom(text, /look\s+at\s+the\s+top\s+(\d+)\s+cards?/i);

        if (!topAmount) {
            return;
        }

        const revealAmount = numberFrom(text, /reveal\s+up\s+to\s+(\d+)/i) ||
            numberFrom(text, /add\s+up\s+to\s+(\d+)/i) ||
            numberFrom(text, /play\s+up\s+to\s+(\d+)/i) ||
            1;
        const targetId = addTarget(effect, {
            controller: "self",
            zone: Blocks.TARGET_ZONES.deckTop,
            count: { min: 0, max: revealAmount },
            filters: parseFilters(text),
            optional: true
        });

        effect.actions.push({ type: Blocks.ACTION_TYPES.searchTopDeck, amount: topAmount });

        if (/reveal/i.test(text)) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.reveal, target: targetId });
        }

        if (/add.+hand/i.test(text)) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.addToHand, target: targetId });
        }

        if (/play\s+up\s+to/i.test(text)) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.playSelected, target: targetId });
        }

        if (/rest.+trash/i.test(text) || /place.+rest.+trash/i.test(text)) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.putRestTrash });
        } else if (/bottom\s+of\s+(?:your\s+)?deck|bottom_deck/i.test(text)) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.putRestBottomDeck });
        }
    }

    function parseDrawActions(effect, text) {
        for (const match of text.matchAll(/\bdraw\s+(\d+)\s+cards?\b/ig)) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.draw, amount: Number(match[1]) });
        }
    }

    function parseKoActions(effect, text) {
        const match = text.match(/\b(?:k\.?\s*o\.?|ko)\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)(?:\.|,|\bthen\b|$)/i);
        if (!match) return;

        const amount = Number(match[1] || 1);
        const targetPhrase = match[2] || "opponent's Characters";
        const targetId = addTarget(effect, targetFromPhrase(targetPhrase, {
            defaultController: "opponent",
            defaultZone: Blocks.TARGET_ZONES.characters,
            max: amount,
            optional: /up\s+to/i.test(match[0]),
            filters: parseFilters(match[0])
        }));

        effect.actions.push({ type: Blocks.ACTION_TYPES.ko, target: targetId });
    }

    function parseRestActions(effect, text) {
        if (/rest\s+\d+\s+(?:of\s+your\s+)?don/i.test(text)) {
            return;
        }

        const match = text.match(/\brest\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)(?:\.|,|\bthen\b|$)/i);
        if (!match || /this\s+card/i.test(match[0])) return;

        const amount = Number(match[1] || 1);
        const targetId = addTarget(effect, targetFromPhrase(match[2], {
            defaultController: /opponent/i.test(match[2]) ? "opponent" : "self",
            defaultZone: Blocks.TARGET_ZONES.board,
            max: amount,
            optional: /up\s+to/i.test(match[0]),
            filters: parseFilters(match[0])
        }));

        effect.actions.push({ type: Blocks.ACTION_TYPES.rest, target: targetId });
    }

    function parseSetActiveActions(effect, text) {
        if (/don!!?.+active|active\s+don/i.test(text)) {
            return;
        }

        const match = text.match(/\bset\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)\s+(?:as\s+)?active/i);
        if (!match) return;

        const amount = Number(match[1] || 1);
        const targetId = addTarget(effect, targetFromPhrase(match[2], {
            defaultController: "self",
            defaultZone: Blocks.TARGET_ZONES.board,
            max: amount,
            optional: /up\s+to/i.test(match[0]),
            filters: parseFilters(match[0])
        }));

        effect.actions.push({ type: Blocks.ACTION_TYPES.setActive, target: targetId });
    }

    function parsePowerActions(effect, text) {
        for (const match of text.matchAll(/(.{0,90}?)\bgains?\s+([+-]\d+)\s+power\s+during\s+this\s+(turn|battle)/ig)) {
            const phrase = cleanTargetPrefix(match[1]) || "this card";
            const targetId = addTarget(effect, targetFromPhrase(phrase, {
                defaultController: "self",
                defaultZone: Blocks.TARGET_ZONES.leaderOrCharacters,
                max: numberFrom(match[0], /up\s+to\s+(\d+)/i) || 1,
                optional: /up\s+to/i.test(match[0]),
                filters: parseFilters(match[0])
            }));

            effect.actions.push({
                type: Blocks.ACTION_TYPES.modifyPower,
                target: targetId,
                amount: Number(match[2]),
                duration: match[3].toLowerCase() === "battle" ? "battle" : "turn"
            });
        }
    }

    function parseKeywordActions(effect, text) {
        const keyword = firstMatch(text, /\b(?:gains?|gain|give)\s+(rush|blocker|banish|double attack|unblockable)\b/i);
        if (!keyword) return;

        const targetId = addTarget(effect, targetFromPhrase(text, {
            defaultController: "self",
            defaultZone: /this\s+(?:card|character)/i.test(text)
                ? Blocks.TARGET_ZONES.source
                : Blocks.TARGET_ZONES.leaderOrCharacters,
            max: numberFrom(text, /up\s+to\s+(\d+)/i) || 1,
            optional: /up\s+to|may/i.test(text),
            filters: parseFilters(text)
        }));

        effect.actions.push({
            type: Blocks.ACTION_TYPES.giveKeyword,
            target: targetId,
            keyword,
            duration: /during\s+this\s+battle/i.test(text) ? "battle" : "turn"
        });
    }

    function parseDonActions(effect, text) {
        const setActive = numberFrom(text, /set\s+up\s+to\s+(\d+)\s+don!!?.+active/i);
        if (setActive) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.setDonActive, amount: setActive });
        }

        const addRested = numberFrom(text, /add\s+up\s+to\s+(\d+)\s+rested\s+don/i);
        if (addRested) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.addRestedDon, amount: addRested });
        }

        const attachRested = numberFrom(text, /attach\s+up\s+to\s+(\d+)\s+rested\s+don/i);
        if (attachRested) {
            const targetId = addTarget(effect, targetFromPhrase(text, {
                defaultController: "self",
                defaultZone: Blocks.TARGET_ZONES.leaderOrCharacters,
                max: 1,
                optional: true
            }));
            effect.actions.push({ type: Blocks.ACTION_TYPES.attachRestedDon, target: targetId, amount: attachRested });
        }

        const returnDon = numberFrom(text, /return\s+(\d+)\s+don!!?\s+cards?\s+to\s+(?:your\s+)?don!!?\s+deck/i);
        if (returnDon) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.returnDon, amount: returnDon });
        }
    }

    function parsePlayActions(effect, text) {
        const fromHand = text.match(/play\s+up\s+to\s+(\d+).+from\s+(?:your\s+)?hand/i);
        if (fromHand) {
            const targetId = addTarget(effect, {
                controller: "self",
                zone: Blocks.TARGET_ZONES.hand,
                count: { min: 0, max: Number(fromHand[1]) },
                filters: parseFilters(text),
                optional: true
            });
            effect.actions.push({ type: Blocks.ACTION_TYPES.playFromHand, target: targetId });
        }

        const fromTrash = text.match(/play\s+up\s+to\s+(\d+).+from\s+(?:your\s+)?trash/i);
        if (fromTrash) {
            const targetId = addTarget(effect, {
                controller: "self",
                zone: Blocks.TARGET_ZONES.trash,
                count: { min: 0, max: Number(fromTrash[1]) },
                filters: parseFilters(text),
                optional: true
            });
            effect.actions.push({ type: Blocks.ACTION_TYPES.playFromTrash, target: targetId });
        }
    }

    function parseDeckTrashActions(effect, text) {
        const trashTop = numberFrom(text, /trash\s+the\s+top\s+(\d+)\s+cards?\s+of\s+(?:your\s+)?deck/i);
        if (trashTop) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.trashTopDeck, amount: trashTop });
        }

        const trashBottom = numberFrom(text, /return\s+(\d+)\s+cards?\s+from\s+(?:your\s+)?trash\s+to\s+the\s+bottom\s+of\s+(?:your\s+)?deck/i);
        if (trashBottom) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.addTrashToBottomDeck, amount: trashBottom });
        }
    }

    function parseLifeActions(effect, text) {
        const trashLife = numberFrom(text, /trash\s+(\d+)\s+of\s+your\s+opponent'?s?\s+life/i) ||
            numberFrom(text, /trash\s+opponent'?s?\s+life\s+(\d+)/i);
        if (trashLife) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.trashOpponentLife, amount: trashLife });
        }

        const healLife = numberFrom(text, /add\s+(\d+)\s+cards?.+life/i) ||
            numberFrom(text, /heal\s+(\d+)/i);
        if (healLife) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.healLife, amount: healLife });
        }
    }

    function parseMoveActions(effect, text) {
        const bounce = text.match(/return\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)\s+to\s+(?:the\s+owner'?s\s+|your\s+)?hand/i);
        if (bounce && !/from\s+(?:your\s+)?trash\s+to\s+the\s+bottom/i.test(text)) {
            const targetId = addTarget(effect, targetFromPhrase(bounce[2], {
                defaultController: /opponent/i.test(bounce[2]) ? "opponent" : "any",
                defaultZone: Blocks.TARGET_ZONES.characters,
                max: Number(bounce[1] || 1),
                optional: /up\s+to/i.test(bounce[0]),
                filters: parseFilters(bounce[0])
            }));
            effect.actions.push({ type: Blocks.ACTION_TYPES.bounceToHand, target: targetId });
        }

        const bottom = text.match(/place\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)\s+(?:at|on)\s+the\s+bottom\s+of\s+(?:the\s+owner'?s\s+)?deck/i);
        if (bottom) {
            const targetId = addTarget(effect, targetFromPhrase(bottom[2], {
                defaultController: /opponent/i.test(bottom[2]) ? "opponent" : "any",
                defaultZone: Blocks.TARGET_ZONES.board,
                max: Number(bottom[1] || 1),
                optional: /up\s+to/i.test(bottom[0]),
                filters: parseFilters(bottom[0])
            }));
            effect.actions.push({ type: Blocks.ACTION_TYPES.placeBottomDeck, target: targetId });
        }
    }

    function parseSelfTrashAction(effect, text) {
        if (/trash\s+this\s+(?:card|character)/i.test(text) && !effect.costs.some(cost => cost.type === Blocks.COST_TYPES.trashThisCard)) {
            effect.actions.push({ type: Blocks.ACTION_TYPES.trashThisCard });
        }
    }

    function targetFromPhrase(phrase, options = {}) {
        const text = String(phrase || "").toLowerCase();
        const controller = text.includes("opponent")
            ? "opponent"
            : text.includes("your") || text.includes("this")
                ? "self"
                : options.defaultController || "self";
        const zone = detectZone(text, options.defaultZone);
        const max = Number(options.max || numberFrom(text, /up\s+to\s+(\d+)/i) || 1);
        const optional = Boolean(options.optional || /up\s+to|may/i.test(text));

        return {
            controller,
            zone,
            count: {
                min: optional ? 0 : 1,
                max
            },
            filters: dedupeFilters([
                ...(options.filters || []),
                ...parseFilters(phrase)
            ]),
            optional
        };
    }

    function detectZone(text, fallback = Blocks.TARGET_ZONES.characters) {
        if (/this\s+(?:card|character)/i.test(text)) return Blocks.TARGET_ZONES.source;
        if (/active\s+don/i.test(text)) return Blocks.TARGET_ZONES.activeDon;
        if (/rested\s+don/i.test(text)) return Blocks.TARGET_ZONES.restedDon;
        if (/\bdon!!?\b/i.test(text)) return Blocks.TARGET_ZONES.don;
        if (/leader\s+or\s+characters?|characters?\s+or\s+leader/i.test(text)) return Blocks.TARGET_ZONES.leaderOrCharacters;
        if (/leader/i.test(text)) return Blocks.TARGET_ZONES.leader;
        if (/characters?/i.test(text)) return Blocks.TARGET_ZONES.characters;
        if (/stage/i.test(text)) return Blocks.TARGET_ZONES.stage;
        if (/hand/i.test(text)) return Blocks.TARGET_ZONES.hand;
        if (/trash/i.test(text)) return Blocks.TARGET_ZONES.trash;
        if (/top\s+\d+|deck\s*top/i.test(text)) return Blocks.TARGET_ZONES.deckTop;
        if (/deck/i.test(text)) return Blocks.TARGET_ZONES.deck;
        if (/life/i.test(text)) return Blocks.TARGET_ZONES.life;
        if (/cards?/i.test(text)) return Blocks.TARGET_ZONES.board;
        return fallback;
    }

    function parseFilters(text) {
        const filters = [];
        const source = String(text || "");

        pushNumericFilter(filters, source, Blocks.FILTER_FIELDS.power, /(\d+)\s+power\s+or\s+less/ig, "<=");
        pushNumericFilter(filters, source, Blocks.FILTER_FIELDS.power, /(\d+)\s+power\s+or\s+more/ig, ">=");
        pushNumericFilter(filters, source, Blocks.FILTER_FIELDS.cost, /cost\s+(?:of\s+)?(\d+)\s+or\s+less/ig, "<=");
        pushNumericFilter(filters, source, Blocks.FILTER_FIELDS.cost, /cost\s+(?:of\s+)?(\d+)\s+or\s+more/ig, ">=");
        pushNumericFilter(filters, source, Blocks.FILTER_FIELDS.counter, /counter\s+(?:of\s+)?(\d+)\s+or\s+less/ig, "<=");
        pushNumericFilter(filters, source, Blocks.FILTER_FIELDS.counter, /counter\s+(?:of\s+)?(\d+)\s+or\s+more/ig, ">=");

        for (const match of source.matchAll(/\{([^}]+)\}\s+type/ig)) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.type, operator: "includes", value: match[1].trim() });
        }

        for (const match of source.matchAll(/\[([^\]]+)\]\s+type/ig)) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.type, operator: "includes", value: match[1].trim() });
        }

        for (const match of source.matchAll(/\[([^\]]+)\](?!\s*type)/ig)) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.name, operator: "includes", value: match[1].trim() });
        }

        const color = firstMatch(source, /\b(red|green|blue|purple|black|yellow)\b/i);
        if (color) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.color, operator: "==", value: color.toLowerCase() });
        }

        if (/\brested\b/i.test(source)) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.state, operator: "==", value: "rested" });
        }

        if (/\bactive\b/i.test(source)) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.state, operator: "==", value: "active" });
        }

        if (/\bcharacter(?:s)?\s+only\b/i.test(source)) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.cardType, operator: "==", value: "character" });
        }

        if (/\bleader\s+only\b/i.test(source)) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.cardType, operator: "==", value: "leader" });
        }

        if (/\bstage\s+only\b/i.test(source)) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.cardType, operator: "==", value: "stage" });
        }

        if (/\bevent\s+only\b/i.test(source)) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.cardType, operator: "==", value: "event" });
        }

        const keyword = firstMatch(source, /\b(rush|blocker|banish|double attack|unblockable)\b/i);
        if (keyword) {
            pushUniqueFilter(filters, { field: Blocks.FILTER_FIELDS.keyword, operator: "includes", value: keyword.toLowerCase() });
        }

        return filters;
    }

    function pushNumericFilter(filters, text, field, regex, operator) {
        for (const match of text.matchAll(regex)) {
            pushUniqueFilter(filters, { field, operator, value: Number(match[1]) });
        }
    }

    function pushUniqueFilter(filters, filter) {
        const key = JSON.stringify(filter);
        if (!filters.some(existing => JSON.stringify(existing) === key)) {
            filters.push(filter);
        }
    }

    function addTarget(effect, target) {
        const id = target.id || `target${effect.targets.length + 1}`;
        effect.targets.push(Blocks.createTarget({
            ...target,
            id
        }));
        return id;
    }

    function numberFrom(text, regex) {
        const match = String(text || "").match(regex);
        return match ? Number(match[1]) : 0;
    }

    function firstMatch(text, regex) {
        const match = String(text || "").match(regex);
        return match ? String(match[1] || "").trim() : "";
    }

    function cleanTargetPrefix(text) {
        return String(text || "")
            .replace(/^.*?(up\s+to\s+\d+\s+of\s+)/i, "$1")
            .replace(/^.*?(your\s+leader|your\s+characters?|your\s+leader\s+or\s+characters?|this\s+card|this\s+character)/i, "$1")
            .trim();
    }

    function dedupeConditions(conditions) {
        const seen = new Set();
        return conditions.filter(condition => {
            const key = JSON.stringify(condition);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function dedupeFilters(filters) {
        const seen = new Set();
        return filters.filter(filter => {
            const key = JSON.stringify(filter);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    global.EffectBlockParser = {
        parseEffectText,
        parseSingleEffectText,
        parseFilters,
        parseCosts,
        parseConditions
    };
})(typeof window !== "undefined" ? window : globalThis);
