// war/js/unitProfileLoader.js
// Shared loader for unit-profile faction files.
// Loaded by chooser.html before any unitProfiles.<faction>.js script tag.
// Provides ArmyforgeUnitProfiles.registerFaction(config) — see ./unitProfileLoader.md

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

(function() {
    // Pure helpers (also exported for unit tests under Node).

    function cloneProfile(profile) {
        return {
            name: profile.name,
            type: profile.type,
            speed: profile.speed,
            armour: profile.armour,
            cc: profile.cc,
            ff: profile.ff,
            weapons: (profile.weapons || []).map(function(w) {
                return {
                    name: w.name,
                    range: w.range,
                    firepower: w.firepower,
                    notes: (w.notes || []).slice()
                };
            }),
            abilities: (profile.abilities_or_notes || profile.abilities || []).slice()
        };
    }

    function deriveKey(name, normalizer) {
        if (!name) return '';
        var normalized = normalizer(name);
        if (!normalized) return '';
        return normalized.replace(/\s+/g, '_');
    }

    function registerAlias(faction, alias, key, normalizer) {
        if (!alias || !key) return;
        var normalized = normalizer(alias);
        if (!normalized) return;
        faction.nameToKey[normalized] = key;
        var compact = normalized.replace(/\s+/g, '');
        if (compact && compact !== normalized) {
            faction.nameToKey[compact] = key;
        }
    }

    function buildFinder(namespace, normalizer) {
        return function(displayName, listId) {
            if (!displayName) return null;
            var globalProfiles = (typeof global !== 'undefined' ? global : window).ArmyforgeUnitProfiles;
            var faction = globalProfiles[namespace];
            if (!faction) return null;
            if (listId && !faction.armyIds.member(listId)) return null;
            var normalized = normalizer(displayName);
            var key = faction.nameToKey[normalized] ||
                      faction.nameToKey[normalized.replace(/\s+/g, '')];
            if (!key) return null;
            return faction.profiles[key] || null;
        };
    }

    function loadSourceJsonSync(sourcePath) {
        var responseText = null;
        try {
            new Ajax.Request(sourcePath, {
                method: 'get',
                asynchronous: false,
                onSuccess: function(response) { responseText = response.responseText; }
            });
        } catch (err) {
            console.warn('unitProfileLoader: Ajax error for ' + sourcePath, err);
            return null;
        }
        if (!responseText) {
            console.warn('unitProfileLoader: empty response for ' + sourcePath);
            return null;
        }
        try {
            return JSON.parse(responseText);
        } catch (err2) {
            console.warn('unitProfileLoader: JSON parse error for ' + sourcePath, err2);
            return null;
        }
    }

    function registerFaction(config) {
        // placeholder, replaced in Task 8
    }

    // Public API
    ArmyforgeUnitProfiles.registerFaction = registerFaction;

    // CJS export for unit tests under Node. Skipped in browser (no `module`).
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            cloneProfile: cloneProfile,
            deriveKey: deriveKey,
            registerAlias: registerAlias,
            buildFinder: buildFinder,
            registerFaction: registerFaction
        };
    }
})();
