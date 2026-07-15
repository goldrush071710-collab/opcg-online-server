// effectBlockValidator.js
// Validation for reusable block effects. Loaded as a plain browser script.

(function effectBlockValidatorFactory(global) {
    const Blocks = global.EffectBlocks;

    if (!Blocks) {
        throw new Error("effectBlockValidator.js must be loaded after effectBlocks.js");
    }

    const COSTS_REQUIRING_AMOUNT = new Set([
        Blocks.COST_TYPES.donMinus,
        Blocks.COST_TYPES.trashCardsFromHand,
        Blocks.COST_TYPES.discardCards,
        Blocks.COST_TYPES.returnDon,
        Blocks.COST_TYPES.trashLife,
        Blocks.COST_TYPES.restDon
    ]);

    const COMPARISON_OPERATORS = new Set(["<=", ">=", "==", "includes"]);

    function validateEffects(effects) {
        const list = Array.isArray(effects) ? effects : [];
        const results = list.map((effect, index) => validateEffect(effect, index));
        const errors = results.flatMap(result => result.errors);
        const warnings = results.flatMap(result => result.warnings);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            results
        };
    }

    function validateEffect(rawEffect, index = 0) {
        const effect = Blocks.normalizeEffect(rawEffect || {});
        const label = effect.id || `effect ${index + 1}`;
        const errors = [];
        const warnings = [...(effect.warnings || []).map(warning => `${label}: ${warning}`)];

        if (!effect.timing?.type) {
            errors.push(`${label}: timing is required.`);
        } else if (!Blocks.isKnownTiming(effect.timing.type)) {
            errors.push(`${label}: unsupported timing "${effect.timing.type}".`);
        }

        validateCosts(effect, label, errors);
        validateConditions(effect, label, errors, warnings);

        const targetIds = validateTargets(effect, label, errors);
        validateActions(effect, label, targetIds, errors, warnings);
        validateLimits(effect, label, errors);

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    function validateCosts(effect, label, errors) {
        effect.costs.forEach((cost, index) => {
            const prefix = `${label}: cost ${index + 1}`;

            if (!cost?.type) {
                errors.push(`${prefix} is missing a type.`);
                return;
            }

            if (!Blocks.isKnownCost(cost.type)) {
                errors.push(`${prefix} has unsupported type "${cost.type}".`);
                return;
            }

            if (COSTS_REQUIRING_AMOUNT.has(cost.type)) {
                validatePositiveNumber(cost.amount, `${prefix} amount`, errors);
            }
        });
    }

    function validateConditions(effect, label, errors, warnings) {
        effect.conditions.forEach((condition, index) => {
            const prefix = `${label}: condition ${index + 1}`;

            if (!condition?.type) {
                errors.push(`${prefix} is missing a type.`);
                return;
            }

            if (!Blocks.isKnownCondition(condition.type)) {
                errors.push(`${prefix} has unsupported type "${condition.type}".`);
                return;
            }

            if (condition.controller && !Blocks.isKnownController(condition.controller)) {
                errors.push(`${prefix} has unsupported controller "${condition.controller}".`);
            }

            if (condition.operator && !COMPARISON_OPERATORS.has(condition.operator)) {
                errors.push(`${prefix} has unsupported operator "${condition.operator}".`);
            }

            if (requiresConditionValue(condition.type) && (condition.value === undefined || condition.value === "")) {
                errors.push(`${prefix} requires a value.`);
            }

            if (
                condition.type === Blocks.CONDITION_TYPES.leaderMatches ||
                condition.type === Blocks.CONDITION_TYPES.controlsCharacter
            ) {
                if (!condition.field) {
                    errors.push(`${prefix} requires a field.`);
                }

                if (!condition.operator) {
                    errors.push(`${prefix} requires an operator.`);
                }
            }

            if (!condition.operator && !condition.field && condition.type !== Blocks.CONDITION_TYPES.controlsCharacter) {
                warnings.push(`${prefix} has no operator or field; verify it is intentional.`);
            }
        });
    }

    function validateTargets(effect, label, errors) {
        const targetIds = new Set();

        effect.targets.forEach((target, index) => {
            const prefix = `${label}: target ${index + 1}`;

            if (!target?.id) {
                errors.push(`${prefix} is missing an id.`);
            } else if (targetIds.has(target.id)) {
                errors.push(`${prefix} id "${target.id}" is duplicated.`);
            } else {
                targetIds.add(target.id);
            }

            if (!Blocks.isKnownController(target.controller)) {
                errors.push(`${prefix} has unsupported controller "${target.controller}".`);
            }

            if (!Blocks.isKnownZone(target.zone)) {
                errors.push(`${prefix} has unsupported zone "${target.zone}".`);
            }

            const min = Number(target.count?.min ?? 0);
            const max = Number(target.count?.max ?? 0);

            if (!Number.isFinite(min) || min < 0) {
                errors.push(`${prefix} count.min must be 0 or higher.`);
            }

            if (!Number.isFinite(max) || max < 0) {
                errors.push(`${prefix} count.max must be 0 or higher.`);
            }

            if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
                errors.push(`${prefix} count.min cannot be greater than count.max.`);
            }

            validateFilters(target.filters || [], prefix, errors);
        });

        return targetIds;
    }

    function validateFilters(filters, prefix, errors) {
        filters.forEach((filter, index) => {
            const filterPrefix = `${prefix} filter ${index + 1}`;
            const knownFields = Object.values(Blocks.FILTER_FIELDS);
            const knownOperators = Object.values(Blocks.FILTER_OPERATORS);

            if (!knownFields.includes(filter.field)) {
                errors.push(`${filterPrefix} has unsupported field "${filter.field}".`);
            }

            if (!knownOperators.includes(filter.operator)) {
                errors.push(`${filterPrefix} has unsupported operator "${filter.operator}".`);
            }

            if (filter.value === undefined || filter.value === "") {
                errors.push(`${filterPrefix} requires a value.`);
            }
        });
    }

    function validateActions(effect, label, targetIds, errors, warnings) {
        if (!effect.actions.length) {
            errors.push(`${label}: at least one action is required.`);
            return;
        }

        effect.actions.forEach((action, index) => {
            const prefix = `${label}: action ${index + 1}`;

            if (!action?.type) {
                errors.push(`${prefix} is missing a type.`);
                return;
            }

            if (!Blocks.isKnownAction(action.type)) {
                errors.push(`${prefix} has unsupported type "${action.type}".`);
                return;
            }

            if (Blocks.actionRequiresTarget(action.type)) {
                if (!action.target) {
                    errors.push(`${prefix} requires a target.`);
                } else if (action.target !== "source" && !targetIds.has(action.target)) {
                    errors.push(`${prefix} references missing target "${action.target}".`);
                }
            }

            if (Blocks.actionRequiresAmount(action.type)) {
                validatePositiveNumber(action.amount, `${prefix} amount`, errors);
            }

            if (action.duration && !Blocks.isKnownDuration(action.duration)) {
                errors.push(`${prefix} has unsupported duration "${action.duration}".`);
            }

            if (action.type === Blocks.ACTION_TYPES.giveKeyword && !action.keyword) {
                errors.push(`${prefix} requires a keyword.`);
            }

            if (
                action.type === Blocks.ACTION_TYPES.searchTopDeck &&
                !effect.actions.some(other => [
                    Blocks.ACTION_TYPES.addToHand,
                    Blocks.ACTION_TYPES.playSelected,
                    Blocks.ACTION_TYPES.putRestBottomDeck,
                    Blocks.ACTION_TYPES.putRestTrash
                ].includes(other.type))
            ) {
                warnings.push(`${prefix} searches cards but does not say what happens to selected or remaining cards.`);
            }
        });
    }

    function validateLimits(effect, label, errors) {
        effect.limits.forEach((limit, index) => {
            const prefix = `${label}: limit ${index + 1}`;

            if (!limit?.type) {
                errors.push(`${prefix} is missing a type.`);
                return;
            }

            if (limit.type !== "oncePerTurn") {
                errors.push(`${prefix} has unsupported type "${limit.type}".`);
            }
        });
    }

    function validatePositiveNumber(value, label, errors) {
        const number = Number(value);

        if (!Number.isFinite(number) || number <= 0) {
            errors.push(`${label} must be a positive number.`);
        }
    }

    function requiresConditionValue(type) {
        return [
            Blocks.CONDITION_TYPES.lifeComparison,
            Blocks.CONDITION_TYPES.donComparison,
            Blocks.CONDITION_TYPES.trashCountComparison,
            Blocks.CONDITION_TYPES.leaderMatches,
            Blocks.CONDITION_TYPES.controlsCharacter,
            Blocks.CONDITION_TYPES.sourceAttachedDonComparison
        ].includes(type);
    }

    function parseAndValidate(text, options = {}) {
        if (!global.EffectBlockParser) {
            throw new Error("parseAndValidate requires effectBlockParser.js");
        }

        const parsed = global.EffectBlockParser.parseEffectText(text, options);
        const validation = validateEffects(parsed.effects);

        return {
            ...parsed,
            validation,
            valid: validation.valid
        };
    }

    global.EffectBlockValidator = {
        validateEffect,
        validateEffects,
        parseAndValidate
    };
})(typeof window !== "undefined" ? window : globalThis);
