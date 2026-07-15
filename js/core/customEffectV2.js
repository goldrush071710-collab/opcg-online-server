// customEffectV2.js
// Safe no-code custom effect drafts. This sits above the older block engine.

(function customEffectV2Factory(global) {
    const CONFIG = {
        enabled: false,
        provider: "ollama",
        endpoint: "http://localhost:11434/api/generate",
        model: "llama3.1"
    };

    const STATUSES = Object.freeze({
        automated: "automated",
        needsReview: "needsReview",
        displayOnly: "displayOnly",
        unsupported: "unsupported"
    });

    const EVENTS = Object.freeze({
        onPlay: "onPlay",
        whenAttacking: "whenAttacking",
        whenBlocking: "whenBlocking",
        onOpponentAttack: "onOpponentAttack",
        activateMain: "activateMain",
        onKO: "onKO",
        trigger: "trigger",
        counter: "counter",
        opponentPlaysStage: "opponentPlaysStage",
        endOfYourTurn: "endOfYourTurn",
        startOfYourTurn: "startOfYourTurn",
        yourTurn: "yourTurn",
        opponentTurn: "opponentTurn",
        static: "static",
        wouldBeKOd: "wouldBeKOd"
    });

    const DURATIONS = Object.freeze({
        untilEndOfTurn: "untilEndOfTurn",
        untilOpponentNextTurn: "untilOpponentNextTurn",
        duringBattle: "duringBattle",
        permanent: "permanent"
    });

    const COSTS_REQUIRING_AMOUNT = new Set([
        "donMinus",
        "restDon",
        "trashCardsFromHand",
        "discardCards",
        "returnDon",
        "trashLife",
        "trashTopDeck",
        "placeTrashBottomDeck",
        "placeHandBottomDeck",
        "addLifeToHand"
    ]);

    const ACTIONS_REQUIRING_TARGET = new Set([
        "ko",
        "rest",
        "setActive",
        "modifyPower",
        "setPower",
        "giveKeyword",
        "bounceToHand",
        "placeBottomDeck",
        "placeTrashBottomDeckSelected",
        "trashBoardCard",
        "attachRestedDon",
        "playFromHand",
        "playFromTrash",
        "playFromHandOrTrash",
        "addFromTrashToHand",
        "trashSelectedHand",
        "placeHandTopDeckSelected",
        "addStatus"
    ]);

    const ACTIONS_REQUIRING_AMOUNT = new Set([
        "draw",
        "opponentDraw",
        "modifyPower",
        "setPower",
        "addRestedDon",
        "setDonActive",
        "returnDon",
        "trashTopDeck",
        "trashOpponentLife",
        "healLife",
        "attachRestedDon",
        "addDon",
        "trashCardsFromHand",
        "opponentTrashCardsFromHand",
        "opponentPlaceHandBottomDeck",
        "placeHandBottomDeck",
        "searchTopDeck",
        "modifyCost"
    ]);

    const EVENT_LABELS = Object.freeze({
        onPlay: "On Play",
        whenAttacking: "When Attacking",
        whenBlocking: "When Blocking",
        onOpponentAttack: "On Your Opponent's Attack",
        activateMain: "Activate: Main",
        onKO: "On K.O.",
        trigger: "Trigger",
        counter: "Counter",
        opponentPlaysStage: "Opponent Plays a Stage",
        endOfYourTurn: "End of Your Turn",
        startOfYourTurn: "Start of Your Turn",
        yourTurn: "Your Turn",
        opponentTurn: "Opponent's Turn",
        static: "Static",
        wouldBeKOd: "A card would be K.O.'d"
    });

    const TARGET_LABELS = Object.freeze({
        thisLeader: "This Leader",
        thisCard: "This Card",
        yourLeader: "Your Leader",
        opponentLeader: "Opponent Leader",
        yourCharacters: "Your Characters",
        opponentCharacters: "Opponent Characters",
        yourLeaderOrCharacters: "Your Leader or Characters",
        opponentLeaderOrCharacters: "Opponent Leader or Characters",
        yourStage: "Your Stage",
        opponentStage: "Opponent Stage",
        selectedCards: "Chosen card(s)"
    });

    function createId(prefix = "effect") {
        if (global.crypto && typeof global.crypto.randomUUID === "function") {
            return `${prefix}-${global.crypto.randomUUID()}`;
        }

        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeEffect(raw = {}) {
        const event = raw.event || raw.timing || { type: raw.type || EVENTS.activateMain };
        const normalized = {
            system: "customEffectV2",
            id: raw.id || createId("custom-effect"),
            automationStatus: raw.automationStatus || STATUSES.automated,
            sourceText: raw.sourceText || raw.text || raw.generatedText || "",
            event: {
                type: event.type || EVENTS.activateMain,
                source: event.source || "thisCard",
                target: event.target || null,
                sourceType: event.sourceType || null
            },
            optional: Boolean(raw.optional) || event.type === EVENTS.wouldBeKOd,
            limit: raw.limit || limitFromOldLimits(raw.limits),
            costs: Array.isArray(raw.costs) ? raw.costs.map(normalizeCost) : [],
            conditions: Array.isArray(raw.conditions) ? raw.conditions : [],
            targets: Array.isArray(raw.targets) ? raw.targets.map(normalizeTarget) : [],
            actions: Array.isArray(raw.actions) ? raw.actions.map(normalizeAction) : [],
            generatedText: raw.generatedText || raw.text || raw.sourceText || "",
            text: raw.text || raw.generatedText || raw.sourceText || "",
            warnings: Array.isArray(raw.warnings) ? raw.warnings : []
        };

        const validation = validateEffect(normalized);
        if (validation.errors.length && normalized.automationStatus === STATUSES.automated) {
            normalized.automationStatus = STATUSES.needsReview;
        }

        return normalized;
    }

    function limitFromOldLimits(limits) {
        if (!Array.isArray(limits)) return null;
        return limits.some(limit => limit?.type === "oncePerTurn")
            ? { type: "oncePerTurn" }
            : null;
    }

    function normalizeCost(cost = {}) {
        return {
            type: cost.type || "none",
            amount: cost.amount === "" || cost.amount === undefined ? "" : Number(cost.amount)
        };
    }

    function normalizeTarget(target = {}) {
        return {
            id: target.id || createId("selection"),
            label: target.label || "",
            controller: target.controller || "self",
            zone: target.zone || "characters",
            count: {
                min: Number(target.count?.min ?? (target.optional ? 0 : 1)),
                max: Number(target.count?.max ?? 1)
            },
            filters: Array.isArray(target.filters) ? target.filters : [],
            optional: Boolean(target.optional)
        };
    }

    function normalizeAction(action = {}) {
        return {
            ...action,
            type: action.type || "draw",
            target: normalizeActionTarget(action.target),
            amount: action.amount === "" || action.amount === undefined ? action.amount : Number(action.amount)
        };
    }

    function normalizeActionTarget(target) {
        if (!target) return "";
        if (typeof target === "string") return target;
        if (target.type === "selection") return target.selectionId || "selectedCards";
        return target.type || target.id || "";
    }

    function parseEffectText(text, options = {}) {
        const source = normalizeInputText(text);
        const warnings = [];
        const expandedSource = expandSlashTimingText(source);
        const effects = splitEffectLines(expandedSource)
            .flatMap(expandCombinedTimingLine)
            .map((line, index) => parseSingleEffect(line, {
                ...options,
                index,
                warnings
            }))
            .filter(Boolean);

        if (source && !effects.length) {
            warnings.push("No supported effects were found. Start with text like [On Play], [When Attacking], [When Blocking], [Activate: Main], [Counter], [Trigger], or [Once Per Turn].");
        }

        return { effects, warnings };
    }

    function normalizeInputText(text) {
        return String(text || "")
            .replace(/â€™|â€˜|’|‘/g, "'")
            .replace(/â€œ|â€�|“|”/g, "\"")
            .replace(/â€“|â€”|–|—/g, "-")
            .replace(/K\.O\.â€™d|K\.O\.ed|K\.O\.d/gi, "K.O.'d")
            .replace(/opponentâ€™s/gi, "opponent's")
            .replace(/donâ€™t/gi, "don't")
            .trim();
    }

    function expandSlashTimingText(text) {
        return normalizeInputText(text)
            .split(/\r?\n/)
            .flatMap(line => expandCombinedTimingLine(line))
            .join("\n");
    }

    function splitEffectLines(text) {
        if (!text.trim()) return [];

        const timingPattern = String.raw`\[\s*(?:on\s+play|when\s+attacking|when\s+block(?:ing)?|on\s+block(?:ing)?|on\s+your\s+opponent'?s\s+attack|activate\s*:?\s*main|main|trigger|counter|on\s+k\.?\s*o\.?|once\s+per\s+turn|end\s+of\s+your\s+turn|start\s+of\s+your\s+turn|your\s+turn|opponent'?s\s+turn)\s*\]`;
        const keywordPattern = String.raw`\[\s*(?:blocker|rush\s*:\s*characters?|characters?\s*:\s*rush|double\s+attack|banish|unblockable)\s*\]`;
        const keywordSeparatedText = text.replace(new RegExp(`(${keywordPattern})\\s+(?=${timingPattern})`, "ig"), "$1\n");
        const sentenceSeparatedText = keywordSeparatedText.replace(new RegExp(`([.!?])\\s+(?=${timingPattern})`, "ig"), "$1\n");
        const timingSplit = sentenceSeparatedText
            .split(new RegExp(`\\r?\\n(?=\\s*${timingPattern})`, "ig"))
            .map(part => part.trim())
            .filter(Boolean);

        if (timingSplit.length > 1) return mergeLeadingDonRequirements(timingSplit);

        if (/\bchoose\s+(?:one|1)\s*:?\s*[\r\n]+\s*(?:[-*•]|\d+[.)])\s+/i.test(text)) {
            return [text.trim()];
        }

        const lines = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

        return lines.length ? lines : [text.trim()];
    }

    function mergeLeadingDonRequirements(parts) {
        const merged = [];
        let pendingRequirement = "";

        for (const part of parts) {
            if (/^\s*(?:\[\s*don!!?\s*x\s*\d+\s*\]|don!!?\s*x\s*\d+)\s*$/i.test(part)) {
                pendingRequirement = `${pendingRequirement} ${part}`.trim();
                continue;
            }

            merged.push(pendingRequirement ? `${pendingRequirement} ${part}`.trim() : part);
            pendingRequirement = "";
        }

        if (pendingRequirement) merged.push(pendingRequirement);

        return merged;
    }

    function expandCombinedTimingLine(line) {
        const source = String(line || "").trim();
        const prefixPattern = /^\s*((?:\[\s*(?:when\s+attacking|when\s+block(?:ing)?|on\s+block(?:ing)?|on\s+your\s+opponent'?s\s+attack|on\s+play|activate\s*:?\s*main|main|counter|trigger|on\s+k\.?\s*o\.?)\s*\]\s*(?:\/\s*)?){2,})([\s\S]*)$/i;
        const match = source.match(prefixPattern);

        if (!match) return [source];

        const timingTags = [...match[1].matchAll(/\[[^\]]+\]/g)].map(tagMatch => tagMatch[0]);
        const body = match[2].trim();

        return timingTags.map(tag => `${tag} ${body}`.trim());
    }

    function parseSingleEffect(rawText, options = {}) {
        const sourceText = normalizeInputText(rawText);
        if (!sourceText) return null;

        const warnings = [];
        let working = sourceText;
        const limit = /\[\s*once\s+per\s+turn\s*\]|\bonce\s+per\s+turn\b/i.test(working)
            ? { type: "oncePerTurn" }
            : null;

        working = working.replace(/\[\s*once\s+per\s+turn\s*\]\s*:?\s*/ig, "").trim();

        const preParsed = parseLeadingRequirements(working);
        working = preParsed.text;

        const hadExplicitEvent = /^\s*\[\s*(?:on\s+play|when\s+attacking|when\s+block(?:ing)?|on\s+block(?:ing)?|on\s+your\s+opponent'?s\s+attack|activate\s*:?\s*main|main|trigger|counter|on\s+k\.?\s*o\.?|end\s+of\s+your\s+turn|start\s+of\s+your\s+turn|your\s+turn|opponent'?s\s+turn)\s*\]/i.test(working);
        const event = detectEvent(working);
        const originalEventType = event.type;
        if (!hadExplicitEvent && (preParsed.conditions.length || /^\s*(?:if|while|this\s+(?:leader|card|character)\s+cannot|your\s+.+cannot|according\s+to\s+the\s+rules)/i.test(working)) && event.type === EVENTS.activateMain) {
            event.type = EVENTS.static;
        }
        if (event.strippedText !== working) {
            working = event.strippedText;
        }

        let optional = /\byou\s+may\b|\bup\s+to\b/i.test(sourceText);
        const { costText, actionText } = splitCostAndAction(working);
        const costs = parseCosts(costText);
        const actions = [];
        const targets = [];
        const globalConditionText = stripActionScopedConditions(actionText || working);
        const costConditionText = stripActionScopedConditions(costText);
        const shouldUseGlobalConditions = event.type === EVENTS.static ||
            event.type === EVENTS.yourTurn ||
            event.type === EVENTS.opponentTurn ||
            event.type === EVENTS.trigger;
        const conditions = [
            ...preParsed.conditions,
            ...parseConditions(costConditionText, event),
            ...(shouldUseGlobalConditions ? parseConditions(globalConditionText, event) : [])
        ];

        if (
            originalEventType !== EVENTS.wouldBeKOd &&
            /would\s+be\s+(?:k\.?\s*o\.?|ko)(?:ed|'?d)?/i.test(sourceText) &&
            /\binstead\b/i.test(sourceText)
        ) {
            event.type = EVENTS.wouldBeKOd;
            event.sourceType = /card\s+effect/i.test(sourceText) ? "cardEffect" : "any";
            event.target = {
                controller: /opponent/i.test(sourceText) && !/opponent'?s\s+turn/i.test(sourceText) ? "opponent" : "self",
                zone: /this\s+(?:character|card)/i.test(sourceText)
                    ? "thisCard"
                    : /leader/i.test(sourceText) ? "leaderOrCharacters" : "characters"
            };
            if (originalEventType === EVENTS.yourTurn || originalEventType === EVENTS.opponentTurn) {
                conditions.push({ type: originalEventType === EVENTS.yourTurn ? "isYourTurn" : "isOpponentTurn" });
            }
        }

        if (event.type === EVENTS.wouldBeKOd || /\binstead\b/i.test(sourceText)) {
            optional = true;
            actions.push({ type: "preventEvent", event: "current" });
            if (!event.target) {
                event.target = { controller: "self", zone: "characters" };
                warnings.push("I interpreted 'a character' as your Character. Change the controller field if that is wrong.");
            }
        }

        parseActions(actionText || working, { actions, targets, warnings, sourceCardName: options.cardName || "", event });

        const effect = normalizeEffect({
            id: `${options.cardNumber || "CUSTOM"}-effect-${Number(options.index || 0) + 1}`,
            automationStatus: STATUSES.automated,
            sourceText,
            event,
            optional,
            limit,
            costs,
            conditions,
            targets,
            actions,
            generatedText: cleanGeneratedText(sourceText),
            text: cleanGeneratedText(sourceText),
            warnings
        });

        const validation = validateEffect(effect);
        if (validation.errors.length) {
            effect.automationStatus = effect.actions.length ? STATUSES.needsReview : STATUSES.displayOnly;
        }

        return effect;
    }

    function detectEvent(text) {
        const patterns = [
            { type: EVENTS.whenAttacking, regex: /^\s*\[\s*when\s+attacking\s*\]\s*:?\s*/i },
            { type: EVENTS.whenBlocking, regex: /^\s*\[\s*when\s+block(?:ing)?\s*\]\s*:?\s*/i },
            { type: EVENTS.whenBlocking, regex: /^\s*\[\s*on\s+block(?:ing)?\s*\]\s*:?\s*/i },
            { type: EVENTS.onOpponentAttack, regex: /^\s*\[\s*on\s+your\s+opponent'?s\s+attack\s*\]\s*:?\s*/i },
            { type: EVENTS.onPlay, regex: /^\s*\[\s*on\s+play\s*\]\s*:?\s*/i },
            { type: EVENTS.activateMain, regex: /^\s*\[\s*activate\s*:?\s*main\s*\]\s*:?\s*/i },
            { type: EVENTS.activateMain, regex: /^\s*\[\s*main\s*\]\s*:?\s*/i },
            { type: EVENTS.counter, regex: /^\s*\[\s*counter\s*\]\s*:?\s*/i },
            { type: EVENTS.trigger, regex: /^\s*\[\s*trigger\s*\]\s*:?\s*/i },
            { type: EVENTS.onKO, regex: /^\s*\[\s*on\s+k\.?\s*o\.?\s*\]\s*:?\s*/i },
            { type: EVENTS.endOfYourTurn, regex: /^\s*\[\s*end\s+of\s+your\s+turn\s*\]\s*:?\s*/i },
            { type: EVENTS.startOfYourTurn, regex: /^\s*\[\s*start\s+of\s+your\s+turn\s*\]\s*:?\s*/i },
            { type: EVENTS.yourTurn, regex: /^\s*\[\s*your\s+turn\s*\]\s*:?\s*/i },
            { type: EVENTS.opponentTurn, regex: /^\s*\[\s*opponent'?s\s+turn\s*\]\s*:?\s*/i }
        ];

        if (/if\s+your\s+opponent\s+plays\s+a\s+stage\s+card/i.test(text)) {
            return {
                type: EVENTS.opponentPlaysStage,
                source: "thisCard",
                strippedText: text.replace(/if\s+your\s+opponent\s+plays\s+a\s+stage\s+card\s*,?\s*/i, "").trim()
            };
        }

        for (const pattern of patterns) {
            if (pattern.regex.test(text)) {
                return {
                    type: pattern.type,
                    source: "thisCard",
                    strippedText: text.replace(pattern.regex, "").trim()
                };
            }
        }

        if (/would\s+be\s+(?:k\.?\s*o\.?|ko)(?:ed|'?d)?/i.test(text)) {
            return {
                type: EVENTS.wouldBeKOd,
                source: "thisCard",
                sourceType: /card\s+effect/i.test(text) ? "cardEffect" : "any",
                target: {
                    controller: /opponent/i.test(text) ? "opponent" : "self",
                    zone: /this\s+(?:character|card)/i.test(text)
                        ? "thisCard"
                        : /leader/i.test(text) ? "leaderOrCharacters" : "characters"
                },
                strippedText: text
            };
        }

        return {
            type: detectStaticKeywordEvent(text),
            source: "thisCard",
            strippedText: text
        };
    }

    function detectStaticKeywordEvent(text) {
        return /^\s*\[\s*(?:blocker|rush\s*:\s*characters?|characters?\s*:\s*rush|double\s+attack|banish|unblockable)\s*\]\s*$/i.test(text) ||
            /^\s*this\s+(?:character|card)\s+gains?\s+(?:rush\s*:\s*characters?|characters?\s*:\s*rush|blocker|rush|double\s+attack|banish|unblockable)\s*\.?\s*$/i.test(text) ||
            /^\s*this\s+(?:leader|card|character)\s+cannot\s+attack/i.test(text) ||
            /^\s*your\s+.+cannot\s+be\s+k\.?\s*o/i.test(text) ||
            /^\s*according\s+to\s+the\s+rules/i.test(text) ||
            /^\s*if\b[\s\S]+?\b(?:gains?|gain|cannot|give)\b/i.test(text) ||
            /^\s*while\b[\s\S]+?\b(?:gains?|gain|cannot|give|play)\b/i.test(text)
            ? EVENTS.static
            : EVENTS.activateMain;
    }

    function parseLeadingRequirements(text) {
        const conditions = [];
        let working = String(text || "");

        for (const match of [...working.matchAll(/\[\s*don!!?\s*x\s*(\d+)\s*\]\s*/ig)]) {
            conditions.push({
                type: "sourceAttachedDonAtLeast",
                amount: Number(match[1])
            });
        }

        const plainDonMatch = working.match(/^\s*don!!?\s*x\s*(\d+)\b/i);
        if (plainDonMatch) {
            conditions.push({
                type: "sourceAttachedDonAtLeast",
                amount: Number(plainDonMatch[1])
            });
        }

        working = working
            .replace(/\[\s*don!!?\s*x\s*\d+\s*\]\s*/ig, "")
            .replace(/^\s*don!!?\s*x\s*\d+\s*/i, "")
            .trim();

        return { text: working, conditions };
    }

    function parseConditions(text, event = {}) {
        const source = String(text || "");
        const conditions = [];

        pushCondition(conditions, source, /if\s+you\s+have\s+(\d+)\s+or\s+less\s+life/i, "selfLife", "<=");
        pushCondition(conditions, source, /if\s+you\s+have\s+(\d+)\s+or\s+more\s+life/i, "selfLife", ">=");
        pushCondition(conditions, source, /if\s+your\s+opponent\s+has\s+(\d+)\s+or\s+less\s+life/i, "opponentLife", "<=");
        pushCondition(conditions, source, /if\s+your\s+opponent\s+has\s+(\d+)\s+or\s+more\s+life/i, "opponentLife", ">=");
        pushCondition(conditions, source, /if\s+you\s+have\s+(\d+)\s+or\s+more\s+cards?\s+in\s+your\s+trash/i, "selfTrash", ">=");
        pushCondition(conditions, source, /if\s+you\s+have\s+(\d+)\s+or\s+less\s+cards?\s+in\s+your\s+hand/i, "selfHand", "<=");
        pushCondition(conditions, source, /if\s+your\s+opponent\s+has\s+(\d+)\s+or\s+more\s+cards?\s+in\s+their\s+hand/i, "opponentHand", ">=");
        pushDonFieldConditions(conditions, source);
        pushCondition(conditions, source, /if\s+your\s+opponent\s+has\s+(\d+)\s+active\s+don/i, "opponentActiveDon", "==");
        pushCondition(conditions, source, /if\s+your\s+opponent\s+has\s+(\d+)\s+or\s+more\s+rested\s+characters?/i, "opponentRestedCharacters", ">=");
        pushCondition(conditions, source, /if\s+you\s+have\s+(\d+)\s+or\s+more\s+characters?/i, "selfCharacters", ">=");

        const selfPowerCharacter = source.match(/if\s+you\s+have\s+(?:a\s+|an\s+)?characters?\s+with\s+(\d+)(?:\s+power)?\s+or\s+(more|greater|higher|less|lower)/i) ||
            source.match(/if\s+you\s+have\s+(?:a\s+|an\s+)?characters?\s+with\s+(?:a\s+)?(?:base\s+)?power\s+of\s+(\d+)\s+or\s+(more|greater|higher|less|lower)/i);
        if (selfPowerCharacter) {
            const direction = String(selfPowerCharacter[2] || "").toLowerCase();
            conditions.push({
                type: "selfControlsCharacterPower",
                operator: /less|lower/.test(direction) ? "<=" : ">=",
                value: Number(selfPowerCharacter[1])
            });
        }

        const leaderType = firstMatch(source, /if\s+your\s+leader\s+has\s+(?:a\s+)?(?:specific\s+type|the\s+\{([^}]+)\}\s+type)|if\s+your\s+leader\s+has\s+type\s+\{([^}]+)\}/i);
        if (leaderType) {
            conditions.push({ type: "leaderTypeIncludes", controller: "self", value: leaderType });
        }

        const leaderNameIncludes = firstMatch(source, /if\s+your\s+lea?der'?s?\s+name\s+includes\s+(?:"([^"]+)"|\[([^\]]+)\])/i);
        if (leaderNameIncludes) {
            conditions.push({ type: "leaderNameIncludes", controller: "self", value: leaderNameIncludes });
        }

        const leaderNameOrType = source.match(/if\s+your\s+lea?der\s+is\s+\[([^\]]+)\]\s+or\s+is\s+a?\s*\{([^}]+)\}\s+type/i);
        if (leaderNameOrType) {
            conditions.push({
                type: "any",
                conditions: [
                    { type: "leaderNameEquals", controller: "self", value: leaderNameOrType[1].trim() },
                    { type: "leaderTypeIncludes", controller: "self", value: leaderNameOrType[2].trim() }
                ]
            });
        } else {
            const leaderName = firstMatch(source, /if\s+your\s+lea?der\s+is\s+\[([^\]]+)\]/i);
            if (leaderName) {
                conditions.push({ type: "leaderNameEquals", controller: "self", value: leaderName });
            }

            const leaderTypeBrace = firstMatch(source, /if\s+your\s+lea?der\s+is\s+\{([^}]+)\}\s+type/i);
            if (leaderTypeBrace) {
                conditions.push({ type: "leaderTypeIncludes", controller: "self", value: leaderTypeBrace });
            }
        }

        const leaderColor = firstMatch(source, /if\s+your\s+lea?der\s+is\s+(red|blue|green|purple|black|yellow)\b/i);
        if (leaderColor) {
            conditions.push({ type: "leaderColorIs", controller: "self", value: leaderColor });
        }

        if (/if\s+you\s+have\s+a\s+stage\s+card(?:\s+in\s+play|\s+on\s+your\s+field)?/i.test(source) ||
            /if\s+you\s+have\s+a\s+stage\s+card\s+on\s+your\s+field/i.test(source)) {
            conditions.push({ type: "selfHasStage" });
        }

        if (/if\s+you\s+have\s+no\s+stage\s+card/i.test(source) || /you\s+have\s+no\s+stage\s+card/i.test(source)) {
            conditions.push({ type: "selfHasNoStage" });
        }

        const leaderPower = firstMatch(source, /if\s+your\s+leader\s+has\s+(\d+)\s+power/i);
        if (leaderPower) {
            conditions.push({ type: "leaderPower", controller: "self", operator: "==", value: Number(leaderPower) });
        }

        if (/if\s+this\s+character\s+has\s+(?:a\s+)?don!!?\s+card\s+attached/i.test(source)) {
            conditions.push({ type: "sourceAttachedDonAtLeast", amount: 1 });
        }

        const sourcePower = firstMatch(source, /if\s+this\s+character\s+has\s+(\d+)\s+power\s+or\s+more/i);
        if (sourcePower) {
            conditions.push({ type: "sourcePower", operator: ">=", value: Number(sourcePower) });
        }

        if (/if\s+you\s+have\s+less\s+life\s+cards?\s+than\s+your\s+opponent/i.test(source)) {
            conditions.push({ type: "lifeComparison", operator: "<" });
        }

        const leadingNameCondition = source.match(/^\s*if\s+you\s+have\s+(?:a\s+|an\s+)?(?:character\s+)?\[([^\]]+)\]\s+(?:in\s+play|on\s+your\s+field|on\s+your\s+character\s+field)?/i);
        if (leadingNameCondition) {
            conditions.push({ type: "controlCardName", controller: "self", value: leadingNameCondition[1].trim() });
        }

        const namedInPlay = source.match(/if\s+you\s+have\s+(?:a\s+|an\s+)?\[([^\]]+)\]\s+(?:in\s+play|on\s+your\s+field|on\s+your\s+character\s+field)/i);
        if (namedInPlay && !conditions.some(condition => condition.type === "controlCardName" && condition.value === namedInPlay[1].trim())) {
            conditions.push({ type: "controlCardName", controller: "self", value: namedInPlay[1].trim() });
        }

        const leaderBelowBase = source.match(/if\s+your\s+lea?ders?\s+power\s+is\s+less\s+than\s+your\s+lea?ders?\s+base\s+power/i);
        if (leaderBelowBase) {
            conditions.push({ type: "leaderPowerBelowBase", controller: "self" });
        }

        return conditions;
    }

    function stripActionScopedConditions(text) {
        return String(text || "")
            .replace(/\bthen\s*,?\s*if\s+[^.]+?(?=(?:give|set|draw|k\.?\s*o|ko|rest|play|trash|return|place|add)\b)/ig, "then ");
    }

    function pushCondition(conditions, text, regex, type, operator) {
        const match = String(text || "").match(regex);
        if (match) {
            conditions.push({ type, operator, value: Number(match[1]) });
        }
    }

    function splitCostAndAction(text) {
        const colonIndex = text.indexOf(":");
        if (colonIndex === -1) return { costText: "", actionText: text };

        const before = text.slice(0, colonIndex).trim();
        const after = text.slice(colonIndex + 1).trim();

        if (!looksLikeCost(before)) {
            return { costText: "", actionText: text };
        }

        return { costText: before, actionText: after };
    }

    function looksLikeCost(text) {
        return /don!!?\s*-\s*\d+/i.test(text) ||
            /trash\s+\d+\s+cards?\s+from\s+(?:your\s+)?hand/i.test(text) ||
            /discard\s+\d+\s+cards?/i.test(text) ||
            /(?:you\s+may\s+)?rest\s+(?:this\s+(?:card|stage|character|leader)|\d+\s+(?:of\s+your\s+)?don)/i.test(text) ||
            /trash\s+this\s+(?:card|character|stage)/i.test(text) ||
            /return\s+this\s+(?:card|character|stage)\s+to\s+the\s+owner'?s\s+hand/i.test(text) ||
            /return\s+\d+\s+don/i.test(text) ||
            /trash\s+\d+\s+(?:of\s+your\s+)?life/i.test(text) ||
            /trash\s+the\s+top\s+\d+\s+cards?\s+of\s+(?:your\s+)?deck/i.test(text) ||
            /place\s+\d+\s+cards?\s+from\s+your\s+trash\s+at\s+the\s+bottom\s+of\s+your\s+deck/i.test(text) ||
            /place\s+\d+\s+cards?\s+from\s+your\s+hand\s+at\s+the\s+bottom\s+of\s+your\s+deck/i.test(text) ||
            /add\s+\d+\s+cards?\s+from\s+the\s+top\s+of\s+your\s+life\s+cards?\s+to\s+your\s+hand/i.test(text);
    }

    function parseCosts(text) {
        const costs = [];
        const source = String(text || "");

        for (const match of source.matchAll(/don!!?\s*-\s*(\d+)/ig)) {
            costs.push({ type: "donMinus", amount: Number(match[1]) });
        }

        for (const match of source.matchAll(/trash\s+(\d+)\s+cards?\s+from\s+(?:your\s+)?hand/ig)) {
            costs.push({ type: "trashCardsFromHand", amount: Number(match[1]) });
        }

        for (const match of source.matchAll(/discard\s+(\d+)\s+cards?/ig)) {
            costs.push({ type: "discardCards", amount: Number(match[1]) });
        }

        for (const match of source.matchAll(/rest\s+(\d+)\s+(?:of\s+your\s+)?don/ig)) {
            costs.push({ type: "restDon", amount: Number(match[1]) });
        }

        for (const match of source.matchAll(/return\s+(\d+)\s+don/ig)) {
            costs.push({ type: "returnDon", amount: Number(match[1]) });
        }

        for (const match of source.matchAll(/trash\s+(\d+)\s+(?:of\s+your\s+)?life/ig)) {
            costs.push({ type: "trashLife", amount: Number(match[1]) });
        }

        if (/rest\s+this\s+(?:card|stage|character|leader)/i.test(source)) {
            costs.push({ type: "restThisCard" });
        }

        if (/trash\s+this\s+(?:card|character)/i.test(source)) {
            costs.push({ type: "trashThisCard" });
        }

        if (/trash\s+this\s+stage/i.test(source)) {
            costs.push({ type: "trashThisCard" });
        }

        if (/return\s+this\s+(?:card|character|stage)\s+to\s+the\s+owner'?s\s+hand/i.test(source)) {
            costs.push({ type: "returnThisCardToHand" });
        }

        for (const match of source.matchAll(/trash\s+the\s+top\s+(\d+)\s+cards?\s+of\s+(?:your\s+)?deck/ig)) {
            costs.push({ type: "trashTopDeck", amount: Number(match[1]) });
        }

        for (const match of source.matchAll(/place\s+(\d+)\s+cards?\s+from\s+your\s+trash\s+at\s+the\s+bottom\s+of\s+your\s+deck/ig)) {
            costs.push({ type: "placeTrashBottomDeck", amount: Number(match[1]) });
        }

        for (const match of source.matchAll(/place\s+(\d+)\s+cards?\s+from\s+your\s+hand\s+at\s+the\s+bottom\s+of\s+your\s+deck/ig)) {
            costs.push({ type: "placeHandBottomDeck", amount: Number(match[1]) });
        }

        for (const match of source.matchAll(/add\s+(\d+)\s+cards?\s+from\s+the\s+top\s+of\s+your\s+life\s+cards?\s+to\s+your\s+hand/ig)) {
            costs.push({ type: "addLifeToHand", amount: Number(match[1]) });
        }

        return costs;
    }

    function parseActions(text, context) {
        const source = String(text || "");

        if (parseChooseOneAction(source, context)) {
            return;
        }

        for (const match of source.matchAll(/\bdraw\s+(\d+)\s+cards?\b/ig)) {
            context.actions.push({
                type: "draw",
                amount: Number(match[1]),
                conditions: actionConditionsFromText(source, match.index || 0)
            });
        }

        for (const match of source.matchAll(/\byou\s+and\s+your\s+opponent\s+draw\s+(\d+)\s+cards?\b/ig)) {
            context.actions.push({
                type: "opponentDraw",
                amount: Number(match[1]),
                conditions: actionConditionsFromText(source, match.index || 0)
            });
        }

        parsePowerActions(source, context);
        parseSetPowerActions(source, context);
        parseKoActions(source, context);
        parseRestActions(source, context);
        parseStatusActions(source, context);
        parseSetActiveActions(source, context);
        parseDeckActions(source, context);
        parseSearchActions(source, context);
        parsePlayActions(source, context);
        parseLifeActions(source, context);
        parseHandActions(source, context);
        parseSourceMovementActions(source, context);
        parseDonActions(source, context);
        parseCostModificationActions(source, context);
        parseAliasActions(source, context);
        parseKeywordActions(source, context);
        sortActionsByTextOrder(source, context.actions);

        if (!context.actions.length) {
            context.warnings.push(`I could not automate this effect yet. It can be saved as display-only or edited: ${source}`);
        }
    }

    function sortActionsByTextOrder(text, actions) {
        if (!Array.isArray(actions) || actions.length < 2) return;

        actions
            .forEach((action, index) => {
                action.__sourceOrder = actionSourceIndex(text, action, index);
            });

        actions.sort((left, right) => {
            const leftOrder = Number.isFinite(left.__sourceOrder) ? left.__sourceOrder : Number.MAX_SAFE_INTEGER;
            const rightOrder = Number.isFinite(right.__sourceOrder) ? right.__sourceOrder : Number.MAX_SAFE_INTEGER;
            if (leftOrder !== rightOrder) return leftOrder - rightOrder;
            return 0;
        });

        actions.forEach(action => {
            delete action.__sourceOrder;
        });
    }

    function actionSourceIndex(text, action, fallbackIndex = 0) {
        const source = String(text || "");
        const fallback = source.length + fallbackIndex;

        if (!action) return fallback;

        if (action.type === "draw") {
            return regexIndex(source, new RegExp(`\\bdraw\\s+${escapeRegExp(String(action.amount || "\\d+"))}\\s+cards?\\b`, "i")) ??
                regexIndex(source, /\bdraw\s+\d+\s+cards?\b/i) ??
                fallback;
        }

        if (action.type === "playFromTrash" || action.type === "playFromHand" || action.type === "playFromHandOrTrash") {
            const zone = action.type === "playFromTrash" ? "trash" : action.type === "playFromHandOrTrash" ? "(?:hand|trash)" : "hand";
            return regexIndex(source, new RegExp(`\\bplay\\s+(?:up\\s+to\\s+)?\\d+\\s+.+?\\s+from\\s+(?:your\\s+)?${zone}\\b`, "i")) ??
                fallback;
        }

        if (action.type === "modifyPower" || action.type === "setPower") {
            const amount = Number(action.amount || 0);
            const amountText = amount > 0 ? `\\+\\s*${amount}` : String(amount);
            return regexIndex(source, new RegExp(`${amountText}\\s*(?:power)?`, "i")) ??
                regexIndex(source, /\bgains?\b|\bgive\b|\bgets?\b|\bset\b/i) ??
                fallback;
        }

        if (action.type === "giveKeyword") {
            return regexIndex(source, keywordRegex(action.keyword)) ?? fallback;
        }

        if (action.type === "ko") return regexIndex(source, /\bk\.?\s*o\.?\b|\bko\b/i) ?? fallback;
        if (action.type === "rest") return regexIndex(source, /\brest\s+(?!this\b|\d+\s+(?:of\s+your\s+)?don)/i) ?? fallback;
        if (action.type === "setActive") return regexIndex(source, /\bset\b[\s\S]{0,80}\bactive\b/i) ?? fallback;
        if (action.type === "searchTopDeck") return regexIndex(source, /\b(?:look\s+at|reveal|search)\b[\s\S]{0,80}\btop\b/i) ?? fallback;
        if (action.type === "trashCardsFromHand") return regexIndex(source, /\btrash\s+\d+\s+cards?\s+from\s+(?:your\s+)?hand\b/i) ?? fallback;
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

    function parseChooseOneAction(text, context) {
        const source = String(text || "");
        const chooseMatch = source.match(/choose\s+(?:one|1)\s*:?\s*([\s\S]+)/i);
        if (!chooseMatch) return false;

        const optionTexts = splitChooseOneOptions(chooseMatch[1]);

        if (optionTexts.length < 2) return false;

        const options = optionTexts.map((optionText, optionIndex) => {
            const optionContext = {
                actions: [],
                targets: context.targets,
                warnings: context.warnings
            };
            parseActions(optionText, optionContext);
            return {
                id: `option${optionIndex + 1}`,
                label: optionText.length > 56 ? `${optionText.slice(0, 53)}...` : optionText,
                text: optionText,
                actions: optionContext.actions
            };
        }).filter(option => option.actions.length);

        if (options.length < 2) return false;

        context.actions.push({
            type: "chooseOne",
            options
        });

        return true;
    }

    function splitChooseOneOptions(text) {
        const source = String(text || "").trim();
        if (!source) return [];

        const bulletOptions = source
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => line.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim())
            .filter(Boolean);

        if (bulletOptions.length >= 2) {
            return bulletOptions.map(cleanChooseOptionText).filter(Boolean);
        }

        const inlineBulletOptions = source
            .split(/\s+(?=(?:[-*•]|\d+[.)])\s+(?:up\s+to|draw|give|rest|set|k\.?\s*o|ko|return|place|add|trash|play)\b)/i)
            .map(option => option.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim())
            .filter(Boolean);

        if (inlineBulletOptions.length >= 2) {
            return inlineBulletOptions.map(cleanChooseOptionText).filter(Boolean);
        }

        return source
            .split(/\s*;\s*or\s*|\s+or\s+(?=(?:up\s+to|draw|give|rest|set|k\.?\s*o|ko|return|place|add|trash|play)\b)/i)
            .map(cleanChooseOptionText)
            .filter(Boolean);
    }

    function cleanChooseOptionText(option) {
        return String(option || "")
            .trim()
            .replace(/^(?:[-*•]|\d+[.)])\s*/, "")
            .replace(/[.;]+$/g, "")
            .trim();
    }

    function parsePowerActions(text, context) {
        const namedPowerRegex = /\b(up\s+to\s+\d+\s+\[[^\]]+\]\s+characters?(?:\s+cards?)?(?:\s+with\s+[^,.]+?)?)\s+gains?\s*([+-]\d+)(?:\s+power)?(?:\s+(?:until\s+the\s+end\s+of\s+this\s+turn|during\s+this\s+turn|during\s+this\s+battle|for\s+(?:this|the)\s+battle|this\s+battle|the\s+battle))?/ig;
        for (const match of text.matchAll(namedPowerRegex)) {
            const phrase = match[0];
            const selectionTarget = selectionTargetFromPhrase(phrase, context, "Power target");
            context.actions.push({
                type: "modifyPower",
                target: selectionTarget || targetFromPhrase(phrase),
                amount: Number(match[2]),
                duration: durationFromText(phrase, context.event?.type === EVENTS.static || context.event?.type === EVENTS.wouldBeKOd ? DURATIONS.permanent : DURATIONS.untilEndOfTurn),
                conditions: actionConditionsFromText(text, match.index || 0)
            });
        }

        const powerRegex = /(?:this\s+leader|this\s+card|this\s+character|all\s+of\s+your\s+characters?(?:\s+with\s+[^,.]+)?|up\s+to\s+\d+\s+\[[^\]]+\]\s+characters?(?:\s+cards?)?(?:\s+with\s+[^,.]+)?|up\s+to\s+\d+\s+of\s+your\s+\[[^\]]+\]\s+cards?'?s?|up\s+to\s+\d+\s+of\s+your\s+leader\s+or\s+characters?|up\s+to\s+\d+\s+of\s+your\s+characters?|up\s+to\s+\d+\s+of\s+your\s+opponent'?s\s+characters?(?:\s+or\s+lea?ders?)?|up\s+to\s+\d+\s+of\s+your\s+opponents?\s+characters?(?:\s+or\s+lea?ders?)?\s+cards?|your\s+leader\s+or\s+characters?|your\s+leader|your\s+characters?|opponent'?s\s+characters?(?:\s+or\s+lea?ders?)?)?\s*(?:gains?|gain|gets?|give)\s*(?:this\s+leader|this\s+card|this\s+character|all\s+of\s+your\s+characters?(?:\s+with\s+[^,.]+)?|up\s+to\s+\d+\s+\[[^\]]+\]\s+characters?(?:\s+cards?)?(?:\s+with\s+[^,.]+)?|up\s+to\s+\d+\s+of\s+your\s+\[[^\]]+\]\s+cards?'?s?|up\s+to\s+\d+\s+of\s+your\s+leader\s+or\s+characters?|up\s+to\s+\d+\s+of\s+your\s+characters?|up\s+to\s+\d+\s+of\s+your\s+opponent'?s\s+characters?(?:\s+or\s+lea?ders?)?|up\s+to\s+\d+\s+of\s+your\s+opponents?\s+characters?(?:\s+or\s+lea?ders?)?\s+cards?|your\s+leader\s+or\s+characters?|your\s+leader|your\s+characters?|opponent'?s\s+characters?(?:\s+or\s+lea?ders?)?)?\s*([+-]\d+)(?:\s+power)?(?:\s+(?:until\s+the\s+end\s+of\s+this\s+turn|during\s+this\s+turn|during\s+this\s+battle|for\s+(?:this|the)\s+battle|this\s+battle|the\s+battle))?/ig;

        for (const match of text.matchAll(powerRegex)) {
            if (namedPowerRegex.test(match[0])) {
                namedPowerRegex.lastIndex = 0;
                continue;
            }
            namedPowerRegex.lastIndex = 0;
            const phrase = match[0];
            const selectionTarget = selectionTargetFromPhrase(phrase, context, "Power target");
            context.actions.push({
                type: "modifyPower",
                target: selectionTarget || targetFromPhrase(phrase),
                amount: Number(match[1]),
                duration: durationFromText(phrase, context.event?.type === EVENTS.static || context.event?.type === EVENTS.wouldBeKOd ? DURATIONS.permanent : DURATIONS.untilEndOfTurn),
                conditions: actionConditionsFromText(text, match.index || 0)
            });
        }

        const simplePowerRegex = /\b(?:give\s+)?((?:all\s+of\s+)?(?:your|opponent'?s|your\s+opponent'?s)\s+(?:leader\s+or\s+characters?|characters?(?:\s+or\s+lea?ders?)?|lea?ders?)(?:\s+with\s+[^,.]+?)?|up\s+to\s+\d+\s+of\s+(?:your|your\s+opponent'?s|opponent'?s)\s+(?:leader\s+or\s+characters?|characters?(?:\s+or\s+lea?ders?)?|lea?ders?)(?:\s+with\s+[^,.]+?)?|up\s+to\s+\d+\s+of\s+your\s+\[[^\]]+\]\s+cards?|up\s+to\s+\d+\s+\[[^\]]+\]\s+characters?(?:\s+cards?)?(?:\s+with\s+[^,.]+?)?)\s+(?:gains?|gain)?\s*([+-]\d+)\s*(?:power)?(?:\s+(?:until\s+the\s+end\s+of\s+this\s+turn|during\s+this\s+turn|during\s+this\s+battle|for\s+(?:this|the)\s+battle|this\s+battle|the\s+battle))?/ig;
        for (const match of text.matchAll(simplePowerRegex)) {
            const phrase = match[0];
            const amount = Number(match[2]);
            if (!Number.isFinite(amount)) continue;
            if (hasSimilarAction(context.actions, "modifyPower", amount, match.index || 0, text)) continue;
            const selectionTarget = selectionTargetFromPhrase(phrase, context, "Power target");
            context.actions.push({
                type: "modifyPower",
                target: selectionTarget || targetFromPhrase(phrase),
                amount,
                duration: durationFromText(phrase, context.event?.type === EVENTS.static || context.event?.type === EVENTS.wouldBeKOd ? DURATIONS.permanent : DURATIONS.untilEndOfTurn),
                conditions: actionConditionsFromText(text, match.index || 0)
            });
        }
    }

    function hasSimilarAction(actions, type, amount, index, source) {
        const amountText = Number(amount || 0) > 0 ? `+${Number(amount)}` : String(Number(amount));
        const nearby = String(source || "").slice(Math.max(0, index - 20), index + 120).toLowerCase();
        return (actions || []).some(action => action.type === type &&
            Number(action.amount || 0) === Number(amount || 0) &&
            nearby.includes(amountText.toLowerCase()));
    }

    function parseSetPowerActions(text, context) {
        const source = String(text || "");
        const setRegex = /set\s+(?:that\s+|this\s+|your\s+)?(lea?der|lader|card|character)?'?s?\s*power\s+to\s+(\d+)|set\s+(?:that\s+|this\s+|your\s+)?(lea?der|lader|card|character)\s+as\s+(\d+)\s+power/i;
        const match = source.match(setRegex);
        if (!match) return;

        const targetPhrase = match[0];
        const amount = Number(match[2] || match[4]);
        const duration = /battle/i.test(targetPhrase)
            ? DURATIONS.duringBattle
            : /turn|until\s+the\s+end/i.test(targetPhrase)
                ? DURATIONS.untilEndOfTurn
                : DURATIONS.permanent;
        context.actions.push({
            type: "setPower",
            target: targetFromPhrase(targetPhrase),
            amount,
            duration,
            conditions: actionConditionsFromText(source, match.index || 0)
        });
    }

    function parseKoActions(text, context) {
        const match = text.match(/\b(?:k\.?\s*o\.?|ko)\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)(?:\.|,|\bthen\b|$)/i);
        if (!match) return;

        context.targets.push({
            id: `selection${context.targets.length + 1}`,
            label: readableSelectionLabel("K.O.", match[2]),
            controller: /opponent/i.test(match[2]) ? "opponent" : /your/i.test(match[2]) ? "self" : "any",
            zone: /stage/i.test(match[2]) ? "board" : /leader/i.test(match[2]) ? "leaderOrCharacters" : "characters",
            count: { min: /up\s+to/i.test(match[0]) ? 0 : 1, max: Number(match[1] || 1) },
            optional: /up\s+to/i.test(match[0]),
            filters: parseFilters(match[0], { sourceCardName: context.sourceCardName })
        });
        context.actions.push({
            type: "ko",
            target: context.targets[context.targets.length - 1].id,
            conditions: actionConditionsFromText(text, match.index || 0)
        });
    }

    function parseRestActions(text, context) {
        const source = String(text || "").replace(/\bthe\s+rest\b/ig, "the remaining cards");
        if (/rest\s+\d+\s+(?:of\s+your\s+)?don/i.test(source)) return;
        const match = source.match(/\brest\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)(?:\.|,|\bthen\b|$)/i);
        if (!match || /this\s+card/i.test(match[0])) return;

        context.targets.push({
            id: `selection${context.targets.length + 1}`,
            label: readableSelectionLabel("Rest", match[2]),
            controller: /opponent/i.test(match[2]) ? "opponent" : "self",
            zone: /cards?/i.test(match[2]) && !/characters?/i.test(match[2])
                ? "board"
                : /leader/i.test(match[2]) ? "leaderOrCharacters" : "characters",
            count: { min: /up\s+to/i.test(match[0]) ? 0 : 1, max: Number(match[1] || 1) },
            optional: /up\s+to/i.test(match[0]),
            filters: parseFilters(match[0], { sourceCardName: context.sourceCardName })
        });
        context.actions.push({
            type: "rest",
            target: context.targets[context.targets.length - 1].id,
            conditions: actionConditionsFromText(text, match.index || 0)
        });
    }

    function parseSetActiveActions(text, context) {
        const directMatch = text.match(/\bset\s+this\s+(lea?der|lader|card|character|stage)\s+(?:as\s+)?active/i);
        if (directMatch) {
            context.actions.push({
                type: "setActive",
                target: /lea?der|lader/i.test(directMatch[1]) ? "thisLeader" : "thisCard",
                conditions: actionConditionsFromText(text, directMatch.index || 0)
            });
            return;
        }

        const match = text.match(/\bset\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)\s+(?:as\s+)?active/i);
        if (!match) return;

        if (/don!!?/i.test(match[2])) {
            context.actions.push({ type: "setDonActive", amount: Number(match[1] || 1) });
            return;
        }

        context.targets.push({
            id: `selection${context.targets.length + 1}`,
            label: readableSelectionLabel("Set active", match[2]),
            controller: /opponent/i.test(match[2]) ? "opponent" : "self",
            zone: /leader/i.test(match[2]) ? "leaderOrCharacters" : "characters",
            count: { min: /up\s+to/i.test(match[0]) ? 0 : 1, max: Number(match[1] || 1) },
            optional: /up\s+to/i.test(match[0]),
            filters: parseFilters(match[0], { sourceCardName: context.sourceCardName })
        });
        context.actions.push({
            type: "setActive",
            target: context.targets[context.targets.length - 1].id,
            conditions: actionConditionsFromText(text, match.index || 0)
        });
    }

    function parseDeckActions(text, context) {
        const source = String(text || "");
        const trashTop = numberFrom(text, /trash\s+the\s+top\s+(\d+)\s+cards?\s+of\s+(?:your\s+)?deck/i);
        if (trashTop) {
            context.actions.push({ type: "trashTopDeck", amount: trashTop });
        }

        for (const match of source.matchAll(/place\s+(?:the\s+)?rest\s+(?:at|on)\s+the\s+bottom\s+of\s+(?:your\s+)?deck/ig)) {
            // This is usually handled by searchTopDeck's restDestination.
        }

        const placeBoard = source.match(/place\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)\s+(?:at|on)\s+the\s+(top\s+or\s+bottom|bottom|top)\s+of\s+the\s+owner'?s\s+deck/i);
        if (placeBoard && !/\brest\b/i.test(placeBoard[2])) {
            const targetPhrase = placeBoard[2];
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: readableSelectionLabel("Deck placement", targetPhrase),
                controller: /opponent/i.test(targetPhrase) ? "opponent" : /your/i.test(targetPhrase) ? "self" : "any",
                zone: /characters?/i.test(targetPhrase) ? "characters" : "board",
                count: { min: /up\s+to/i.test(placeBoard[0]) ? 0 : 1, max: Number(placeBoard[1] || 1) },
                optional: /up\s+to/i.test(placeBoard[0]),
                filters: parseFilters(placeBoard[0], { sourceCardName: context.sourceCardName })
            };
            context.targets.push(target);
            context.actions.push({
                type: "placeBottomDeck",
                target: target.id,
                destination: /top\s+or\s+bottom/i.test(placeBoard[3])
                    ? "topOrBottom"
                    : /top/i.test(placeBoard[3]) ? "top" : "bottom",
                conditions: actionConditionsFromText(source, placeBoard.index || 0)
            });
        }

        const trashBottom = text.match(/add\s+cards?\s+from\s+trash\s+to\s+bottom\s+of\s+deck/i);
        if (trashBottom) {
            context.actions.push({ type: "placeTrashBottomDeck", amount: 1 });
        }

        const trashCardBottom = source.match(/place\s+(?:up\s+to\s+)?(\d+)?\s*cards?\s+from\s+your\s+opponent'?s\s+trash\s+at\s+the\s+bottom\s+of\s+their\s+deck/i);
        if (trashCardBottom) {
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: "Opponent trash card",
                controller: "opponent",
                zone: "trash",
                count: { min: /up\s+to/i.test(trashCardBottom[0]) ? 0 : 1, max: Number(trashCardBottom[1] || 1) },
                optional: /up\s+to/i.test(trashCardBottom[0]),
                filters: []
            };
            context.targets.push(target);
            context.actions.push({
                type: "placeTrashBottomDeckSelected",
                target: target.id,
                conditions: actionConditionsFromText(source, trashCardBottom.index || 0)
            });
        }
    }

    function parseSearchActions(text, context) {
        const source = String(text || "");
        const topMatch = source.match(/(?:look\s+at|reveal|search)\s+(?:up\s+to\s+)?(?:the\s+)?top\s+(\d+)\s+cards?\s+(?:of|from)\s+(?:your\s+)?deck|(?:look\s+at|reveal|search)\s+(\d+)\s+cards?\s+from\s+the\s+top\s+of\s+(?:your\s+)?deck|reveal\s+up\s+to\s+\d+\s+.+?\s+from\s+the\s+top\s+(\d+)\s+cards?\s+of\s+your\s+deck/i);
        const fullDeckSearch = source.match(/search\s+your\s+deck\s+for\s+up\s+to\s+(\d+)\s+(.+?),\s*reveal/i);
        const revealTopCard = source.match(/reveal\s+the\s+top\s+card\s+of\s+your\s+deck/i);

        if (!topMatch && !fullDeckSearch && !revealTopCard) return;

        const top = revealTopCard ? 1 : fullDeckSearch ? 999 : Number(topMatch[1] || topMatch[2] || topMatch[3] || 5);
        const revealAmount = Number(firstMatch(source, /reveal\s+up\s+to\s+(\d+)/i) || firstMatch(source, /add\s+up\s+to\s+(\d+)/i) || fullDeckSearch?.[1] || 1);
        const searchPhrase = firstMatch(source, /reveal\s+up\s+to\s+\d+\s+([\s\S]+?)\s+and\s+add/i) ||
            firstMatch(source, /reveal\s+up\s+to\s+\d+\s+([\s\S]+?)\s*,?\s*add/i) ||
            firstMatch(source, /add\s+(?:up\s+to\s+)?\d+\s+([\s\S]+?)\s+to\s+your\s+hand/i) ||
            firstMatch(source, /play\s+up\s+to\s+\d+\s+([\s\S]+?)\s+(?:from|to)/i) ||
            fullDeckSearch?.[2] ||
            source;
        const target = {
            id: `selection${context.targets.length + 1}`,
            label: "Search choice",
            controller: "self",
            zone: "deck",
            count: { min: 0, max: revealAmount },
            optional: true,
            filters: parseFilters(searchPhrase, { sourceCardName: context.sourceCardName })
        };

        context.targets.push(target);
        context.actions.push({
            type: "searchTopDeck",
            amount: top,
            target: target.id,
            maxSelect: revealAmount,
            selectedDestination: /\bplay\s+(?:up\s+to\s+)?\d+/i.test(source) ? "characterField" : "hand",
            restDestination: /trash\s+the\s+other|trash\s+the\s+rest/i.test(source) ? "trash" : "bottomDeck",
            shuffleAfter: Boolean(fullDeckSearch)
        });
    }

    function parsePlayActions(text, context) {
        const source = String(text || "");

        const playThisMatch = source.match(/\bplay\s+this\s+card\b/i);
        if (playThisMatch) {
            context.actions.push({
                type: "playThisCard",
                conditions: actionConditionsFromText(source, playThisMatch.index || 0)
            });
        }

        if (/activate\s+this\s+card'?s\s+\[\s*main\s*\]\s+effect/i.test(source)) {
            context.actions.push({ type: "activateMainEffect" });
        }

        const playFromZoneRegex = /play\s+(?:up\s+to\s+)?(\d+)\s+(.+?)\s+from\s+(?:your\s+)?(hand|trash)(?:\s+or\s+(?:your\s+)?(hand|trash))?/ig;
        for (const fromZone of source.matchAll(playFromZoneRegex)) {
            const zones = [fromZone[3], fromZone[4]].filter(Boolean).map(zone => zone.toLowerCase());
            const firstZone = zones[0] || "hand";
            const targetZone = zones.length > 1 ? "handOrTrash" : firstZone;
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: targetZone === "trash" ? "Trash card to play" : targetZone === "handOrTrash" ? "Hand or trash card to play" : "Card to play",
                controller: "self",
                zone: targetZone,
                count: { min: /up\s+to/i.test(fromZone[0]) ? 0 : 1, max: Number(fromZone[1] || 1) },
                optional: /up\s+to|you\s+may/i.test(source),
                filters: parseFilters(fromZone[2], { sourceCardName: context.sourceCardName })
            };
            if (/character/i.test(fromZone[2]) || /\[[^\]]+\]/.test(fromZone[2])) {
                target.filters.push({ field: "cardType", operator: "==", value: "character" });
            }
            context.targets.push(target);
            context.actions.push({
                type: targetZone === "trash" ? "playFromTrash" : targetZone === "handOrTrash" ? "playFromHandOrTrash" : "playFromHand",
                target: target.id,
                rested: /rested/i.test(source),
                conditions: actionConditionsFromText(source, fromZone.index || 0)
            });
        }
    }

    function parseLifeActions(text, context) {
        const source = String(text || "");

        if (/add\s+up\s+to\s+1\s+card\s+from\s+the\s+top\s+of\s+your\s+deck\s+to\s+the\s+top\s+of\s+your\s+life/i.test(source) ||
            /add\s+1\s+card\s+from\s+the\s+top\s+of\s+your\s+deck\s+to\s+the\s+top\s+of\s+your\s+life/i.test(source)) {
            context.actions.push({ type: "healLife", amount: 1, source: "deckTop" });
        }

        const trashOwnLife = source.match(/trash\s+(?:up\s+to\s+)?(\d+)?\s*cards?\s+from\s+the\s+top\s+of\s+your\s+life/i);
        if (trashOwnLife) {
            context.actions.push({ type: "trashLife", amount: Number(trashOwnLife[1] || 1), controller: "self" });
        }

        const trashOppLife = source.match(/trash\s+(?:up\s+to\s+)?(\d+)?\s*cards?\s+from\s+the\s+top\s+of\s+your\s+opponent'?s\s+life/i);
        if (trashOppLife) {
            context.actions.push({ type: "trashOpponentLife", amount: Number(trashOppLife[1] || 1) });
        }
    }

    function parseHandActions(text, context) {
        const source = String(text || "");

        if (/add\s+this\s+card\s+to\s+your\s+hand/i.test(source)) {
            context.actions.push({ type: "addThisCardToHand" });
        }

        const bounce = source.match(/return\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?(.+?)\s+to\s+the\s+owner'?s\s+hand/i);
        if (bounce && !/this\s+(?:card|character|stage)/i.test(bounce[0])) {
            const targetPhrase = bounce[2];
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: "Return target",
                controller: /opponent/i.test(targetPhrase) ? "opponent" : /your/i.test(targetPhrase) ? "self" : "any",
                zone: /stage/i.test(targetPhrase) ? "stage" : /leader/i.test(targetPhrase) ? "leaderOrCharacters" : "characters",
                count: { min: /up\s+to/i.test(bounce[0]) ? 0 : 1, max: Number(bounce[1] || 1) },
                optional: /up\s+to/i.test(bounce[0]),
                filters: parseFilters(bounce[0], { sourceCardName: context.sourceCardName })
            };
            context.targets.push(target);
            context.actions.push({ type: "bounceToHand", target: target.id });
        }

        const opponentRevealTrash = source.match(/opponent\s+reveals\s+their\s+hand.+?choose\s+(?:up\s+to\s+)?(\d+)\s+(.+?)\s+from\s+it\s+and\s+trash\s+it/i);
        if (opponentRevealTrash) {
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: "Opponent hand card to trash",
                controller: "opponent",
                zone: "hand",
                count: { min: /up\s+to/i.test(opponentRevealTrash[0]) ? 0 : 1, max: Number(opponentRevealTrash[1] || 1) },
                optional: /up\s+to/i.test(opponentRevealTrash[0]),
                filters: parseFilters(opponentRevealTrash[2], { sourceCardName: context.sourceCardName })
            };
            context.targets.push(target);
            context.actions.push({ type: "trashSelectedHand", target: target.id });
        }

        for (const match of source.matchAll(/\btrash\s+(\d+)\s+cards?\s+from\s+your\s+hand/ig)) {
            context.actions.push({
                type: "trashCardsFromHand",
                amount: Number(match[1] || 1),
                conditions: actionConditionsFromText(source, match.index || 0)
            });
        }

        const opponentTrashHand = source.match(/(?:your\s+)?opponent\s+(?:must\s+trash|trashes)\s+(\d+)\s+cards?\s+from\s+their\s+hand/i);
        if (opponentTrashHand) {
            context.actions.push({
                type: "opponentTrashCardsFromHand",
                amount: Number(opponentTrashHand[1] || 1),
                conditions: actionConditionsFromText(source, opponentTrashHand.index || 0)
            });
        }

        const opponentBottomHand = source.match(/opponent\s+places\s+(\d+)\s+cards?\s+from\s+their\s+hand\s+at\s+the\s+bottom\s+of\s+their\s+deck/i);
        if (opponentBottomHand) {
            context.actions.push({ type: "opponentPlaceHandBottomDeck", amount: Number(opponentBottomHand[1]) });
        }

        const bottomHand = source.match(/place\s+(\d+)\s+cards?\s+from\s+your\s+hand\s+at\s+the\s+bottom\s+of\s+your\s+deck/i);
        if (bottomHand) {
            context.actions.push({ type: "placeHandBottomDeck", amount: Number(bottomHand[1]) });
        }

        const topHand = source.match(/(?:add|place|put)\s+(\d+)\s+cards?\s+from\s+your\s+hand\s+(?:to|on|at)\s+the\s+top\s+of\s+your\s+deck/i);
        if (topHand) {
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: "Hand card for top deck",
                controller: "self",
                zone: "hand",
                count: { min: 1, max: Number(topHand[1] || 1) },
                optional: false,
                filters: []
            };
            context.targets.push(target);
            context.actions.push({ type: "placeHandTopDeckSelected", target: target.id });
        }

        const trashReturn = source.match(/add\s+(?:up\s+to\s+)?(\d+)\s+(.+?)\s+from\s+your\s+trash\s+to\s+your\s+hand/i) ||
            source.match(/return\s+(?:up\s+to\s+)?(\d+)\s+(.+?)\s+from\s+your\s+trash\s+to\s+your\s+hand/i);
        if (trashReturn) {
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: "Trash card to hand",
                controller: "self",
                zone: "trash",
                count: { min: 0, max: Number(trashReturn[1] || 1) },
                optional: true,
                filters: parseFilters(trashReturn[2], { sourceCardName: context.sourceCardName })
            };
            context.targets.push(target);
            context.actions.push({ type: "addFromTrashToHand", target: target.id });
        }
    }

    function parseSourceMovementActions(text, context) {
        const source = String(text || "");
        const trashBoard = source.match(/\btrash\s+(?:up\s+to\s+)?(\d+)?\s*(?:of\s+)?((?:your\s+opponent'?s|opponent'?s|your)\s+(?:characters?|stages?|cards?)(?:\s+with\s+[^,.]+)?)/i);
        if (trashBoard && !/from\s+your\s+hand/i.test(trashBoard[0])) {
            const targetPhrase = trashBoard[2];
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: readableSelectionLabel("Trash", targetPhrase),
                controller: /opponent/i.test(targetPhrase) ? "opponent" : "self",
                zone: /stage/i.test(targetPhrase) ? "stage" : /cards?/i.test(targetPhrase) && !/characters?/i.test(targetPhrase) ? "board" : "characters",
                count: { min: /up\s+to/i.test(trashBoard[0]) ? 0 : 1, max: Number(trashBoard[1] || 1) },
                optional: /up\s+to/i.test(trashBoard[0]),
                filters: parseFilters(trashBoard[0], { sourceCardName: context.sourceCardName })
            };
            context.targets.push(target);
            context.actions.push({
                type: "trashBoardCard",
                target: target.id,
                conditions: actionConditionsFromText(source, trashBoard.index || 0)
            });
        }

        if (/\btrash\s+this\s+(?:card|character|stage)\b/i.test(source)) {
            context.actions.push({ type: "trashThisCard" });
        }
    }

    function parseAliasActions(text, context) {
        const source = String(text || "");
        if (!/card\s+name\s+is\s+also/i.test(source)) return;
        const aliases = [...source.matchAll(/\[([^\]]+)\]/g)]
            .map(match => match[1].trim())
            .filter(Boolean);
        if (!aliases.length) return;
        context.actions.push({
            type: "addCardAliases",
            aliases,
            duration: DURATIONS.permanent
        });
    }

    function parseDonActions(text, context) {
        const source = String(text || "");
        const addDonAmount = Number(firstMatch(source, /add\s+up\s+to\s+(\d+)\s+don!!?\s+card/i) || firstMatch(source, /add\s+(\d+)\s+don!!?\s+card/i) || 0);

        if (addDonAmount) {
            context.actions.push({
                type: /set\s+it\s+as\s+active|set\s+.*\s+active/i.test(source) ? "addDon" : "addRestedDon",
                amount: addDonAmount
            });
        }

        if (/set\s+up\s+to\s+\d+\s+of\s+your\s+don!!?\s+cards?\s+as\s+active/i.test(source)) {
            context.actions.push({ type: "setDonActive", amount: numberFrom(source, /set\s+up\s+to\s+(\d+)\s+of\s+your\s+don/i) || 1 });
        }

        const attach = source.match(/(?:give|attach)\s+(?:this\s+character\s+)?(?:up\s+to\s+)?(\d+)\s+(?:of\s+your\s+)?rested\s+don!!?\s+cards?/i) ||
            source.match(/give\s+this\s+character\s+up\s+to\s+(\d+)\s+rested\s+don!!?\s+card/i) ||
            source.match(/give\s+(\d+)\s+of\s+your\s+rested\s+don!!?\s+cards?/i);
        if (attach) {
            const attachPhrase = source.slice(attach.index || 0);
            const target = /to\s+your\s+lea?der\b/i.test(attachPhrase) && !/\bor\s+(?:\d+\s+of\s+)?your\s+characters?/i.test(attachPhrase)
                ? "thisLeader"
                : selectionTargetFromPhrase(attachPhrase, context, "DON!! target", {
                defaultController: "self",
                defaultZone: /leader/i.test(attachPhrase) ? "leaderOrCharacters" : "characters",
                optional: /up\s+to|you\s+may/i.test(attachPhrase)
            }) || targetFromPhrase(source);
            context.actions.push({
                type: "attachRestedDon",
                target,
                amount: Number(attach[1]),
                optional: /up\s+to|you\s+may/i.test(attachPhrase),
                distribute: /any\s+way/i.test(source),
                conditions: actionConditionsFromText(source, attach.index || 0)
            });
        }
    }

    function parseCostModificationActions(text, context) {
        const source = String(text || "");
        const match = source.match(/give\s+up\s+to\s+(\d+)\s+of\s+your\s+opponent'?s\s+characters?\s+-(\d+)\s+cost/i);
        if (!match) return;

        const target = {
            id: `selection${context.targets.length + 1}`,
            label: "Cost reduction target",
            controller: "opponent",
            zone: "characters",
            count: { min: 0, max: Number(match[1]) },
            optional: true,
                filters: []
        };
        context.targets.push(target);
        context.actions.push({ type: "modifyCost", target: target.id, amount: -Number(match[2]), duration: DURATIONS.untilEndOfTurn });
    }

    function parseStatusActions(text, context) {
        const source = String(text || "");

        const restAndRefreshLock = source.match(/((?:up\s+to\s+)?\d*\s*(?:of\s+)?(?:your\s+opponent(?:'s|s)?|opponent(?:'s|s)?|your)?\s*characters?(?:\s+with\s+[^.]+?)?)\s+cannot\s+be\s+rested\s+or\s+become\s+active\s+until\s+the\s+end\s+of\s+your\s+opponent(?:'s|s)?\s+(?:next\s+)?turn/i);
        if (restAndRefreshLock) {
            const targetPhrase = restAndRefreshLock[1];
            const duration = durationFromText(restAndRefreshLock[0], DURATIONS.untilOpponentNextTurn);
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: "Rest and refresh lock target",
                controller: /opponent/i.test(targetPhrase) ? "opponent" : "self",
                zone: "characters",
                count: {
                    min: /up\s+to/i.test(targetPhrase) ? 0 : 1,
                    max: Number(firstMatch(targetPhrase, /(?:up\s+to|choose\s+up\s+to|choose)\s+(\d+)/i) || firstMatch(targetPhrase, /^(\d+)\s+of/i) || 1)
                },
                optional: /up\s+to/i.test(targetPhrase),
                filters: parseFilters(targetPhrase, { sourceCardName: context.sourceCardName })
            };
            context.targets.push(target);
            context.actions.push(
                { type: "addStatus", target: target.id, status: "cannotBeRested", duration },
                { type: "addStatus", target: target.id, status: "cannotBecomeActive", duration }
            );
        }

        if (/cannot\s+attack/i.test(source)) {
            const duration = durationFromText(source, DURATIONS.untilEndOfTurn);
            const target = selectionTargetFromPhrase(source, context, "Attack lock target", {
                defaultController: /opponent/i.test(source) ? "opponent" : "self",
                defaultZone: "characters",
                optional: /up\s+to/i.test(source),
                filters: parseFilters(source, { sourceCardName: context.sourceCardName })
            });
            context.actions.push({ type: "addStatus", target: target || "thisCard", status: /leader/i.test(source) ? "cannotAttackLeader" : "cannotAttack", duration });
        }

        if (/cannot\s+activate\s+\[\s*blocker\s*\]/i.test(source)) {
            const target = {
                id: `selection${context.targets.length + 1}`,
                label: "Blocker lock target",
                controller: "opponent",
                zone: "characters",
                count: { min: 0, max: 99 },
                optional: true,
                filters: [{ field: "keyword", operator: "includes", value: "Blocker" }]
            };
            context.targets.push(target);
            context.actions.push({ type: "addStatus", target: target.id, status: "cannotBlock", duration: DURATIONS.duringBattle });
        }

        if (/cannot\s+be\s+(?:k\.?\s*o\.?|ko)(?:'d|ed|d)?/i.test(source)) {
            const duration = durationFromText(source, context.event?.type === EVENTS.static ? DURATIONS.permanent : DURATIONS.untilEndOfTurn);
            const target = selectionTargetFromPhrase(source, context, "K.O. protection target", {
                defaultController: /opponent/i.test(source) ? "opponent" : "self",
                defaultZone: /leader/i.test(source) ? "leaderOrCharacters" : "characters",
                optional: /up\s+to/i.test(source),
                filters: parseFilters(source, { sourceCardName: context.sourceCardName })
            });
            context.actions.push({ type: "addStatus", target: target || targetFromPhrase(source), status: "cannotBeKOd", duration });
        }

        if (/cannot\s+block/i.test(source)) {
            const duration = durationFromText(source, DURATIONS.untilEndOfTurn);
            const target = selectionTargetFromPhrase(source, context, "Block lock target", {
                defaultController: /opponent/i.test(source) ? "opponent" : "self",
                defaultZone: "characters",
                optional: /up\s+to/i.test(source),
                filters: parseFilters(source, { sourceCardName: context.sourceCardName })
            });
            context.actions.push({ type: "addStatus", target: target || "thisCard", status: "cannotBlock", duration });
        }

        if (/cannot\s+become\s+active/i.test(source)) {
            const duration = durationFromText(source, DURATIONS.untilEndOfTurn);
            const target = selectionTargetFromPhrase(source, context, "Refresh lock target", {
                defaultController: /opponent/i.test(source) ? "opponent" : "self",
                defaultZone: "characters",
                optional: /up\s+to/i.test(source),
                filters: parseFilters(source)
            });
            context.actions.push({ type: "addStatus", target: target || "thisCard", status: "cannotBecomeActive", duration });
        }

        if (/cannot\s+be\s+rested/i.test(source) && !restAndRefreshLock) {
            const duration = durationFromText(source, DURATIONS.untilEndOfTurn);
            const target = selectionTargetFromPhrase(source, context, "Rest lock target", {
                defaultController: /opponent/i.test(source) ? "opponent" : "self",
                defaultZone: "characters",
                optional: /up\s+to/i.test(source),
                filters: parseFilters(source)
            });
            context.actions.push({ type: "addStatus", target: target || "thisCard", status: "cannotBeRested", duration });
        }
    }

    function parseKeywordActions(text, context) {
        const staticKeyword = firstMatch(text, /^\s*\[\s*(blocker|rush\s*:\s*characters?|characters?\s*:\s*rush|double attack|banish|unblockable)\s*\]\s*$/i) ||
            firstMatch(text, /^\s*this\s+(?:character|card)\s+gains?\s+(rush\s*:\s*characters?|characters?\s*:\s*rush|blocker|rush|double attack|banish|unblockable)\s*\.?\s*$/i);
        if (staticKeyword) {
            context.actions.push({
                type: "giveKeyword",
                target: "thisCard",
                keyword: titleKeyword(staticKeyword),
                duration: DURATIONS.permanent
            });
            return;
        }

        const keywordMatches = [];
        const seenKeywords = new Set();
        for (const match of String(text || "").matchAll(/\b(?:rush\s*:\s*characters?|characters?\s*:\s*rush|double attack|blocker|rush|banish|unblockable)\b/ig)) {
            const keyword = titleKeyword(match[0]);
            const key = keyword.toLowerCase();
            if (!keyword || seenKeywords.has(key)) continue;
            seenKeywords.add(key);
            keywordMatches.push({ keyword, index: match.index || 0 });
        }
        if (!keywordMatches.length) return;

        const selectionTarget = findReusableSelectionTarget(text, context) ||
            selectionTargetFromPhrase(text, context, "Keyword target");
        if (selectionTarget) {
            const target = context.targets.find(entry => entry.id === selectionTarget);
            if (target) target.filters = (target.filters || []).filter(filter => filter.field !== "keyword");
        }

        keywordMatches.forEach(match => context.actions.push({
            type: "giveKeyword",
            target: selectionTarget || targetFromPhrase(text),
            keyword: match.keyword,
            duration: context.event?.type === EVENTS.static
                ? DURATIONS.permanent
                : durationFromText(text, DURATIONS.untilEndOfTurn),
            conditions: actionConditionsFromText(text, match.index)
        }));
    }

    function durationFromText(text, fallback = DURATIONS.untilEndOfTurn) {
        const source = String(text || "");
        if (/until\s+the\s+end\s+of\s+your\s+opponent(?:'s|s)?\s+(?:next\s+)?turn/i.test(source)) {
            return DURATIONS.untilOpponentNextTurn;
        }
        if (/(?:(?:during|for)\s+(?:this|the)\s+battle|(?:this|the)\s+battle)/i.test(source)) {
            return DURATIONS.duringBattle;
        }
        if (/until\s+the\s+end\s+of\s+this\s+turn|during\s+this\s+turn|this\s+turn/i.test(source)) {
            return DURATIONS.untilEndOfTurn;
        }
        return fallback;
    }

    function parseFilters(text, options = {}) {
        const filters = [];
        const source = String(text || "");
        pushNumberFilters(filters, text, "power", /(\d+)\s+power\s+or\s+less/ig, "<=");
        pushNumberFilters(filters, text, "power", /(\d+)\s+power\s+or\s+more/ig, ">=");
        pushNumberFilters(filters, text, "cost", /cost\s+(?:of\s+)?(\d+)\s+or\s+less/ig, "<=");
        pushNumberFilters(filters, text, "cost", /cost\s+(?:of\s+)?(\d+)\s+or\s+more/ig, ">=");

        const orFilter = parseOrFilter(source, options);
        if (orFilter) {
            filters.push(orFilter);
            return filters;
        }

        const color = firstMatch(source, /\b(red|blue|green|purple|black|yellow)\s+(?:event|stage|character|card)\b/i);
        if (color) {
            filters.push({ field: "color", operator: "includes", value: color });
        }

        for (const match of source.matchAll(/\{([^}]+)\}\s+type/ig)) {
            filters.push({ field: "type", operator: "includes", value: match[1].trim() });
        }

        for (const match of source.matchAll(/\[([^\]]+)\]\s+type/ig)) {
            filters.push({ field: "type", operator: "includes", value: match[1].trim() });
        }

        if (/\bevent\s+card\b/i.test(text)) {
            filters.push({ field: "cardType", operator: "==", value: "event" });
        }

        if ((/\bcharacter\s+card\b|\bcharacters?\b/i.test(text)) && !/\bleader\s+or\s+(?:\d+\s+of\s+your\s+)?characters?\b/i.test(text)) {
            filters.push({ field: "cardType", operator: "==", value: "character" });
        }

        if (/\bstage\s+card\b|\bstage\b/i.test(text)) {
            filters.push({ field: "cardType", operator: "==", value: "stage" });
        }

        for (const match of source.matchAll(/\[([^\]]+)\](?!\s*type)/ig)) {
            const name = match[1].trim();
            if (isKeywordText(name)) continue;
            const before = source.slice(Math.max(0, match.index - 18), match.index);
            if (/other\s+than\s*$/i.test(before)) {
                filters.push({ field: "name", operator: "!=", value: name });
            } else {
                filters.push({ field: "name", operator: "includes", value: name });
            }
        }

        if (/other\s+than\s+this\s+card/i.test(source)) {
            filters.push({ field: "name", operator: "!=", value: options.sourceCardName || "__SOURCE_CARD__" });
        }

        const keyword = firstMatch(text, /\b(rush\s*:\s*characters?|characters?\s*:\s*rush|rush|blocker|banish|double attack|unblockable)\b/i);
        const grantsKeyword = /\b(?:gains?|gain|gets?|give)\b[\s\S]{0,120}\b(?:rush\s*:\s*characters?|characters?\s*:\s*rush|rush|blocker|banish|double attack|unblockable)\b/i.test(text);
        if (keyword && !grantsKeyword) filters.push({ field: "keyword", operator: "includes", value: keyword });

        return filters;
    }

    function parseOrFilter(source, options = {}) {
        const branches = [];
        const addBranch = branch => {
            const compact = branch.filter(Boolean);
            if (compact.length) branches.push(compact);
        };

        const namedOrType = source.match(/\[([^\]]+)\]\s+or\s+\{([^}]+)\}\s+type/i);
        if (namedOrType) {
            addBranch([{ field: "name", operator: "includes", value: namedOrType[1].trim() }]);
            addBranch([{ field: "type", operator: "includes", value: namedOrType[2].trim() }]);
        }

        const stageOrType = source.match(/\bstage(?:\s+card)?\s+or\s+\{([^}]+)\}\s+type/i) ||
            source.match(/\{([^}]+)\}\s+type\s+or\s+stage(?:\s+card)?/i);
        if (stageOrType) {
            addBranch([{ field: "cardType", operator: "==", value: "stage" }]);
            addBranch([{ field: "type", operator: "includes", value: stageOrType[1].trim() }]);
        }

        const redEventOrStage = source.match(/\b(red|blue|green|purple|black|yellow)\s+event(?:\s+card)?\s*,?\s+or\s+\1\s+stage/i);
        if (redEventOrStage) {
            addBranch([
                { field: "color", operator: "includes", value: redEventOrStage[1] },
                { field: "cardType", operator: "==", value: "event" }
            ]);
            addBranch([
                { field: "color", operator: "includes", value: redEventOrStage[1] },
                { field: "cardType", operator: "==", value: "stage" }
            ]);
        }

        const characterPowerOrStage = source.match(/characters?\s+with\s+(\d+)\s+power\s+or\s+less\s+or\s+a\s+stage\s+card/i);
        if (characterPowerOrStage) {
            addBranch([
                { field: "cardType", operator: "==", value: "character" },
                { field: "power", operator: "<=", value: Number(characterPowerOrStage[1]) }
            ]);
            addBranch([{ field: "cardType", operator: "==", value: "stage" }]);
        }

        if (branches.length < 2) return null;

        const exclusion = firstMatch(source, /other\s+than\s+\[([^\]]+)\]/i);
        if (exclusion) {
            branches.forEach(branch => branch.push({ field: "name", operator: "!=", value: exclusion }));
        } else if (/other\s+than\s+this\s+card/i.test(source)) {
            branches.forEach(branch => branch.push({ field: "name", operator: "!=", value: options.sourceCardName || "__SOURCE_CARD__" }));
        }

        return { field: "any", operator: "matches", branches };
    }

    function isKeywordText(value) {
        return /^(?:rush\s*:\s*characters?|characters?\s*:\s*rush|rush|blocker|banish|double attack|unblockable)$/i.test(String(value || "").trim());
    }

    function titleKeyword(keyword) {
        const value = String(keyword || "").trim().toLowerCase();
        if (!value) return "";
        if (/^rush\s*:\s*characters?$/.test(value) || /^characters?\s*:\s*rush$/.test(value)) return "Rush:Characters";
        if (value === "double attack") return "Double Attack";
        return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
    }

    function pushNumberFilters(filters, text, field, regex, operator) {
        for (const match of String(text || "").matchAll(regex)) {
            filters.push({ field, operator, value: Number(match[1]) });
        }
    }

    function targetFromPhrase(text) {
        const source = String(text || "").toLowerCase();
        if (/this\s+(?:lea?der|lader)|this\s+(?:lea?der|lader)\s+gains|give\s+this\s+(?:lea?der|lader)/.test(source)) return "thisLeader";
        if (/this\s+(?:card|character)/.test(source)) return "thisCard";
        if (/your\s+leader\s+or\s+(?:\d+\s+of\s+)?your\s+characters?/.test(source)) return "yourLeaderOrCharacters";
        if (/opponent.+leader\s+or\s+characters?|opponent.+characters?\s+or\s+leader/.test(source)) return "opponentLeaderOrCharacters";
        if (/opponent.+characters?/.test(source)) return "opponentCharacters";
        if (/opponent.+leader/.test(source)) return "opponentLeader";
        if (/leader\s+or\s+characters?|characters?\s+or\s+leader/.test(source)) return "yourLeaderOrCharacters";
        if (/your\s+characters?/.test(source)) return "yourCharacters";
        if (/your\s+leader|leader/.test(source)) return "thisLeader";
        return "thisCard";
    }

    function actionConditionsFromText(text, actionIndex = 0) {
        const source = String(text || "");
        const beforeAction = scopedConditionText(source, actionIndex);
        const conditions = [];

        const nameCondition = beforeAction.match(/if\s+you\s+have\s+(?:a\s+|an\s+)?(?:character\s+)?\[([^\]]+)\]\s+(?:in\s+play|on\s+your\s+field|on\s+your\s+character\s+field)?/i);
        if (nameCondition) {
            conditions.push({ type: "controlCardName", controller: "self", value: nameCondition[1].trim() });
        }

        const leaderNameIncludes = beforeAction.match(/if\s+your\s+lea?der'?s?\s+name\s+includes\s+(?:"([^"]+)"|\[([^\]]+)\])/i);
        if (leaderNameIncludes) {
            conditions.push({ type: "leaderNameIncludes", controller: "self", value: (leaderNameIncludes[1] || leaderNameIncludes[2] || "").trim() });
        }

        const leaderName = beforeAction.match(/if\s+your\s+lea?der\s+is\s+\[([^\]]+)\]/i);
        if (leaderName) {
            conditions.push({ type: "leaderNameEquals", controller: "self", value: leaderName[1].trim() });
        }

        const leaderColor = beforeAction.match(/if\s+your\s+lea?der\s+is\s+(red|blue|green|purple|black|yellow)\b/i);
        if (leaderColor) {
            conditions.push({ type: "leaderColorIs", controller: "self", value: leaderColor[1].trim() });
        }

        if (/if\s+you\s+have\s+a\s+stage\s+card(?:\s+in\s+play|\s+on\s+your\s+field)?/i.test(beforeAction)) {
            conditions.push({ type: "selfHasStage" });
        }

        const handLess = beforeAction.match(/if\s+you\s+have\s+(\d+)\s+or\s+less\s+cards?\s+in\s+your\s+hand/i);
        if (handLess) {
            conditions.push({ type: "selfHand", operator: "<=", value: Number(handLess[1]) });
        }

        const handMore = beforeAction.match(/if\s+you\s+have\s+(\d+)\s+or\s+more\s+cards?\s+in\s+your\s+hand/i);
        if (handMore) {
            conditions.push({ type: "selfHand", operator: ">=", value: Number(handMore[1]) });
        }

        pushDonFieldConditions(conditions, beforeAction);

        const selfPowerCharacter = beforeAction.match(/if\s+you\s+have\s+(?:a\s+|an\s+)?characters?\s+with\s+(\d+)(?:\s+power)?\s+or\s+(more|greater|higher|less|lower)/i) ||
            beforeAction.match(/if\s+you\s+have\s+(?:a\s+|an\s+)?characters?\s+with\s+(?:a\s+)?(?:base\s+)?power\s+of\s+(\d+)\s+or\s+(more|greater|higher|less|lower)/i);
        if (selfPowerCharacter) {
            const direction = String(selfPowerCharacter[2] || "").toLowerCase();
            conditions.push({
                type: "selfControlsCharacterPower",
                operator: /less|lower/.test(direction) ? "<=" : ">=",
                value: Number(selfPowerCharacter[1])
            });
        }

        const opponentLowPowerCharacter = beforeAction.match(/if\s+your\s+opponent\s+has\s+a\s+character\s+with\s+(\d+)(?:\s+power)?\s+or\s+less/i);
        if (opponentLowPowerCharacter) {
            conditions.push({ type: "opponentControlsCharacterPower", operator: "<=", value: Number(opponentLowPowerCharacter[1]) });
        }

        const leaderBelowBase = beforeAction.match(/if\s+your\s+lea?ders?\s+power\s+is\s+less\s+than\s+your\s+lea?ders?\s+base\s+power/i);
        if (leaderBelowBase) {
            conditions.push({ type: "leaderPowerBelowBase", controller: "self" });
        }

        return conditions;
    }

    function pushDonFieldConditions(conditions, sourceText) {
        const source = String(sourceText || "");
        const patterns = [
            { regex: /if\s+you\s+have\s+(\d+)\s+or\s+less\s+don!!?\s+cards?(?:\s+on\s+your\s+field)?(?!\s+attached)/ig, operator: "<=" },
            { regex: /if\s+you\s+have\s+(\d+)\s+or\s+more\s+don!!?\s+cards?(?:\s+on\s+your\s+field)?(?!\s+attached)/ig, operator: ">=" },
            { regex: /if\s+you\s+have\s+(?:exactly\s+)?(\d+)\s+don!!?\s+cards?(?:\s+on\s+your\s+field)?(?!\s+attached)/ig, operator: "==" }
        ];

        for (const { regex, operator } of patterns) {
            for (const match of source.matchAll(regex)) {
                const value = Number(match[1]);
                if (!Number.isFinite(value)) continue;
                const duplicate = conditions.some(condition =>
                    condition.type === "selfTotalDon" &&
                    condition.operator === operator &&
                    Number(condition.value ?? condition.amount) === value
                );
                if (!duplicate) {
                    conditions.push({ type: "selfTotalDon", operator, value });
                }
            }
        }
    }

    function scopedConditionText(source, actionIndex = 0) {
        const beforeAction = String(source || "").slice(0, Math.max(0, actionIndex));
        const lower = beforeAction.toLowerCase();
        const boundaries = [
            { index: beforeAction.lastIndexOf("."), type: "punctuation" },
            { index: beforeAction.lastIndexOf(";"), type: "punctuation" },
            { index: beforeAction.lastIndexOf(":"), type: "punctuation" }
        ];

        for (const match of lower.matchAll(/\bthen\b/g)) {
            boundaries.push({ index: match.index, type: "then" });
        }

        const latestBoundary = boundaries
            .filter(boundary => boundary.index >= 0)
            .sort((left, right) => right.index - left.index)[0] || { index: -1, type: "start" };
        const scopedText = beforeAction.slice(latestBoundary.index >= 0 ? latestBoundary.index : 0);

        return scopedText;
    }

    function selectionTargetFromPhrase(text, context, label, options = {}) {
        const source = String(text || "");
        const lower = source.toLowerCase();
        const hasSelectionLanguage = /up\s+to\s+\d+|choose\s+(?:up\s+to\s+)?\d+|all\s+of\s+your\s+characters|opponent'?s\s+characters|your\s+characters|your\s+\[[^\]]+\]\s+cards?'?s?|up\s+to\s+\d+\s+\[[^\]]+\]\s+characters?|leader\s+or\s+(?:\d+\s+of\s+your\s+)?characters|leader\s+or\s+\d+\s+of\s+your\s+characters|characters?\s+or\s+lea?ders?/i.test(source);

        if (!hasSelectionLanguage) return "";

        const countMatch = source.match(/(?:up\s+to|choose\s+up\s+to|choose)\s+(\d+)/i);
        const isAll = /all\s+of\s+your\s+characters/i.test(source);
        const target = {
            id: `selection${context.targets.length + 1}`,
            label: readableSelectionLabel(label, source),
            controller: options.defaultController || (/opponent/i.test(source) ? "opponent" : "self"),
            zone: options.defaultZone || (/leader\s+or\s+characters|leader\s+or\s+character|characters?\s+or\s+lea?ders?/i.test(lower)
                ? "leaderOrCharacters"
                : "characters"),
            count: {
                min: options.optional || /up\s+to/i.test(source) ? 0 : 1,
                max: isAll ? 99 : Number(countMatch?.[1] || 1)
            },
            optional: options.optional ?? /up\s+to|you\s+may/i.test(source),
            filters: Array.isArray(options.filters) ? options.filters : parseFilters(source, { sourceCardName: context.sourceCardName })
        };

        const basePower = firstMatch(source, /base\s+power\s+of\s+(\d+)/i);
        if (basePower) {
            target.filters.push({ field: "basePower", operator: "==", value: Number(basePower) });
        }

        const attachedDon = firstMatch(source, /with\s+(\d+)\s+or\s+more\s+don!!?\s+cards?\s+attached/i);
        if (attachedDon) {
            target.filters.push({ field: "attachedDon", operator: ">=", value: Number(attachedDon) });
        }

        context.targets.push(target);
        return target.id;
    }

    function findReusableSelectionTarget(text, context) {
        const source = String(text || "");
        if (!/\b(?:gains?|gain|gets?|give)\b/i.test(source)) return "";
        if (!Array.isArray(context.targets) || !context.targets.length) return "";

        const currentFilters = parseFilters(source, { sourceCardName: context.sourceCardName })
            .filter(filter => filter.field !== "keyword");
        const latest = [...context.targets].reverse().find(target => {
            const targetFilters = (target.filters || []).filter(filter => filter.field !== "keyword");
            if (!targetFilters.length && !currentFilters.length) return true;
            return filtersContainAll(targetFilters, currentFilters);
        });

        return latest?.id || "";
    }

    function filtersContainAll(targetFilters, requiredFilters) {
        return requiredFilters.every(required => targetFilters.some(filter => {
            return filter.field === required.field &&
                filter.operator === required.operator &&
                String(filter.value).toLowerCase() === String(required.value).toLowerCase();
        }));
    }

    function readableSelectionLabel(actionLabel, phrase) {
        const source = String(phrase || "");
        const prefix = String(actionLabel || "Choose").replace(/\s+target$/i, "");
        if (/opponent/i.test(source) && /leader/i.test(source) && /character/i.test(source)) return `${prefix}: Opponent Leader or Character`;
        if (/opponent/i.test(source) && /character/i.test(source)) return `${prefix}: Opponent Character`;
        if (/opponent/i.test(source) && /stage/i.test(source)) return `${prefix}: Opponent Stage`;
        if (/opponent/i.test(source) && /card/i.test(source)) return `${prefix}: Opponent Card`;
        if (/your|this/i.test(source) && /leader/i.test(source) && /character/i.test(source)) return `${prefix}: Your Leader or Character`;
        if (/leader/i.test(source)) return `${prefix}: Your Leader`;
        if (/stage/i.test(source)) return `${prefix}: Stage`;
        if (/character/i.test(source)) return `${prefix}: Character`;
        const named = firstMatch(source, /\[([^\]]+)\]/i);
        if (named) return `${prefix}: ${named}`;
        return `${prefix}: Chosen Card`;
    }

    function validateEffects(effects) {
        const results = (Array.isArray(effects) ? effects : []).map(validateEffect);
        return {
            valid: results.every(result => result.valid),
            errors: results.flatMap(result => result.errors),
            warnings: results.flatMap(result => result.warnings),
            results
        };
    }

    function validateEffect(rawEffect) {
        const effect = rawEffect?.system === "customEffectV2" ? rawEffect : normalizeEffect(rawEffect);
        const label = effect.generatedText || effect.sourceText || effect.id || "Effect";
        const errors = [];
        const warnings = [...(effect.warnings || [])];

        if (!effect.event?.type) errors.push("This effect needs an event/timing.");
        if (effect.event?.type && !Object.values(EVENTS).includes(effect.event.type)) {
            errors.push(`Unsupported event: ${effect.event.type}.`);
        }

        effect.costs.forEach(cost => {
            if (!cost.type || cost.type === "none") return;
            if (COSTS_REQUIRING_AMOUNT.has(cost.type) && !positiveNumber(cost.amount)) {
                errors.push("Cost amount must be a positive number.");
            }
        });

        if (!effect.actions.length && effect.automationStatus === STATUSES.automated) {
            errors.push("This effect needs at least one action.");
        }

        effect.actions.forEach(action => {
            if (!action.type) errors.push("This effect has an action with no action type.");
            if (ACTIONS_REQUIRING_TARGET.has(action.type) && !action.target) {
                errors.push("This effect needs a target.");
            }
            if (ACTIONS_REQUIRING_AMOUNT.has(action.type) && !numberValue(action.amount)) {
                errors.push(action.type === "modifyPower" || action.type === "setPower" ? "Power action needs an amount." : "Action amount must be a number.");
            }
            if (action.type === "modifyPower" && !action.duration) {
                errors.push("Power change needs a duration.");
            }
            if (action.type === "setPower" && !action.duration) {
                action.duration = DURATIONS.permanent;
            }
            if (action.type === "preventEvent" && effect.event?.type !== EVENTS.wouldBeKOd) {
                errors.push("This replacement effect needs an event to replace.");
            }
        });

        if (effect.event?.type === EVENTS.wouldBeKOd && !effect.actions.some(action => action.type === "preventEvent")) {
            warnings.push("This replacement event does not prevent anything yet.");
        }

        if (effect.automationStatus === STATUSES.unsupported && !warnings.length) {
            warnings.push("This effect is not automated yet. Save as display-only or edit it.");
        }

        return {
            valid: errors.length === 0,
            errors: errors.map(error => `${shortLabel(label)}: ${error}`),
            warnings: warnings.map(warning => `${shortLabel(label)}: ${warning}`)
        };
    }

    function parseAndValidate(text, options = {}) {
        const parsed = parseEffectText(text, options);
        const validation = validateEffects(parsed.effects);
        return {
            ...parsed,
            validation,
            valid: validation.valid
        };
    }

    function cleanGeneratedText(text) {
        return String(text || "")
            .replace(/\s+/g, " ")
            .replace(/\bk\.?oed\b/ig, "K.O.'d")
            .trim();
    }

    function shortLabel(text) {
        const value = String(text || "Effect").replace(/\s+/g, " ").trim();
        return value.length > 80 ? `${value.slice(0, 77)}...` : value;
    }

    function positiveNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0;
    }

    function numberValue(value) {
        const number = Number(value);
        return Number.isFinite(number);
    }

    function numberFrom(text, regex) {
        const match = String(text || "").match(regex);
        return match ? Number(match[1]) : 0;
    }

    function firstMatch(text, regex) {
        const match = String(text || "").match(regex);
        if (!match) return "";
        return String(match.slice(1).find(value => value !== undefined && value !== "") || "").trim();
    }

    function labelForEvent(type) {
        return EVENT_LABELS[type] || type || "Effect";
    }

    function labelForTarget(target) {
        if (!target) return "No target";
        if (typeof target === "string") return TARGET_LABELS[target] || target;
        return target.label || TARGET_LABELS[target.type] || target.id || "Chosen card";
    }

    function labelForSelectionTarget(target) {
        if (!target) return "Chosen card";

        const player = {
            self: "Your",
            opponent: "Opponent's",
            any: "Any"
        }[target.controller] || "Chosen";
        const zone = {
            leader: "Leader",
            characters: "Characters",
            leaderOrCharacters: "Leader or Characters",
            stage: "Stage",
            board: "Board Cards",
            hand: "Hand",
            trash: "Trash",
            deck: "Deck",
            life: "Life",
            don: "DON!!"
        }[target.zone] || target.zone || "Cards";
        const amount = target.count?.max
            ? `${target.optional ? "up to " : ""}${target.count.max} `
            : "";
        const filters = target.filters?.length
            ? ` (${target.filters.map(filterLabel).join(", ")})`
            : "";

        return `${target.label ? `${target.label}: ` : ""}${amount}${player} ${zone}${filters}`;
    }

    function filterLabel(filter = {}) {
        const fieldLabels = {
            name: "name",
            type: "type",
            cardType: "card type",
            power: "power",
            cost: "cost",
            basePower: "base power",
            keyword: "keyword"
        };
        const operatorLabels = {
            "==": "is",
            "!=": "is not",
            includes: "includes",
            "<=": "is at most",
            ">=": "is at least"
        };
        return `${fieldLabels[filter.field] || filter.field} ${operatorLabels[filter.operator] || filter.operator} ${filter.value}`;
    }

    global.CUSTOM_EFFECT_AI_CONFIG = CONFIG;
    global.CustomEffectV2 = {
        CONFIG,
        STATUSES,
        EVENTS,
        DURATIONS,
        EVENT_LABELS,
        TARGET_LABELS,
        createId,
        normalizeEffect,
        parseEffectText,
        parseSingleEffect,
        parseAndValidate,
        validateEffect,
        validateEffects,
        labelForEvent,
        labelForTarget,
        labelForSelectionTarget
    };
})(typeof window !== "undefined" ? window : globalThis);
