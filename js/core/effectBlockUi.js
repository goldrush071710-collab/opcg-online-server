// effectBlockUi.js
// Dropdown-first editor for reusable block effects.

(function effectBlockUiFactory(global) {
    const Blocks = global.EffectBlocks;
    const Parser = global.EffectBlockParser;
    const Validator = global.EffectBlockValidator;

    if (!Blocks || !Parser || !Validator) {
        throw new Error("effectBlockUi.js must be loaded after effect block schema, parser, and validator.");
    }

    const KEYWORD_OPTIONS = [
        ["", "None"],
        ["Rush", "Rush"],
        ["Blocker", "Blocker"],
        ["Banish", "Banish"],
        ["Double Attack", "Double Attack"],
        ["Unblockable", "Unblockable"]
    ];

    const TIMING_OPTIONS = Object.entries(Blocks.TIMING_LABELS).map(([value, label]) => [value, label]);

    const COST_OPTIONS = [
        [Blocks.COST_TYPES.donMinus, "DON!! -"],
        [Blocks.COST_TYPES.restDon, "Rest DON!!"],
        [Blocks.COST_TYPES.restThisCard, "Rest this card"],
        [Blocks.COST_TYPES.trashThisCard, "Trash this card"],
        [Blocks.COST_TYPES.trashCardsFromHand, "Trash cards from hand"],
        [Blocks.COST_TYPES.discardCards, "Discard cards"],
        [Blocks.COST_TYPES.returnDon, "Return DON!!"],
        [Blocks.COST_TYPES.trashLife, "Trash life"]
    ];

    const CONDITION_OPTIONS = [
        [Blocks.CONDITION_TYPES.lifeComparison, "Life check"],
        [Blocks.CONDITION_TYPES.donComparison, "DON!! check"],
        [Blocks.CONDITION_TYPES.trashCountComparison, "Trash count check"],
        [Blocks.CONDITION_TYPES.leaderMatches, "Leader matches"],
        [Blocks.CONDITION_TYPES.controlsCharacter, "Control character"],
        [Blocks.CONDITION_TYPES.sourceAttachedDonComparison, "Source attached DON!!"]
    ];

    const CONTROLLER_OPTIONS = [
        [Blocks.CONTROLLERS.self, "You"],
        [Blocks.CONTROLLERS.opponent, "Opponent"],
        [Blocks.CONTROLLERS.any, "Either player"]
    ];

    const ZONE_OPTIONS = [
        [Blocks.TARGET_ZONES.leader, "Leader"],
        [Blocks.TARGET_ZONES.opponentLeader, "Opponent leader"],
        [Blocks.TARGET_ZONES.characters, "Characters"],
        [Blocks.TARGET_ZONES.leaderOrCharacters, "Leader or Characters"],
        [Blocks.TARGET_ZONES.stage, "Stage"],
        [Blocks.TARGET_ZONES.hand, "Hand"],
        [Blocks.TARGET_ZONES.trash, "Trash"],
        [Blocks.TARGET_ZONES.deck, "Deck"],
        [Blocks.TARGET_ZONES.deckTop, "Top deck"],
        [Blocks.TARGET_ZONES.board, "Board"],
        [Blocks.TARGET_ZONES.source, "This card"],
        [Blocks.TARGET_ZONES.don, "DON!!"],
        [Blocks.TARGET_ZONES.activeDon, "Active DON!!"],
        [Blocks.TARGET_ZONES.restedDon, "Rested DON!!"],
        [Blocks.TARGET_ZONES.life, "Life"]
    ];

    const FILTER_FIELD_OPTIONS = [
        [Blocks.FILTER_FIELDS.cost, "Cost"],
        [Blocks.FILTER_FIELDS.power, "Power"],
        [Blocks.FILTER_FIELDS.name, "Name"],
        [Blocks.FILTER_FIELDS.type, "Type"],
        [Blocks.FILTER_FIELDS.color, "Color"],
        [Blocks.FILTER_FIELDS.state, "Rested / Active"],
        [Blocks.FILTER_FIELDS.cardType, "Card type"],
        [Blocks.FILTER_FIELDS.keyword, "Keyword"],
        [Blocks.FILTER_FIELDS.counter, "Counter"],
        [Blocks.FILTER_FIELDS.attribute, "Attribute"],
        [Blocks.FILTER_FIELDS.rarity, "Rarity"]
    ];

    const OPERATOR_OPTIONS = [
        [Blocks.FILTER_OPERATORS.lte, "or less"],
        [Blocks.FILTER_OPERATORS.gte, "or more"],
        [Blocks.FILTER_OPERATORS.eq, "equals"],
        [Blocks.FILTER_OPERATORS.includes, "includes"]
    ];

    const ACTION_OPTIONS = [
        [Blocks.ACTION_TYPES.draw, "Draw cards"],
        [Blocks.ACTION_TYPES.ko, "K.O. target"],
        [Blocks.ACTION_TYPES.rest, "Rest target"],
        [Blocks.ACTION_TYPES.setActive, "Set target active"],
        [Blocks.ACTION_TYPES.modifyPower, "Modify power"],
        [Blocks.ACTION_TYPES.giveKeyword, "Give keyword"],
        [Blocks.ACTION_TYPES.addRestedDon, "Add rested DON!!"],
        [Blocks.ACTION_TYPES.setDonActive, "Set DON!! active"],
        [Blocks.ACTION_TYPES.returnDon, "Return DON!!"],
        [Blocks.ACTION_TYPES.playFromHand, "Play from hand"],
        [Blocks.ACTION_TYPES.playFromTrash, "Play from trash"],
        [Blocks.ACTION_TYPES.trashTopDeck, "Trash top deck"],
        [Blocks.ACTION_TYPES.addTrashToBottomDeck, "Trash to bottom deck"],
        [Blocks.ACTION_TYPES.searchTopDeck, "Search top deck"],
        [Blocks.ACTION_TYPES.reveal, "Reveal target"],
        [Blocks.ACTION_TYPES.addToHand, "Add target to hand"],
        [Blocks.ACTION_TYPES.putRestBottomDeck, "Put rest bottom deck"],
        [Blocks.ACTION_TYPES.putRestTrash, "Put rest in trash"],
        [Blocks.ACTION_TYPES.trashOpponentLife, "Trash opponent life"],
        [Blocks.ACTION_TYPES.healLife, "Add life"],
        [Blocks.ACTION_TYPES.trashThisCard, "Trash this card"],
        [Blocks.ACTION_TYPES.bounceToHand, "Return target to hand"],
        [Blocks.ACTION_TYPES.placeBottomDeck, "Place target bottom deck"],
        [Blocks.ACTION_TYPES.attachRestedDon, "Attach rested DON!!"],
        [Blocks.ACTION_TYPES.playSelected, "Play selected target"]
    ];

    const DURATION_OPTIONS = [
        [Blocks.DURATIONS.turn, "This turn"],
        [Blocks.DURATIONS.battle, "This battle"],
        [Blocks.DURATIONS.permanent, "Permanent"]
    ];

    const CARD_TYPE_OPTIONS = [
        ["", "Any"],
        ["leader", "Leader"],
        ["character", "Character"],
        ["event", "Event"],
        ["stage", "Stage"]
    ];

    const LIMIT_OPTIONS = [
        ["oncePerTurn", "Once per turn"]
    ];

    class EffectBlockEditor {
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
                throw new Error("EffectBlockEditor requires a root element.");
            }

            this.root.addEventListener("input", event => this.handleFieldChange(event));
            this.root.addEventListener("change", event => this.handleFieldChange(event));
            this.root.addEventListener("click", event => this.handleClick(event));
            this.convertButton?.addEventListener("click", () => this.convertTextToBlocks());
            this.addEffectButton?.addEventListener("click", () => this.addEffect());
            this.applyJsonButton?.addEventListener("click", () => this.applyJson());

            this.render();
        }

        setEffects(effects = []) {
            this.effects = clone(effects).map(effect => Blocks.normalizeEffect(effect));
            this.repairEffects();
            this.render();
        }

        clear() {
            this.effects = [];
            if (this.rawTextInput) this.rawTextInput.value = "";
            if (this.jsonPreview) this.jsonPreview.value = "";
            this.render();
        }

        hasEffects() {
            return this.effects.length > 0;
        }

        getEffects() {
            this.repairEffects();
            return clone(this.effects);
        }

        validate() {
            this.repairEffects();
            const validation = Validator.validateEffects(this.effects);
            this.renderWarnings(validation);
            return validation;
        }

        convertTextToBlocks(options = {}) {
            const text = String(this.rawTextInput?.value || "").trim();
            if (!text) {
                if (!options.silent) this.setStatus("Add effect text first.");
                return false;
            }

            const result = Validator.parseAndValidate(text, {
                cardNumber: this.getCardNumber()
            });

            this.effects = result.effects.map(effect => Blocks.normalizeEffect(effect));
            this.repairEffects();
            this.render(result.validation, result.warnings);

            if (!options.silent) {
                this.setStatus(result.valid ? "Text converted to blocks." : "Converted with validation warnings.");
            }

            this.emitChange();
            return result.valid;
        }

        prepareForSave() {
            if (!this.effects.length && String(this.rawTextInput?.value || "").trim()) {
                this.convertTextToBlocks({ silent: true });
            }

            const validation = this.validate();
            return {
                effects: this.getEffects(),
                validation
            };
        }

        getCardNumber() {
            const value = this.cardNumberProvider();
            return String(value || "CUSTOM").trim() || "CUSTOM";
        }

        addEffect() {
            this.effects.push(Blocks.createEffect({
                id: `${this.getCardNumber()}-block-${this.effects.length + 1}`,
                timing: { type: Blocks.TIMINGS.onPlay },
                targets: [],
                actions: [
                    { type: Blocks.ACTION_TYPES.draw, amount: 1 }
                ],
                text: "[On Play] Draw 1 card."
            }));
            this.render();
            this.emitChange();
        }

        addCost(effectIndex) {
            this.effects[effectIndex].costs.push({
                type: Blocks.COST_TYPES.restDon,
                amount: 1
            });
            this.render();
            this.emitChange();
        }

        addCondition(effectIndex) {
            this.effects[effectIndex].conditions.push({
                type: Blocks.CONDITION_TYPES.lifeComparison,
                controller: Blocks.CONTROLLERS.self,
                operator: Blocks.FILTER_OPERATORS.lte,
                value: 2
            });
            this.render();
            this.emitChange();
        }

        addTarget(effectIndex) {
            this.effects[effectIndex].targets.push(Blocks.createTarget({
                id: `target${this.effects[effectIndex].targets.length + 1}`,
                controller: Blocks.CONTROLLERS.opponent,
                zone: Blocks.TARGET_ZONES.characters,
                count: { min: 0, max: 1 },
                optional: true
            }));
            this.render();
            this.emitChange();
        }

        addFilter(effectIndex, targetIndex) {
            this.effects[effectIndex].targets[targetIndex].filters.push({
                field: Blocks.FILTER_FIELDS.cost,
                operator: Blocks.FILTER_OPERATORS.lte,
                value: 5
            });
            this.render();
            this.emitChange();
        }

        addAction(effectIndex) {
            const effect = this.effects[effectIndex];
            const firstTarget = effect.targets[0]?.id || "";
            effect.actions.push({
                type: Blocks.ACTION_TYPES.draw,
                amount: 1,
                target: firstTarget
            });
            this.render();
            this.emitChange();
        }

        addLimit(effectIndex) {
            const effect = this.effects[effectIndex];
            if (!effect.limits.some(limit => limit.type === "oncePerTurn")) {
                effect.limits.push({ type: "oncePerTurn" });
            }
            this.render();
            this.emitChange();
        }

        handleClick(event) {
            const button = event.target.closest("[data-block-command]");
            if (!button) return;

            const effectIndex = Number(button.dataset.effectIndex);
            const targetIndex = Number(button.dataset.targetIndex);
            const itemIndex = Number(button.dataset.itemIndex);
            const command = button.dataset.blockCommand;

            if (command === "add-effect") this.addEffect();
            if (command === "remove-effect") this.effects.splice(effectIndex, 1);
            if (command === "duplicate-effect") this.effects.splice(effectIndex + 1, 0, {
                ...clone(this.effects[effectIndex]),
                id: `${this.getCardNumber()}-block-${this.effects.length + 1}`
            });
            if (command === "add-cost") this.addCost(effectIndex);
            if (command === "remove-cost") this.effects[effectIndex].costs.splice(itemIndex, 1);
            if (command === "add-condition") this.addCondition(effectIndex);
            if (command === "remove-condition") this.effects[effectIndex].conditions.splice(itemIndex, 1);
            if (command === "add-target") this.addTarget(effectIndex);
            if (command === "remove-target") this.effects[effectIndex].targets.splice(targetIndex, 1);
            if (command === "add-filter") this.addFilter(effectIndex, targetIndex);
            if (command === "remove-filter") this.effects[effectIndex].targets[targetIndex].filters.splice(itemIndex, 1);
            if (command === "add-action") this.addAction(effectIndex);
            if (command === "remove-action") this.effects[effectIndex].actions.splice(itemIndex, 1);
            if (command === "add-limit") this.addLimit(effectIndex);
            if (command === "remove-limit") this.effects[effectIndex].limits.splice(itemIndex, 1);

            this.render();
            this.emitChange();
        }

        handleFieldChange(event) {
            const field = event.target.closest("[data-block-field]");
            if (!field) return;

            const effectIndex = Number(field.dataset.effectIndex);
            const effect = this.effects[effectIndex];
            if (!effect) return;

            const value = readFieldValue(field);
            const scope = field.dataset.scope;
            const path = field.dataset.blockField;

            if (scope === "effect") {
                setByPath(effect, path, value);
            }

            if (scope === "cost") {
                setByPath(effect.costs[Number(field.dataset.itemIndex)], path, value);
                this.repairCost(effect.costs[Number(field.dataset.itemIndex)]);
            }

            if (scope === "condition") {
                setByPath(effect.conditions[Number(field.dataset.itemIndex)], path, value);
            }

            if (scope === "target") {
                setByPath(effect.targets[Number(field.dataset.targetIndex)], path, value);
            }

            if (scope === "filter") {
                setByPath(
                    effect.targets[Number(field.dataset.targetIndex)].filters[Number(field.dataset.itemIndex)],
                    path,
                    value
                );
            }

            if (scope === "action") {
                const action = effect.actions[Number(field.dataset.itemIndex)];
                setByPath(action, path, value);
                this.repairAction(action, effect);
            }

            if (scope === "limit") {
                setByPath(effect.limits[Number(field.dataset.itemIndex)], path, value);
            }

            this.repairEffects();
            this.syncJson();
            this.renderWarnings(this.validate());
            this.emitChange();
        }

        applyJson() {
            if (!this.jsonPreview) return;

            try {
                const parsed = JSON.parse(this.jsonPreview.value || "[]");
                const effects = Array.isArray(parsed) ? parsed : [parsed];
                this.effects = effects.map(effect => Blocks.normalizeEffect(effect));
                this.repairEffects();
                this.render();
                this.setStatus("JSON applied.");
                this.emitChange();
            } catch (error) {
                this.renderWarnings({
                    valid: false,
                    errors: [`JSON is invalid: ${error.message}`],
                    warnings: []
                });
            }
        }

        repairEffects() {
            this.effects = this.effects.map(effect => {
                const normalized = Blocks.normalizeEffect(effect);
                normalized.targets = normalized.targets.map((target, index) => Blocks.createTarget({
                    ...target,
                    id: target.id || `target${index + 1}`
                }));
                normalized.costs.forEach(cost => this.repairCost(cost));
                normalized.actions.forEach(action => this.repairAction(action, normalized));
                return normalized;
            });
        }

        repairCost(cost) {
            if (!cost) return;
            if (cost.type !== Blocks.COST_TYPES.restThisCard && cost.type !== Blocks.COST_TYPES.trashThisCard) {
                cost.amount = cost.amount === "" || cost.amount === undefined ? 1 : Number(cost.amount);
            }
        }

        repairAction(action, effect) {
            if (!action) return;
            if (Blocks.actionRequiresAmount(action.type) && (action.amount === "" || action.amount === undefined)) {
                action.amount = 1;
            }
            if (Blocks.actionRequiresTarget(action.type) && !action.target) {
                action.target = effect.targets[0]?.id || "";
            }
            if (action.type === Blocks.ACTION_TYPES.modifyPower && !action.duration) {
                action.duration = Blocks.DURATIONS.turn;
            }
            if (action.type === Blocks.ACTION_TYPES.giveKeyword) {
                if (!action.duration) action.duration = Blocks.DURATIONS.turn;
                if (!action.keyword) action.keyword = "Rush";
            }
        }

        render(validation = null, parserWarnings = []) {
            this.repairEffects();

            this.root.innerHTML = this.effects.length
                ? this.effects.map((effect, index) => this.renderEffect(effect, index)).join("")
                : `<div class="effect-block-empty">No blocks yet. Convert text or add a blank effect.</div>`;

            this.syncJson();
            this.renderWarnings(validation || this.validate(), parserWarnings);
        }

        renderEffect(effect, effectIndex) {
            return `
                <article class="effect-block-card" data-effect-index="${effectIndex}">
                    <header class="effect-block-head">
                        <div>
                            <span>Effect ${effectIndex + 1}</span>
                            ${selectMarkup({
                                options: TIMING_OPTIONS,
                                value: effect.timing?.type,
                                attrs: fieldAttrs(effectIndex, "effect", "timing.type")
                            })}
                        </div>
                        <div class="effect-block-actions">
                            <button class="ghost" type="button" data-block-command="duplicate-effect" data-effect-index="${effectIndex}">Duplicate</button>
                            <button class="ghost danger" type="button" data-block-command="remove-effect" data-effect-index="${effectIndex}">Remove</button>
                        </div>
                    </header>

                    <label class="effect-text-field">
                        Printed Effect Text
                        <textarea ${fieldAttrs(effectIndex, "effect", "text")}>${escapeHtml(effect.text || "")}</textarea>
                    </label>

                    ${this.renderLimits(effect, effectIndex)}
                    ${this.renderCosts(effect, effectIndex)}
                    ${this.renderConditions(effect, effectIndex)}
                    ${this.renderTargets(effect, effectIndex)}
                    ${this.renderActions(effect, effectIndex)}
                </article>
            `;
        }

        renderLimits(effect, effectIndex) {
            return `
                <section class="effect-block-section">
                    <div class="effect-block-section-head">
                        <strong>Limits</strong>
                        <button class="ghost" type="button" data-block-command="add-limit" data-effect-index="${effectIndex}">Add Limit</button>
                    </div>
                    ${effect.limits.length ? effect.limits.map((limit, index) => `
                        <div class="effect-block-row compact">
                            ${selectMarkup({
                                label: "Limit",
                                options: LIMIT_OPTIONS,
                                value: limit.type,
                                attrs: `${fieldAttrs(effectIndex, "limit", "type")} data-item-index="${index}"`
                            })}
                            <button class="ghost danger" type="button" data-block-command="remove-limit" data-effect-index="${effectIndex}" data-item-index="${index}">Remove</button>
                        </div>
                    `).join("") : `<p>No limit.</p>`}
                </section>
            `;
        }

        renderCosts(effect, effectIndex) {
            return `
                <section class="effect-block-section">
                    <div class="effect-block-section-head">
                        <strong>Costs</strong>
                        <button class="ghost" type="button" data-block-command="add-cost" data-effect-index="${effectIndex}">Add Cost</button>
                    </div>
                    ${effect.costs.length ? effect.costs.map((cost, index) => `
                        <div class="effect-block-row">
                            ${selectMarkup({
                                label: "Cost type",
                                options: COST_OPTIONS,
                                value: cost.type,
                                attrs: `${fieldAttrs(effectIndex, "cost", "type")} data-item-index="${index}"`
                            })}
                            ${numberMarkup({
                                label: "Amount",
                                value: cost.amount ?? "",
                                attrs: `${fieldAttrs(effectIndex, "cost", "amount")} data-value-type="number" data-item-index="${index}"`,
                                disabled: cost.type === Blocks.COST_TYPES.restThisCard || cost.type === Blocks.COST_TYPES.trashThisCard
                            })}
                            <button class="ghost danger" type="button" data-block-command="remove-cost" data-effect-index="${effectIndex}" data-item-index="${index}">Remove</button>
                        </div>
                    `).join("") : `<p>No cost.</p>`}
                </section>
            `;
        }

        renderConditions(effect, effectIndex) {
            return `
                <section class="effect-block-section">
                    <div class="effect-block-section-head">
                        <strong>Conditions</strong>
                        <button class="ghost" type="button" data-block-command="add-condition" data-effect-index="${effectIndex}">Add Condition</button>
                    </div>
                    ${effect.conditions.length ? effect.conditions.map((condition, index) => `
                        <div class="effect-block-row">
                            ${selectMarkup({
                                label: "Condition",
                                options: CONDITION_OPTIONS,
                                value: condition.type,
                                attrs: `${fieldAttrs(effectIndex, "condition", "type")} data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Player",
                                options: CONTROLLER_OPTIONS,
                                value: condition.controller || Blocks.CONTROLLERS.self,
                                attrs: `${fieldAttrs(effectIndex, "condition", "controller")} data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Field",
                                options: FILTER_FIELD_OPTIONS,
                                value: condition.field || Blocks.FILTER_FIELDS.type,
                                attrs: `${fieldAttrs(effectIndex, "condition", "field")} data-item-index="${index}"`
                            })}
                            ${selectMarkup({
                                label: "Operator",
                                options: OPERATOR_OPTIONS,
                                value: condition.operator || Blocks.FILTER_OPERATORS.gte,
                                attrs: `${fieldAttrs(effectIndex, "condition", "operator")} data-item-index="${index}"`
                            })}
                            ${textMarkup({
                                label: "Value",
                                value: condition.value ?? "",
                                attrs: `${fieldAttrs(effectIndex, "condition", "value")} data-item-index="${index}"`
                            })}
                            <button class="ghost danger" type="button" data-block-command="remove-condition" data-effect-index="${effectIndex}" data-item-index="${index}">Remove</button>
                        </div>
                    `).join("") : `<p>No condition.</p>`}
                </section>
            `;
        }

        renderTargets(effect, effectIndex) {
            return `
                <section class="effect-block-section">
                    <div class="effect-block-section-head">
                        <strong>Targets</strong>
                        <button class="ghost" type="button" data-block-command="add-target" data-effect-index="${effectIndex}">Add Target</button>
                    </div>
                    ${effect.targets.length ? effect.targets.map((target, targetIndex) => `
                        <article class="effect-target-card">
                            <div class="effect-block-row">
                                ${textMarkup({
                                    label: "Target ID",
                                    value: target.id,
                                    attrs: `${fieldAttrs(effectIndex, "target", "id")} data-target-index="${targetIndex}"`
                                })}
                                ${selectMarkup({
                                    label: "Player",
                                    options: CONTROLLER_OPTIONS,
                                    value: target.controller,
                                    attrs: `${fieldAttrs(effectIndex, "target", "controller")} data-target-index="${targetIndex}"`
                                })}
                                ${selectMarkup({
                                    label: "Zone",
                                    options: ZONE_OPTIONS,
                                    value: target.zone,
                                    attrs: `${fieldAttrs(effectIndex, "target", "zone")} data-target-index="${targetIndex}"`
                                })}
                                ${numberMarkup({
                                    label: "Min",
                                    value: target.count?.min ?? 0,
                                    attrs: `${fieldAttrs(effectIndex, "target", "count.min")} data-value-type="number" data-target-index="${targetIndex}"`
                                })}
                                ${numberMarkup({
                                    label: "Max",
                                    value: target.count?.max ?? 1,
                                    attrs: `${fieldAttrs(effectIndex, "target", "count.max")} data-value-type="number" data-target-index="${targetIndex}"`
                                })}
                                ${selectMarkup({
                                    label: "Optional",
                                    options: [["true", "Up to / optional"], ["false", "Required"]],
                                    value: String(Boolean(target.optional)),
                                    attrs: `${fieldAttrs(effectIndex, "target", "optional")} data-value-type="boolean" data-target-index="${targetIndex}"`
                                })}
                                <button class="ghost danger" type="button" data-block-command="remove-target" data-effect-index="${effectIndex}" data-target-index="${targetIndex}">Remove</button>
                            </div>
                            <div class="effect-filter-list">
                                <div class="effect-block-section-head mini">
                                    <strong>Filters</strong>
                                    <button class="ghost" type="button" data-block-command="add-filter" data-effect-index="${effectIndex}" data-target-index="${targetIndex}">Add Filter</button>
                                </div>
                                ${target.filters.length ? target.filters.map((filter, filterIndex) => `
                                    <div class="effect-block-row compact">
                                        ${selectMarkup({
                                            label: "Field",
                                            options: FILTER_FIELD_OPTIONS,
                                            value: filter.field,
                                            attrs: `${fieldAttrs(effectIndex, "filter", "field")} data-target-index="${targetIndex}" data-item-index="${filterIndex}"`
                                        })}
                                        ${selectMarkup({
                                            label: "Operator",
                                            options: OPERATOR_OPTIONS,
                                            value: filter.operator,
                                            attrs: `${fieldAttrs(effectIndex, "filter", "operator")} data-target-index="${targetIndex}" data-item-index="${filterIndex}"`
                                        })}
                                        ${textMarkup({
                                            label: "Value",
                                            value: filter.value ?? "",
                                            attrs: `${fieldAttrs(effectIndex, "filter", "value")} data-target-index="${targetIndex}" data-item-index="${filterIndex}"`
                                        })}
                                        <button class="ghost danger" type="button" data-block-command="remove-filter" data-effect-index="${effectIndex}" data-target-index="${targetIndex}" data-item-index="${filterIndex}">Remove</button>
                                    </div>
                                `).join("") : `<p>No filters.</p>`}
                            </div>
                        </article>
                    `).join("") : `<p>No target.</p>`}
                </section>
            `;
        }

        renderActions(effect, effectIndex) {
            const targetOptions = [["", "No target"], ...effect.targets.map(target => [target.id, target.id])];

            return `
                <section class="effect-block-section">
                    <div class="effect-block-section-head">
                        <strong>Actions</strong>
                        <button class="ghost" type="button" data-block-command="add-action" data-effect-index="${effectIndex}">Add Action</button>
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
                                options: targetOptions,
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
                                options: [["", "None"], ...DURATION_OPTIONS],
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
                                label: "Card type",
                                options: CARD_TYPE_OPTIONS,
                                value: action.cardType || "",
                                attrs: `${fieldAttrs(effectIndex, "action", "cardType")} data-item-index="${index}"`
                            })}
                            <button class="ghost danger" type="button" data-block-command="remove-action" data-effect-index="${effectIndex}" data-item-index="${index}">Remove</button>
                        </div>
                    `).join("") : `<p>No action.</p>`}
                </section>
            `;
        }

        syncJson() {
            if (!this.jsonPreview) return;
            this.jsonPreview.value = JSON.stringify(this.effects, null, 2);
        }

        renderWarnings(validation, parserWarnings = []) {
            if (!this.warningList) return;

            const errors = validation?.errors || [];
            const warnings = [...(parserWarnings || []), ...(validation?.warnings || [])];

            if (!errors.length && !warnings.length) {
                this.warningList.innerHTML = `<div class="effect-validation-ok">Blocks valid.</div>`;
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
        return new EffectBlockEditor(options);
    }

    function resolveElement(value) {
        if (!value) return null;
        return typeof value === "string" ? document.querySelector(value) : value;
    }

    function fieldAttrs(effectIndex, scope, path) {
        return `data-block-field="${escapeAttr(path)}" data-scope="${escapeAttr(scope)}" data-effect-index="${effectIndex}"`;
    }

    function selectMarkup({ label = "", options = [], value = "", attrs = "" }) {
        return `
            <label>
                ${label ? `<span>${escapeHtml(label)}</span>` : ""}
                <select ${attrs}>
                    ${options.map(([optionValue, optionLabel]) => `
                        <option value="${escapeAttr(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>
                    `).join("")}
                </select>
            </label>
        `;
    }

    function numberMarkup({ label, value, attrs = "", disabled = false }) {
        return `
            <label>
                <span>${escapeHtml(label)}</span>
                <input type="number" min="0" step="1" value="${escapeAttr(value)}" ${attrs} ${disabled ? "disabled" : ""}>
            </label>
        `;
    }

    function textMarkup({ label, value, attrs = "" }) {
        return `
            <label>
                <span>${escapeHtml(label)}</span>
                <input type="text" value="${escapeAttr(value)}" ${attrs}>
            </label>
        `;
    }

    function readFieldValue(field) {
        if (field.dataset.valueType === "boolean") {
            return field.value === "true";
        }

        if (field.dataset.valueType === "number") {
            return field.value === "" ? "" : Number(field.value);
        }

        return field.value;
    }

    function setByPath(target, path, value) {
        if (!target || !path) return;
        const parts = path.split(".");
        let current = target;

        parts.slice(0, -1).forEach(part => {
            if (!current[part] || typeof current[part] !== "object") {
                current[part] = {};
            }
            current = current[part];
        });

        current[parts[parts.length - 1]] = value;
    }

    function clone(value) {
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
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

    global.EffectBlockUi = {
        createEditor,
        EffectBlockEditor
    };
})(typeof window !== "undefined" ? window : globalThis);
