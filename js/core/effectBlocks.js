// effectBlocks.js
// Shared block-effect schema helpers. Loaded as a plain browser script.

(function effectBlocksFactory(global) {
    const TIMINGS = Object.freeze({
        onPlay: "onPlay",
        whenAttacking: "whenAttacking",
        activateMain: "activateMain",
        onKO: "onKO",
        trigger: "trigger",
        counter: "counter",
        endOfYourTurn: "endOfYourTurn",
        startOfYourTurn: "startOfYourTurn"
    });

    const COST_TYPES = Object.freeze({
        donMinus: "donMinus",
        restThisCard: "restThisCard",
        trashThisCard: "trashThisCard",
        trashCardsFromHand: "trashCardsFromHand",
        discardCards: "discardCards",
        returnDon: "returnDon",
        trashLife: "trashLife",
        restDon: "restDon"
    });

    const CONDITION_TYPES = Object.freeze({
        lifeComparison: "lifeComparison",
        donComparison: "donComparison",
        trashCountComparison: "trashCountComparison",
        leaderMatches: "leaderMatches",
        controlsCharacter: "controlsCharacter",
        sourceAttachedDonComparison: "sourceAttachedDonComparison"
    });

    const CONTROLLERS = Object.freeze({
        self: "self",
        opponent: "opponent",
        any: "any"
    });

    const TARGET_ZONES = Object.freeze({
        leader: "leader",
        opponentLeader: "opponentLeader",
        characters: "characters",
        leaderOrCharacters: "leaderOrCharacters",
        stage: "stage",
        hand: "hand",
        trash: "trash",
        deck: "deck",
        deckTop: "deckTop",
        board: "board",
        source: "source",
        don: "don",
        activeDon: "activeDon",
        restedDon: "restedDon",
        life: "life"
    });

    const FILTER_FIELDS = Object.freeze({
        cost: "cost",
        power: "power",
        name: "name",
        type: "type",
        color: "color",
        state: "state",
        cardType: "cardType",
        keyword: "keyword",
        counter: "counter",
        attribute: "attribute",
        rarity: "rarity"
    });

    const FILTER_OPERATORS = Object.freeze({
        lte: "<=",
        gte: ">=",
        eq: "==",
        includes: "includes"
    });

    const DURATIONS = Object.freeze({
        turn: "turn",
        battle: "battle",
        permanent: "permanent"
    });

    const ACTION_TYPES = Object.freeze({
        draw: "draw",
        ko: "ko",
        rest: "rest",
        setActive: "setActive",
        modifyPower: "modifyPower",
        giveKeyword: "giveKeyword",
        addRestedDon: "addRestedDon",
        setDonActive: "setDonActive",
        returnDon: "returnDon",
        playFromHand: "playFromHand",
        playFromTrash: "playFromTrash",
        trashTopDeck: "trashTopDeck",
        addTrashToBottomDeck: "addTrashToBottomDeck",
        searchTopDeck: "searchTopDeck",
        reveal: "reveal",
        addToHand: "addToHand",
        putRestBottomDeck: "putRestBottomDeck",
        putRestTrash: "putRestTrash",
        trashOpponentLife: "trashOpponentLife",
        healLife: "healLife",
        trashThisCard: "trashThisCard",
        bounceToHand: "bounceToHand",
        placeBottomDeck: "placeBottomDeck",
        attachRestedDon: "attachRestedDon",
        playSelected: "playSelected"
    });

    const ACTION_DEFINITIONS = Object.freeze({
        draw: { amount: true },
        ko: { target: true },
        rest: { target: true },
        setActive: { target: true },
        modifyPower: { target: true, amount: true, duration: true },
        giveKeyword: { target: true, keyword: true, duration: true },
        addRestedDon: { amount: true },
        setDonActive: { amount: true },
        returnDon: { amount: true },
        playFromHand: { target: true },
        playFromTrash: { target: true },
        trashTopDeck: { amount: true },
        addTrashToBottomDeck: { amount: true },
        searchTopDeck: { amount: true },
        reveal: { target: true },
        addToHand: { target: true },
        putRestBottomDeck: {},
        putRestTrash: {},
        trashOpponentLife: { amount: true },
        healLife: { amount: true },
        trashThisCard: {},
        bounceToHand: { target: true },
        placeBottomDeck: { target: true },
        attachRestedDon: { target: true, amount: true },
        playSelected: { target: true }
    });

    const TIMING_LABELS = Object.freeze({
        onPlay: "On Play",
        whenAttacking: "When Attacking",
        activateMain: "Activate: Main",
        onKO: "On K.O.",
        trigger: "Trigger",
        counter: "Counter",
        endOfYourTurn: "End of Your Turn",
        startOfYourTurn: "Start of Your Turn"
    });

    function createId(prefix = "effect") {
        if (global.crypto && typeof global.crypto.randomUUID === "function") {
            return `${prefix}-${global.crypto.randomUUID()}`;
        }

        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function createEffect(overrides = {}) {
        return {
            id: overrides.id || createId("effect"),
            timing: overrides.timing || { type: TIMINGS.onPlay },
            costs: Array.isArray(overrides.costs) ? overrides.costs : [],
            conditions: Array.isArray(overrides.conditions) ? overrides.conditions : [],
            targets: Array.isArray(overrides.targets) ? overrides.targets : [],
            actions: Array.isArray(overrides.actions) ? overrides.actions : [],
            limits: Array.isArray(overrides.limits) ? overrides.limits : [],
            text: overrides.text || "",
            warnings: Array.isArray(overrides.warnings) ? overrides.warnings : []
        };
    }

    function createTarget(overrides = {}) {
        return {
            id: overrides.id || createId("target"),
            controller: overrides.controller || CONTROLLERS.self,
            zone: overrides.zone || TARGET_ZONES.characters,
            count: {
                min: normalizeNumber(overrides.count?.min, 1),
                max: normalizeNumber(overrides.count?.max, 1)
            },
            filters: Array.isArray(overrides.filters) ? overrides.filters : [],
            optional: Boolean(overrides.optional)
        };
    }

    function getTimingLabel(timingType) {
        return TIMING_LABELS[timingType] || "Effect";
    }

    function actionRequiresTarget(actionType) {
        return Boolean(ACTION_DEFINITIONS[actionType]?.target);
    }

    function actionRequiresAmount(actionType) {
        return Boolean(ACTION_DEFINITIONS[actionType]?.amount);
    }

    function isKnownTiming(type) {
        return Object.values(TIMINGS).includes(type);
    }

    function isKnownCost(type) {
        return Object.values(COST_TYPES).includes(type);
    }

    function isKnownCondition(type) {
        return Object.values(CONDITION_TYPES).includes(type);
    }

    function isKnownController(controller) {
        return Object.values(CONTROLLERS).includes(controller);
    }

    function isKnownZone(zone) {
        return Object.values(TARGET_ZONES).includes(zone);
    }

    function isKnownAction(type) {
        return Object.values(ACTION_TYPES).includes(type);
    }

    function isKnownDuration(duration) {
        return Object.values(DURATIONS).includes(duration);
    }

    function normalizeEffect(effect) {
        return createEffect({
            ...effect,
            timing: effect?.timing || { type: effect?.type || TIMINGS.onPlay },
            costs: Array.isArray(effect?.costs) ? effect.costs : [],
            conditions: Array.isArray(effect?.conditions) ? effect.conditions : [],
            targets: Array.isArray(effect?.targets) ? effect.targets : [],
            actions: Array.isArray(effect?.actions) ? effect.actions : [],
            limits: Array.isArray(effect?.limits) ? effect.limits : [],
            warnings: Array.isArray(effect?.warnings) ? effect.warnings : []
        });
    }

    global.EffectBlocks = {
        version: "0.1.0",
        TIMINGS,
        COST_TYPES,
        CONDITION_TYPES,
        CONTROLLERS,
        TARGET_ZONES,
        FILTER_FIELDS,
        FILTER_OPERATORS,
        DURATIONS,
        ACTION_TYPES,
        ACTION_DEFINITIONS,
        TIMING_LABELS,
        createId,
        createEffect,
        createTarget,
        getTimingLabel,
        normalizeEffect,
        actionRequiresTarget,
        actionRequiresAmount,
        isKnownTiming,
        isKnownCost,
        isKnownCondition,
        isKnownController,
        isKnownZone,
        isKnownAction,
        isKnownDuration
    };
})(typeof window !== "undefined" ? window : globalThis);
