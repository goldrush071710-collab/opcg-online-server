// customEffectV2Ui.js
// Plain-language editable forms for customEffectV2 effects.

(function customEffectV2UiFactory(global) {
    const V2 = global.CustomEffectV2;

    if (!V2) {
        throw new Error("customEffectV2Ui.js must be loaded after customEffectV2.js.");
    }

    const STATUS_OPTIONS = [
        [V2.STATUSES.automated, "Automated"],
        [V2.STATUSES.needsReview, "Needs Review"],
        [V2.STATUSES.displayOnly, "Display Only"],
        [V2.STATUSES.unsupported, "Unsupported"]
    ];

    const EVENT_OPTIONS = [
        [V2.EVENTS.onPlay, "On Play"],
        [V2.EVENTS.whenAttacking, "When Attacking"],
        [V2.EVENTS.whenBlocking, "When Blocking"],
        [V2.EVENTS.onOpponentAttack, "On Your Opponent's Attack"],
        [V2.EVENTS.activateMain, "Activate: Main"],
        [V2.EVENTS.onKO, "On K.O."],
        [V2.EVENTS.trigger, "Trigger"],
        [V2.EVENTS.counter, "Counter"],
        [V2.EVENTS.endOfYourTurn, "End of Your Turn"],
        [V2.EVENTS.startOfYourTurn, "Start of Your Turn"],
        [V2.EVENTS.yourTurn, "Your Turn"],
        [V2.EVENTS.opponentTurn, "Opponent's Turn"],
        [V2.EVENTS.static, "Always On / Keyword"],
        [V2.EVENTS.opponentPlaysStage, "Opponent Plays a Stage"],
        [V2.EVENTS.wouldBeKOd, "Would Be K.O.'d"]
    ];

    const LIMIT_OPTIONS = [
        ["", "No limit"],
        ["oncePerTurn", "Once per turn"]
    ];

    const COST_OPTIONS = [
        ["trashCardsFromHand", "Trash cards from hand"],
        ["restDon", "Rest DON!!"],
        ["donMinus", "DON!! -"],
        ["restThisCard", "Rest this card"],
        ["trashThisCard", "Trash this card"],
        ["discardCards", "Discard cards"],
        ["returnDon", "Return DON!!"],
        ["trashLife", "Trash life"],
        ["trashTopDeck", "Trash top deck"],
        ["placeTrashBottomDeck", "Trash to bottom deck"],
        ["placeHandBottomDeck", "Hand to bottom deck"],
        ["addLifeToHand", "Life to hand"],
        ["returnThisCardToHand", "Return this card"]
    ];

    const ACTION_OPTIONS = [
        ["modifyPower", "Modify power"],
        ["setPower", "Set exact power"],
        ["preventEvent", "Prevent replaced event"],
        ["draw", "Draw cards"],
        ["ko", "K.O. card"],
        ["rest", "Rest card"],
        ["setActive", "Set card active"],
        ["giveKeyword", "Give keyword"],
        ["trashTopDeck", "Trash top deck"],
        ["setDonActive", "Set DON!! active"],
        ["addRestedDon", "Add rested DON!!"],
        ["addDon", "Add active DON!!"],
        ["attachRestedDon", "Attach rested DON!!"],
        ["searchTopDeck", "Search / look top deck"],
        ["chooseOne", "Choose one mode"],
        ["playThisCard", "Play this card"],
        ["addThisCardToHand", "Add this card to hand"],
        ["activateMainEffect", "Activate this card's Main"],
        ["playFromHand", "Play from hand"],
        ["playFromTrash", "Play from trash"],
        ["addFromTrashToHand", "Trash to hand"],
        ["trashSelectedHand", "Trash selected hand card"],
        ["trashCardsFromHand", "Trash cards from hand"],
        ["opponentTrashCardsFromHand", "Opponent trash hand"],
        ["opponentPlaceHandBottomDeck", "Opponent hand to bottom deck"],
        ["placeHandBottomDeck", "Hand to bottom deck"],
        ["placeHandTopDeckSelected", "Selected hand card to top deck"],
        ["modifyCost", "Modify cost"],
        ["addStatus", "Add restriction/status"],
        ["bounceToHand", "Return to hand"],
        ["placeBottomDeck", "Place on bottom deck"],
        ["placeTrashBottomDeckSelected", "Trash card to bottom deck"]
    ];

    const TARGET_OPTIONS = [
        ["", "No target"],
        ["thisLeader", "This Leader"],
        ["thisCard", "This Card"],
        ["yourLeader", "Your Leader"],
        ["opponentLeader", "Opponent Leader"],
        ["yourCharacters", "Your Characters"],
        ["opponentCharacters", "Opponent Characters"],
        ["yourLeaderOrCharacters", "Your Leader or Characters"],
        ["opponentLeaderOrCharacters", "Opponent Leader or Characters"],
        ["yourStage", "Your Stage"],
        ["opponentStage", "Opponent Stage"]
    ];

    const DURATION_OPTIONS = [
        ["", "No duration"],
        [V2.DURATIONS.untilEndOfTurn, "Until end of this turn"],
        [V2.DURATIONS.untilOpponentNextTurn, "Until opponent's next turn"],
        [V2.DURATIONS.duringBattle, "During this battle"],
        [V2.DURATIONS.permanent, "Permanent"]
    ];

    const KEYWORD_OPTIONS = [
        ["", "None"],
        ["Rush", "Rush"],
        ["Rush:Characters", "Rush:Character"],
        ["Blocker", "Blocker"],
        ["Banish", "Banish"],
        ["Double Attack", "Double Attack"],
        ["Unblockable", "Unblockable"]
    ];

    const CONTROLLER_OPTIONS = [
        ["self", "Your cards"],
        ["opponent", "Opponent's cards"],
        ["any", "Either player's cards"]
    ];

    const ZONE_OPTIONS = [
        ["characters", "Characters"],
        ["leader", "Leader"],
        ["leaderOrCharacters", "Leader or Characters"],
        ["stage", "Stage"],
        ["board", "Board cards"],
        ["hand", "Hand"],
        ["trash", "Trash"],
        ["deck", "Deck"],
        ["life", "Life"],
        ["don", "DON!!"]
    ];

    const SOURCE_TYPE_OPTIONS = [
        ["cardEffect", "Card effect"],
        ["battle", "Battle"],
        ["any", "Any cause"]
    ];

    const CONDITION_OPTIONS = [
        ["selfLife", "Your life"],
        ["opponentLife", "Opponent life"],
        ["selfTrash", "Your trash count"],
        ["selfHand", "Your hand count"],
        ["opponentHand", "Opponent hand count"],
        ["selfTotalDon", "Your total DON!!"],
        ["opponentActiveDon", "Opponent active DON!!"],
        ["opponentRestedCharacters", "Opponent rested Characters"],
        ["selfCharacters", "Your Character count"],
        ["leaderNameEquals", "Your Leader is exactly named"],
        ["leaderNameIncludes", "Your Leader name includes"],
        ["leaderTypeIncludes", "Your Leader type includes"],
        ["controlCardName", "You have named card in play"],
        ["selfControlsCharacterPower", "You have Character power"],
        ["opponentControlsCharacterPower", "Opponent has Character power"],
        ["sourceAttachedDonAtLeast", "This card has attached DON!!"],
        ["sourcePower", "This card power"],
        ["leaderPower", "Your Leader power"],
        ["leaderPowerBelowBase", "Your Leader power below base"],
        ["isYourTurn", "It is your turn"],
        ["isOpponentTurn", "It is opponent's turn"]
    ];

    const OPERATOR_OPTIONS = [
        [">=", "or more"],
        ["<=", "or less"],
        ["==", "equals"],
        [">", "greater than"],
        ["<", "less than"],
        ["includes", "includes"]
    ];

    const FILTER_FIELD_OPTIONS = [
        ["cost", "Cost"],
        ["power", "Power"],
        ["basePower", "Base power"],
        ["name", "Name"],
        ["type", "Type"],
        ["color", "Color"],
        ["keyword", "Keyword"],
        ["cardType", "Card type"],
        ["counter", "Counter"],
        ["attribute", "Attribute"],
        ["rarity", "Rarity"],
        ["rested", "Rested"],
        ["active", "Active"],
        ["notSelf", "Not this card"]
    ];

    const STATUS_OPTIONS_FOR_ACTIONS = [
        ["", "None"],
        ["cannotAttack", "Cannot attack"],
        ["cannotAttackLeader", "Cannot attack Leaders"],
        ["cannotBlock", "Cannot block"],
        ["cannotBecomeActive", "Cannot become active"],
        ["cannotBeRested", "Cannot be rested"]
    ];

    const DESTINATION_OPTIONS = [
        ["", "Default"],
        ["top", "Top of deck"],
        ["bottom", "Bottom of deck"],
        ["topOrBottom", "Choose top or bottom"],
        ["hand", "Hand"],
        ["characterField", "Character field"],
        ["trash", "Trash"],
        ["bottomDeck", "Bottom deck"]
    ];

    class CustomEffectV2Editor {
        constructor(options = {}) {
            this.root = resolveElement(options.root);
            this.rawTextInput = resolveElement(options.rawTextInput);
            this.convertButton = resolveElement(options.convertButton);
            this.addEffectButton = resolveElement(options.addEffectButton);
            this.jsonPreview = resolveElement(options.jsonPreview);
            this.applyJsonButton = resolveElement(options.applyJsonButton);
            this.warningList = resolveElement(options.warningList);
            this.statusNode = resolveElement(options.statusNode);
            this.cardNumberProvider = options.cardNumberProvider || (() => "CUSTOM");
            this.onChange = typeof options.onChange === "function" ? options.onChange : () => {};
            this.effects = [];

            if (!this.root) {
                throw new Error("CustomEffectV2Editor requires a root element.");
            }

            this.root.addEventListener("input", event => this.handleFieldChange(event));
            this.root.addEventListener("change", event => this.handleFieldChange(event));
            this.root.addEventListener("click", event => this.handleClick(event));
            this.convertButton?.addEventListener("click", () => this.convertTextToBlocks());
            this.addEffectButton?.addEventListener("click", () => this.addEffect());
            this.applyJsonButton?.addEventListener("click", () => this.applyJson());

            if (this.convertButton) {
                this.convertButton.textContent = "Convert Text To Effects";
            }

            if (this.addEffectButton) {
                this.addEffectButton.textContent = "Add Effect Manually";
            }

            this.render();
        }

        setEffects(effects = []) {
            this.effects = clone(effects).map(effect => V2.normalizeEffect(effect));
            this.render();
            this.emitChange();
        }

        clear() {
            this.effects = [];
            if (this.rawTextInput) this.rawTextInput.value = "";
            if (this.jsonPreview) this.jsonPreview.value = "";
            this.render();
            this.emitChange();
        }

        hasEffects() {
            return this.effects.length > 0;
        }

        getEffects() {
            return clone(this.effects).map(effect => V2.normalizeEffect(effect));
        }

        validate() {
            const validation = V2.validateEffects(this.effects);
            this.renderWarnings(validation);
            return validation;
        }

        convertTextToBlocks(options = {}) {
            const text = String(this.rawTextInput?.value || "").trim();

            if (!text) {
                if (!options.silent) this.setStatus("Add effect text first.");
                return false;
            }

            const result = V2.parseAndValidate(text, {
                cardNumber: this.getCardNumber()
            });

            this.effects = result.effects.map(effect => V2.normalizeEffect(effect));
            this.render(result.validation, result.warnings);

            if (!options.silent) {
                this.setStatus(result.valid ? "Text converted to editable effects." : "Converted with notes. Review the highlighted fields.");
            }

            this.emitChange();
            return result.valid;
        }

        prepareForSave() {
            if (!this.effects.length && String(this.rawTextInput?.value || "").trim()) {
                this.convertTextToBlocks({ silent: true });
            }

            this.effects = this.effects.map(effect => V2.normalizeEffect(effect));
            const validation = this.validate();

            return {
                effects: this.getEffects(),
                validation
            };
        }

        getCardNumber() {
            return String(this.cardNumberProvider() || "CUSTOM").trim() || "CUSTOM";
        }

        addEffect() {
            this.effects.push(V2.normalizeEffect({
                id: `${this.getCardNumber()}-effect-${this.effects.length + 1}`,
                sourceText: "",
                event: { type: V2.EVENTS.onPlay, source: "thisCard" },
                optional: false,
                automationStatus: V2.STATUSES.needsReview,
                costs: [],
                actions: [{ type: "draw", amount: 1 }],
                generatedText: "[On Play] Draw 1 card."
            }));
            this.render();
            this.emitChange();
        }

        addCost(effectIndex) {
            this.effects[effectIndex].costs.push({ type: "trashCardsFromHand", amount: 1 });
            this.render();
            this.emitChange();
        }

        addAction(effectIndex) {
            this.effects[effectIndex].actions.push({ type: "modifyPower", target: "thisLeader", amount: 1000, duration: V2.DURATIONS.untilEndOfTurn });
            this.render();
            this.emitChange();
        }

        addCondition(effectIndex) {
            this.effects[effectIndex].conditions.push({ type: "selfHand", operator: "<=", value: 3 });
            this.render();
            this.emitChange();
        }

        addActionCondition(effectIndex, actionIndex) {
            const action = this.effects[effectIndex].actions[actionIndex];
            if (!Array.isArray(action.conditions)) action.conditions = [];
            action.conditions.push({ type: "selfHand", operator: "<=", value: 3 });
            this.render();
            this.emitChange();
        }

        addTarget(effectIndex) {
            const effect = this.effects[effectIndex];
            effect.targets.push({
                id: `selection${effect.targets.length + 1}`,
                label: `Chosen card ${effect.targets.length + 1}`,
                controller: "self",
                zone: "characters",
                count: { min: 0, max: 1 },
                optional: true,
                filters: []
            });
            this.render();
            this.emitChange();
        }

        addFilter(effectIndex, targetIndex) {
            const target = this.effects[effectIndex].targets[targetIndex];
            if (!Array.isArray(target.filters)) target.filters = [];
            target.filters.push({ field: "cost", operator: "<=", value: 5 });
            this.render();
            this.emitChange();
        }

        handleClick(event) {
            const button = event.target.closest("[data-v2-command]");
            if (!button) return;

            const effectIndex = Number(button.dataset.effectIndex);
            const itemIndex = Number(button.dataset.itemIndex);
            const command = button.dataset.v2Command;

            if (command === "add-effect") this.addEffect();
            if (command === "remove-effect") this.effects.splice(effectIndex, 1);
            if (command === "duplicate-effect") this.effects.splice(effectIndex + 1, 0, {
                ...clone(this.effects[effectIndex]),
                id: `${this.getCardNumber()}-effect-${this.effects.length + 1}`
            });
            if (command === "add-cost") this.addCost(effectIndex);
            if (command === "remove-cost") this.effects[effectIndex].costs.splice(itemIndex, 1);
            if (command === "add-action") this.addAction(effectIndex);
            if (command === "remove-action") this.effects[effectIndex].actions.splice(itemIndex, 1);
            if (command === "add-condition") this.addCondition(effectIndex);
            if (command === "remove-condition") this.effects[effectIndex].conditions.splice(itemIndex, 1);
            if (command === "add-action-condition") this.addActionCondition(effectIndex, itemIndex);
            if (command === "remove-action-condition") {
                const conditionIndex = Number(button.dataset.conditionIndex);
                this.effects[effectIndex].actions[itemIndex].conditions.splice(conditionIndex, 1);
            }
            if (command === "add-target") this.addTarget(effectIndex);
            if (command === "remove-target") this.effects[effectIndex].targets.splice(itemIndex, 1);
            if (command === "add-filter") this.addFilter(effectIndex, itemIndex);
            if (command === "remove-filter") {
                const filterIndex = Number(button.dataset.filterIndex);
                this.effects[effectIndex].targets[itemIndex].filters.splice(filterIndex, 1);
            }
            if (command === "test-effect") {
                const validation = V2.validateEffect(this.effects[effectIndex]);
                this.renderWarnings({
                    valid: validation.valid,
                    errors: validation.errors,
                    warnings: validation.warnings
                });
                this.setStatus(validation.valid ? "This effect is valid." : "This effect still needs fixes.");
                return;
            }

            this.render();
            this.emitChange();
        }

        handleFieldChange(event) {
            const field = event.target.closest("[data-v2-field]");
            if (!field) return;

            const effectIndex = Number(field.dataset.effectIndex);
            const itemIndex = Number(field.dataset.itemIndex);
            const effect = this.effects[effectIndex];
            if (!effect) return;

            const value = readFieldValue(field);
            const scope = field.dataset.scope;
            const path = field.dataset.v2Field;

            if (scope === "effect") {
                setByPath(effect, path, value);
            }

            if (scope === "event-target") {
                if (!effect.event.target) effect.event.target = { controller: "self", zone: "characters" };
                setByPath(effect.event.target, path, value);
            }

            if (scope === "cost") {
                setByPath(effect.costs[itemIndex], path, value);
            }

            if (scope === "condition") {
                setByPath(effect.conditions[itemIndex], path, value);
            }

            if (scope === "target") {
                setByPath(effect.targets[itemIndex], path, value);
            }

            if (scope === "target-filter") {
                const filterIndex = Number(field.dataset.filterIndex);
                setByPath(effect.targets[itemIndex].filters[filterIndex], path, value);
            }

            if (scope === "action") {
                setByPath(effect.actions[itemIndex], path, value);
            }

            if (scope === "action-condition") {
                const conditionIndex = Number(field.dataset.conditionIndex);
                setByPath(effect.actions[itemIndex].conditions[conditionIndex], path, value);
            }

            this.effects[effectIndex] = V2.normalizeEffect(effect);
            this.syncJson();
            this.renderWarnings(this.validate());
            this.emitChange();
        }

        applyJson() {
            if (!this.jsonPreview) return;

            try {
                const parsed = JSON.parse(this.jsonPreview.value || "[]");
                this.effects = (Array.isArray(parsed) ? parsed : [parsed]).map(effect => V2.normalizeEffect(effect));
                this.render();
                this.setStatus("Debug JSON applied.");
                this.emitChange();
            } catch (error) {
                this.renderWarnings({
                    valid: false,
                    errors: [`JSON is invalid: ${error.message}`],
                    warnings: []
                });
            }
        }

        render(validation = null, parserWarnings = []) {
            this.root.innerHTML = this.effects.length
                ? this.effects.map((effect, index) => this.renderEffect(V2.normalizeEffect(effect), index)).join("")
                : `<div class="effect-block-empty">No automated effects yet. Type card text above and convert it.</div>`;

            this.syncJson();
            this.renderWarnings(validation || this.validate(), parserWarnings);
        }

        renderEffect(effect, effectIndex) {
            return `
                <article class="effect-block-card effect-v2-card" data-effect-index="${effectIndex}">
                    <header class="effect-block-head">
                        <div>
                            <span>Effect ${effectIndex + 1}</span>
                            ${selectMarkup({
                                label: "Automation",
                                options: STATUS_OPTIONS,
                                value: effect.automationStatus,
                                attrs: fieldAttrs(effectIndex, "effect", "automationStatus")
                            })}
                        </div>
                        <div class="effect-block-actions">
                            <button class="ghost" type="button" data-v2-command="test-effect" data-effect-index="${effectIndex}">Test This Effect</button>
                            <button class="ghost" type="button" data-v2-command="duplicate-effect" data-effect-index="${effectIndex}">Duplicate</button>
                            <button class="ghost danger" type="button" data-v2-command="remove-effect" data-effect-index="${effectIndex}">Delete Effect</button>
                        </div>
                    </header>

                    <div class="effect-block-row">
                        ${selectMarkup({
                            label: "Timing / Event",
                            options: EVENT_OPTIONS,
                            value: effect.event?.type,
                            attrs: fieldAttrs(effectIndex, "effect", "event.type")
                        })}
                        ${selectMarkup({
                            label: "Optional",
                            options: [["false", "Required"], ["true", "Player may choose"]],
                            value: String(Boolean(effect.optional)),
                            attrs: `${fieldAttrs(effectIndex, "effect", "optional")} data-value-type="boolean"`
                        })}
                        ${selectMarkup({
                            label: "Limit",
                            options: LIMIT_OPTIONS,
                            value: effect.limit?.type || "",
                            attrs: `${fieldAttrs(effectIndex, "effect", "limit.type")} data-empty-null="true"`
                        })}
                    </div>

                    ${effect.event?.type === V2.EVENTS.wouldBeKOd ? this.renderReplacementEvent(effect, effectIndex) : ""}
                    ${this.renderConditions(effect, effectIndex)}
                    ${this.renderTargets(effect, effectIndex)}

                    <label class="effect-text-field">
                        Original text
                        <textarea ${fieldAttrs(effectIndex, "effect", "sourceText")}>${escapeHtml(effect.sourceText || "")}</textarea>
                    </label>

                    <label class="effect-text-field">
                        Clean generated text
                        <textarea ${fieldAttrs(effectIndex, "effect", "generatedText")}>${escapeHtml(effect.generatedText || "")}</textarea>
                    </label>

                    ${this.renderCosts(effect, effectIndex)}
                    ${this.renderActions(effect, effectIndex)}
                </article>
            `;
        }

        renderReplacementEvent(effect, effectIndex) {
            const target = effect.event.target || { controller: "self", zone: "characters" };

            return `
                <section class="effect-block-section effect-v2-replacement">
                    <div class="effect-block-section-head">
                        <strong>Replacement Event</strong>
                        <span>What event is this effect trying to replace?</span>
                    </div>
                    <div class="effect-block-row">
                        ${selectMarkup({
                            label: "Affected cards",
                            options: CONTROLLER_OPTIONS,
                            value: target.controller || "self",
                            attrs: `${fieldAttrs(effectIndex, "event-target", "controller")}`
                        })}
                        ${selectMarkup({
                            label: "Card zone",
                            options: ZONE_OPTIONS,
                            value: target.zone || "characters",
                            attrs: `${fieldAttrs(effectIndex, "event-target", "zone")}`
                        })}
                        ${selectMarkup({
                            label: "Cause",
                            options: SOURCE_TYPE_OPTIONS,
                            value: effect.event.sourceType || "cardEffect",
                            attrs: `${fieldAttrs(effectIndex, "effect", "event.sourceType")}`
                        })}
                    </div>
                </section>
            `;
        }

        renderConditions(effect, effectIndex) {
            return `
                <section class="effect-block-section">
                    <div class="effect-block-section-head">
                        <strong>Global Conditions</strong>
                        <span>Must be true before the effect starts.</span>
                        <button class="ghost" type="button" data-v2-command="add-condition" data-effect-index="${effectIndex}">Add Condition</button>
                    </div>
                    ${effect.conditions?.length ? effect.conditions.map((condition, index) => this.renderConditionFields(effectIndex, "condition", condition, {
                        itemIndex: index,
                        removeCommand: "remove-condition"
                    })).join("") : `<p>No global condition.</p>`}
                </section>
            `;
        }

        renderTargets(effect, effectIndex) {
            return `
                <section class="effect-block-section">
                    <div class="effect-block-section-head">
                        <strong>Selectable Targets</strong>
                        <span>Cards the player will choose during this effect.</span>
                        <button class="ghost" type="button" data-v2-command="add-target" data-effect-index="${effectIndex}">Add Target</button>
                    </div>
                    ${effect.targets?.length ? effect.targets.map((target, index) => `
                        <div class="effect-target-editor">
                            <div class="effect-block-row">
                                ${textMarkup({
                                    label: "Readable label",
                                    value: target.label || target.id,
                                    attrs: `${fieldAttrs(effectIndex, "target", "label")} data-item-index="${index}"`
                                })}
                                ${selectMarkup({
                                    label: "Controller",
                                    options: CONTROLLER_OPTIONS,
                                    value: target.controller || "self",
                                    attrs: `${fieldAttrs(effectIndex, "target", "controller")} data-item-index="${index}"`
                                })}
                                ${selectMarkup({
                                    label: "Zone",
                                    options: ZONE_OPTIONS,
                                    value: target.zone || "characters",
                                    attrs: `${fieldAttrs(effectIndex, "target", "zone")} data-item-index="${index}"`
                                })}
                                ${numberMarkup({
                                    label: "Min",
                                    value: target.count?.min ?? 0,
                                    attrs: `${fieldAttrs(effectIndex, "target", "count.min")} data-value-type="number" data-item-index="${index}"`
                                })}
                                ${numberMarkup({
                                    label: "Max",
                                    value: target.count?.max ?? 1,
                                    attrs: `${fieldAttrs(effectIndex, "target", "count.max")} data-value-type="number" data-item-index="${index}"`
                                })}
                                ${selectMarkup({
                                    label: "Optional",
                                    options: [["false", "Required"], ["true", "Up to / may choose"]],
                                    value: String(Boolean(target.optional)),
                                    attrs: `${fieldAttrs(effectIndex, "target", "optional")} data-value-type="boolean" data-item-index="${index}"`
                                })}
                                <button class="ghost danger" type="button" data-v2-command="remove-target" data-effect-index="${effectIndex}" data-item-index="${index}">Remove Target</button>
                            </div>
                            <div class="effect-filter-list">
                                <div class="effect-block-section-head compact">
                                    <strong>Filters</strong>
                                    <button class="ghost" type="button" data-v2-command="add-filter" data-effect-index="${effectIndex}" data-item-index="${index}">Add Filter</button>
                                </div>
                                ${target.filters?.length ? target.filters.map((filter, filterIndex) => `
                                    <div class="effect-block-row">
                                        ${selectMarkup({
                                            label: "Field",
                                            options: FILTER_FIELD_OPTIONS,
                                            value: filter.field || "cost",
                                            attrs: `${fieldAttrs(effectIndex, "target-filter", "field")} data-item-index="${index}" data-filter-index="${filterIndex}"`
                                        })}
                                        ${selectMarkup({
                                            label: "Rule",
                                            options: OPERATOR_OPTIONS,
                                            value: filter.operator || "<=",
                                            attrs: `${fieldAttrs(effectIndex, "target-filter", "operator")} data-item-index="${index}" data-filter-index="${filterIndex}"`
                                        })}
                                        ${textMarkup({
                                            label: "Value",
                                            value: filter.value ?? "",
                                            attrs: `${fieldAttrs(effectIndex, "target-filter", "value")} data-item-index="${index}" data-filter-index="${filterIndex}"`
                                        })}
                                        <button class="ghost danger" type="button" data-v2-command="remove-filter" data-effect-index="${effectIndex}" data-item-index="${index}" data-filter-index="${filterIndex}">Remove Filter</button>
                                    </div>
                                `).join("") : `<p>No filters.</p>`}
                            </div>
                        </div>
                    `).join("") : `<p>No selectable targets. Direct targets like This Card or Your Leader can still be used in Actions.</p>`}
                </section>
            `;
        }

        renderConditionFields(effectIndex, scope, condition, options = {}) {
            const itemIndex = Number(options.itemIndex ?? 0);
            const actionIndex = Number(options.actionIndex ?? itemIndex);
            const conditionIndex = Number(options.conditionIndex ?? itemIndex);
            const dataAttrs = scope === "action-condition"
                ? `data-item-index="${actionIndex}" data-condition-index="${conditionIndex}"`
                : `data-item-index="${itemIndex}"`;
            const removeAttrs = scope === "action-condition"
                ? `data-item-index="${actionIndex}" data-condition-index="${conditionIndex}"`
                : `data-item-index="${itemIndex}"`;

            return `
                <div class="effect-block-row">
                    ${selectMarkup({
                        label: "Condition",
                        options: CONDITION_OPTIONS,
                        value: condition.type || "selfHand",
                        attrs: `${fieldAttrs(effectIndex, scope, "type")} ${dataAttrs}`
                    })}
                    ${selectMarkup({
                        label: "Controller",
                        options: CONTROLLER_OPTIONS,
                        value: condition.controller || "self",
                        attrs: `${fieldAttrs(effectIndex, scope, "controller")} ${dataAttrs}`
                    })}
                    ${selectMarkup({
                        label: "Rule",
                        options: OPERATOR_OPTIONS,
                        value: condition.operator || "<=",
                        attrs: `${fieldAttrs(effectIndex, scope, "operator")} ${dataAttrs}`
                    })}
                    ${textMarkup({
                        label: "Value / Name / Type",
                        value: condition.value ?? condition.amount ?? "",
                        attrs: `${fieldAttrs(effectIndex, scope, "value")} ${dataAttrs}`
                    })}
                    <button class="ghost danger" type="button" data-v2-command="${options.removeCommand}" data-effect-index="${effectIndex}" ${removeAttrs}>Remove Condition</button>
                </div>
            `;
        }

        renderCosts(effect, effectIndex) {
            return `
                <section class="effect-block-section">
                    <div class="effect-block-section-head">
                        <strong>Costs</strong>
                        <button class="ghost" type="button" data-v2-command="add-cost" data-effect-index="${effectIndex}">Add Cost</button>
                    </div>
                    ${effect.costs.length ? effect.costs.map((cost, index) => `
                        <div class="effect-block-row">
                            ${selectMarkup({
                                label: "Cost",
                                options: COST_OPTIONS,
                                value: cost.type,
                                attrs: `${fieldAttrs(effectIndex, "cost", "type")} data-item-index="${index}"`
                            })}
                            ${numberMarkup({
                                label: "Amount",
                                value: cost.amount ?? "",
                                attrs: `${fieldAttrs(effectIndex, "cost", "amount")} data-value-type="number" data-item-index="${index}"`,
                                disabled: ["restThisCard", "trashThisCard", "returnThisCardToHand"].includes(cost.type)
                            })}
                            <button class="ghost danger" type="button" data-v2-command="remove-cost" data-effect-index="${effectIndex}" data-item-index="${index}">Remove Cost</button>
                        </div>
                    `).join("") : `<p>No cost.</p>`}
                </section>
            `;
        }

        renderActions(effect, effectIndex) {
            return `
                <section class="effect-block-section">
                    <div class="effect-block-section-head">
                        <strong>Actions</strong>
                        <button class="ghost" type="button" data-v2-command="add-action" data-effect-index="${effectIndex}">Add Action</button>
                    </div>
                    ${effect.actions.length ? effect.actions.map((action, index) => `
                        <div class="effect-block-row">
                            ${selectMarkup({
                                label: "Action",
                                options: ACTION_OPTIONS,
                                value: action.type,
                                attrs: `${fieldAttrs(effectIndex, "action", "type")} data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Target",
                                options: targetOptionsForEffect(effect),
                                value: action.target || "",
                                attrs: `${fieldAttrs(effectIndex, "action", "target")} data-item-index="${index}"`
                            })}
                            ${numberMarkup({
                                label: "Amount",
                                value: action.amount ?? "",
                                attrs: `${fieldAttrs(effectIndex, "action", "amount")} data-value-type="number" data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Duration",
                                options: DURATION_OPTIONS,
                                value: action.duration || "",
                                attrs: `${fieldAttrs(effectIndex, "action", "duration")} data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Keyword",
                                options: KEYWORD_OPTIONS,
                                value: action.keyword || "",
                                attrs: `${fieldAttrs(effectIndex, "action", "keyword")} data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Status",
                                options: STATUS_OPTIONS_FOR_ACTIONS,
                                value: action.status || "",
                                attrs: `${fieldAttrs(effectIndex, "action", "status")} data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Destination",
                                options: DESTINATION_OPTIONS,
                                value: action.destination || action.selectedDestination || action.restDestination || "",
                                attrs: `${fieldAttrs(effectIndex, "action", "destination")} data-item-index="${index}"`
                            })}
                            ${numberMarkup({
                                label: "Max select",
                                value: action.maxSelect ?? "",
                                attrs: `${fieldAttrs(effectIndex, "action", "maxSelect")} data-value-type="number" data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Optional action",
                                options: [["false", "Required"], ["true", "May skip"]],
                                value: String(Boolean(action.optional)),
                                attrs: `${fieldAttrs(effectIndex, "action", "optional")} data-value-type="boolean" data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Split DON!!",
                                options: [["false", "Attach to one card"], ["true", "Any way you like"]],
                                value: String(Boolean(action.distribute)),
                                attrs: `${fieldAttrs(effectIndex, "action", "distribute")} data-value-type="boolean" data-item-index="${index}"`
                            })}
                            <button class="ghost danger" type="button" data-v2-command="remove-action" data-effect-index="${effectIndex}" data-item-index="${index}">Remove Action</button>
                            <div class="effect-action-condition-list">
                                <div class="effect-block-section-head compact">
                                    <strong>Only For This Action</strong>
                                    <button class="ghost" type="button" data-v2-command="add-action-condition" data-effect-index="${effectIndex}" data-item-index="${index}">Add Action Condition</button>
                                </div>
                                ${action.conditions?.length ? action.conditions.map((condition, conditionIndex) => this.renderConditionFields(effectIndex, "action-condition", condition, {
                                    actionIndex: index,
                                    conditionIndex,
                                    removeCommand: "remove-action-condition"
                                })).join("") : `<small class="effect-action-condition">No action-only condition.</small>`}
                            </div>
                        </div>
                    `).join("") : `<p>No action.</p>`}
                </section>
            `;
        }

        syncJson() {
            if (this.jsonPreview) {
                this.jsonPreview.value = JSON.stringify(this.effects, null, 2);
            }
        }

        renderWarnings(validation, parserWarnings = []) {
            if (!this.warningList) return;

            const errors = validation?.errors || [];
            const warnings = [...(parserWarnings || []), ...(validation?.warnings || [])];

            if (!errors.length && !warnings.length) {
                this.warningList.innerHTML = `<div class="effect-validation-ok">Effects valid.</div>`;
                return;
            }

            this.warningList.innerHTML = [
                ...errors.map(error => `<div class="effect-validation-error">${escapeHtml(error)}</div>`),
                ...warnings.map(warning => `<div class="effect-validation-warning">${escapeHtml(warning)}</div>`)
            ].join("");
        }

        setStatus(message) {
            if (this.statusNode) this.statusNode.textContent = message;
        }

        emitChange() {
            this.onChange(this.getEffects(), this.validate());
        }
    }

    function createEditor(options) {
        return new CustomEffectV2Editor(options);
    }

    function resolveElement(value) {
        if (!value) return null;
        return typeof value === "string" ? document.querySelector(value) : value;
    }

    function fieldAttrs(effectIndex, scope, path) {
        return `data-v2-field="${escapeAttr(path)}" data-scope="${escapeAttr(scope)}" data-effect-index="${effectIndex}"`;
    }

    function selectMarkup({ label = "", options = [], value = "", attrs = "" }) {
        return `
            <label>
                ${label ? `<span>${escapeHtml(label)}</span>` : ""}
                <select ${attrs}>
                    ${options.map(([optionValue, optionLabel]) => `
                        <option value="${escapeAttr(optionValue)}" ${String(value ?? "") === String(optionValue) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>
                    `).join("")}
                </select>
            </label>
        `;
    }

    function targetOptionsForEffect(effect) {
        const selectionOptions = (effect.targets || []).map(target => [
            target.id,
            V2.labelForSelectionTarget ? V2.labelForSelectionTarget(target) : (target.label || "Chosen card")
        ]);

        return [...TARGET_OPTIONS, ...selectionOptions];
    }

    function numberMarkup({ label, value, attrs = "", disabled = false }) {
        return `
            <label>
                <span>${escapeHtml(label)}</span>
                <input type="number" step="1" value="${escapeAttr(value)}" ${attrs} ${disabled ? "disabled" : ""}>
            </label>
        `;
    }

    function textMarkup({ label, value, attrs = "", disabled = false }) {
        return `
            <label>
                <span>${escapeHtml(label)}</span>
                <input type="text" value="${escapeAttr(value)}" ${attrs} ${disabled ? "disabled" : ""}>
            </label>
        `;
    }

    function readFieldValue(field) {
        if (field.dataset.valueType === "boolean") return field.value === "true";
        if (field.dataset.valueType === "number") return field.value === "" ? "" : Number(field.value);
        if (field.dataset.emptyNull === "true" && field.value === "") return null;
        return field.value;
    }

    function setByPath(target, path, value) {
        if (!target || !path) return;
        const parts = path.split(".");
        let current = target;

        parts.slice(0, -1).forEach(part => {
            if (value === null && part === "limit") return;
            if (!current[part] || typeof current[part] !== "object") current[part] = {};
            current = current[part];
        });

        if (value === null && path === "limit.type") {
            target.limit = null;
            return;
        }

        current[parts[parts.length - 1]] = value;
    }

    function clone(value) {
        if (typeof structuredClone === "function") return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function conditionLabel(condition = {}) {
        if (condition.type === "controlCardName") {
            return `you control ${escapeHtml(condition.value || "a named card")}`;
        }

        if (condition.type === "leaderNameEquals") {
            return `your Leader is exactly ${escapeHtml(condition.value || "a named Leader")}`;
        }

        if (condition.type === "leaderNameIncludes") {
            return `your Leader name includes ${escapeHtml(condition.value || "text")}`;
        }

        const controller = condition.controller === "opponent" ? "opponent" : "you";
        const value = condition.value ?? condition.amount ?? "";
        const operator = condition.operator ? ` ${condition.operator}` : "";

        return `${controller} ${escapeHtml(condition.field || condition.type || "condition")}${escapeHtml(operator)}${value !== "" ? ` ${escapeHtml(value)}` : ""}`;
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
    }

    global.CustomEffectV2Ui = {
        createEditor,
        CustomEffectV2Editor
    };
})(typeof window !== "undefined" ? window : globalThis);
