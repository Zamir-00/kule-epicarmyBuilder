// Source: war/source-json/thousand-sons.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeThousandSonsName = ArmyforgeUnitProfiles.normalizeThousandSonsName || function(displayName) {
	if (!displayName) {
		return '';
	}
	return String(displayName).toLowerCase()
		.replace(/<[^>]*>/g, ' ')
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/[’']/g, '')
		.replace(/\bthousand sons\b/g, ' ')
		.replace(/\btzeentch\b/g, ' ')
		.replace(/\bchaos\b/g, ' ')
		.replace(/\bdoomwing fighters\b/g, 'doomwing')
		.replace(/\bfirelord bombers\b/g, 'firelord')
		.replace(/\bgreater daemons\b/g, 'greater daemon')
		.replace(/\blesser daemons\b/g, 'lesser daemon')
		.replace(/\bwraithgates?\b/g, 'wraithgate')
		.replace(/\bdec(?:e|i)vers?\b/g, 'deceiver')
		.replace(/\bscarab occults?\b/g, 'scarab occult')
		.replace(/\brubric fellowships?\b/g, 'rubric fellowship')
		.replace(/\bthousand sons armour\b/g, 'thousand sons armor')
		.replace(/\bthousand sons armoured\b/g, 'thousand sons armor')
		.replace(/\bdeceiver dreadnoughts\b/g, 'deceiver')
		.replace(/\bdreadclaws\b/g, 'dreadclaw')
		.replace(/\bahriman[’']?s chosen\b/g, "ahriman's chosen")
		.replace(/\bneophyte class\b/g, 'neophyte class')
		.replace(/\bsilver tower company\b/g, 'silver tower')
		.replace(/\bdoomwings\b/g, 'doomwing')
		.replace(/\bfirelords\b/g, 'firelord')
		.replace(/\bdevastation class cruiser\b/g, 'devastation class cruiser')
		.replace(/\bdespoiler battleship\b/g, 'despoiler class battleship')
		.replace(/^\s*\d+\s*[–-]\s*\d+\s*/g, ' ')
		.replace(/^\s*\d+\s*[xX]?\s*/g, ' ')
		.replace(/\b(army|formation|formations|company|companies|retinue|retinues|support|supports|individuals|individual|pool|unit|units|upgrade|upgrades|option|options|with|and|or|plus|per|for|may|take|add|replace|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.strip();
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'thousandSons',
	findFunctionName: 'findThousandSonsProfileByName',
	armyIds: ['CHAOS_ts_NETEA'],
	sourceJsonPaths: ['./source-json/thousand-sons.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeThousandSonsName,
	aliases: {
		'0-1 Wraithgate': 'Wraithgate',
		'Wraithgate': 'Wraithgate',
		'0-1 Scarab Occult': 'Thousand Sons Sorcerer Lord',
		'Scarab Occult': 'Thousand Sons Sorcerer Lord',
		'Thousand Sons Sorcerer Lord': 'Thousand Sons Sorcerer Lord',
		'Thousand Sons Adeptus': 'Thousand Sons Adeptus',
		"0-1 Ahriman's Chosen": 'Thousand Sons Sorcerer',
		"Ahriman's Chosen": 'Thousand Sons Sorcerer',
		'Thousand Sons Sorcerer': 'Thousand Sons Sorcerer',
		'Thousand Sons Marine units': 'Thousand Sons Marines',
		'Thousand Sons Marines': 'Thousand Sons Marines',
		'1+ Rubric Fellowship': 'Thousand Sons Sorcerer',
		'Rubric Fellowship': 'Thousand Sons Sorcerer',
		'Thousand Sons Armour': 'Thousand Sons Predator',
		'Thousand Sons Armor': 'Thousand Sons Predator',
		'Thousand Sons Predators': 'Thousand Sons Predator',
		'Thousand Sons Predator': 'Thousand Sons Predator',
		'Thousand Sons Land Raiders': 'Thousand Sons Land Raider',
		'Thousand Sons Land Raider': 'Thousand Sons Land Raider',
		'Silver Tower Company': 'Silver Tower',
		'Silver Towers': 'Silver Tower',
		'Silver Tower': 'Silver Tower',
		'Thousand Sons Warcoven': 'Thousand Sons Terminators',
		'Thousand Sons Terminator units': 'Thousand Sons Terminators',
		'Thousand Sons Terminators': 'Thousand Sons Terminators',
		'Sekhmet Disc Riders': 'Sekhmet Disc Riders',
		'Disc Riders': 'Sekhmet Disc Riders',
		'Neophyte Class': 'Thousand Sons Neophyte',
		'Neophyte units': 'Thousand Sons Neophyte',
		'Thousand Sons Neophyte': 'Thousand Sons Neophyte',
		'Deceivers Formation': 'Deceiver',
		'Deceivers': 'Deceiver',
		'Deceiver': 'Deceiver',
		'Deceiver Dreadnoughts': 'Deceiver',
		'0-1 Daemon Prince of Tzeentch': 'Daemon Prince of Tzeentch',
		'Daemon Prince of Tzeentch': 'Daemon Prince of Tzeentch',
		'Champion of Tzeentch': 'Champion of Tzeentch',
		'Daemonic Pact': 'Daemonic Pact',
		'Dreadclaws': 'Dreadclaw',
		'Dreadclaw': 'Dreadclaw',
		'Dreadnoughts': 'Thousand Sons Dreadnought',
		'Chaos Dreadnoughts': 'Thousand Sons Dreadnought',
		'Thousand Sons Dreadnought': 'Thousand Sons Dreadnought',
		'Icon Bearer': 'Icon Bearer',
		'Rhinos': 'Thousand Sons Rhino',
		'Thousand Sons Rhinos': 'Thousand Sons Rhino',
		'Thousand Sons Rhino': 'Thousand Sons Rhino',
		'Land Raiders': 'Thousand Sons Land Raider',
		'0-1 Greater Daemon': 'Lord of Change',
		'Greater Daemon': 'Lord of Change',
		'Lord of Change': 'Lord of Change',
		'Lesser Daemons': 'Tzeentch Flamers',
		'Lesser Daemon': 'Tzeentch Flamers',
		'Tzeentch Flamers': 'Tzeentch Flamers',
		'Tzeentch Horrors': 'Tzeentch Horrors',
		'Tzeentch Screamers': 'Tzeentch Screamers',
		'Doomwing Interceptors': 'Doomwing',
		'Doomwings': 'Doomwing',
		'Doomwing': 'Doomwing',
		'Firelord Bombers': 'Firelord',
		'Firelords': 'Firelord',
		'Firelord': 'Firelord',
		'Devastation Class Cruiser': 'Devastation Class Cruiser',
		'Despoiler Battleship': 'Despoiler Class Battleship',
		'Despoiler Class Battleship': 'Despoiler Class Battleship',
		'Greater Spires': 'Greater Spires of Tzeentch',
		'Greater Spires of Tzeentch': 'Greater Spires of Tzeentch',
		'Warp Palace': 'Warp Palace of Tzeentch',
		'Warp Palace of Tzeentch': 'Warp Palace of Tzeentch'
	}
});

ArmyforgeUnitProfiles.thousandSonsAdditionalProfilesForFormation = function(formation) {
	var extras = [];
	var listId = ArmyforgeUI.urlData ? ArmyforgeUI.urlData.list : null;
	if (listId != 'CHAOS_ts_NETEA' || !formation || !formation.type) {
		return extras;
	}

	var formationName = formation.type.name || '';
	function add(name) {
		if (name) {
			extras.push(name);
		}
	}

	if (/^0-1 Wraithgate$/i.test(formationName) || /^Wraithgate$/i.test(formationName)) {
		add('Wraithgate');
	}
	else if (/^Scarab Occult$/i.test(formationName)) {
		add('Thousand Sons Sorcerer Lord');
		add('Thousand Sons Adeptus');
	}
	else if (/^Ahriman['']s Chosen$/i.test(formationName)) {
		add('Thousand Sons Sorcerer');
		add('Thousand Sons Marines');
	}
	else if (/^Rubric Fellowship$/i.test(formationName)) {
		add('Thousand Sons Sorcerer');
		add('Thousand Sons Marines');
	}
	else if (/^Thousand Sons Armour$/i.test(formationName) || /^Thousand Sons Armor$/i.test(formationName)) {
		var hasPredator = false;
		var hasLandRaider = false;
		var hasDreadnought = false;
		(formation.upgrades || []).each(function(upgrade) {
			var name = upgrade && upgrade.name ? upgrade.name : '';
			if (/predator/i.test(name)) {
				hasPredator = true;
			}
			if (/land raider/i.test(name)) {
				hasLandRaider = true;
			}
			if (/dreadnought/i.test(name)) {
				hasDreadnought = true;
			}
		});
		if (hasPredator || hasLandRaider || hasDreadnought) {
			if (hasPredator) {
				add('Thousand Sons Predator');
			}
			if (hasLandRaider) {
				add('Thousand Sons Land Raider');
			}
			if (hasDreadnought) {
				add('Thousand Sons Dreadnought');
			}
		}
		else {
			add('Thousand Sons Predator');
			add('Thousand Sons Land Raider');
		}
	}
	else if (/^Silver Tower Company$/i.test(formationName)) {
		add('Silver Tower');
	}
	else if (/^Thousand Sons Warcoven$/i.test(formationName)) {
		add('Thousand Sons Sorcerer');
		add('Thousand Sons Terminators');
	}
	else if (/^Sekhmet Disc Riders$/i.test(formationName)) {
		add('Thousand Sons Sorcerer');
		add('Sekhmet Disc Riders');
	}
	else if (/^Neophyte Class$/i.test(formationName)) {
		add('Thousand Sons Sorcerer');
		add('Thousand Sons Neophyte');
	}
	else if (/^Deceivers Formation$/i.test(formationName) || /^Deceivers$/i.test(formationName)) {
		add('Deceiver');
	}
	else if (/^Thousand Sons Daemon Pool$/i.test(formationName) || /^Daemon Pool$/i.test(formationName)) {
		add('Lord of Change');
		add('Tzeentch Flamers');
		add('Tzeentch Horrors');
		add('Tzeentch Screamers');
	}
	else if (/^Doomwing fighters$/i.test(formationName) || /^Doomwing Interceptors$/i.test(formationName)) {
		add('Doomwing');
	}
	else if (/^Firelord Bombers$/i.test(formationName)) {
		add('Firelord');
	}
	else if (/^Greater Spires of Tzeentch$/i.test(formationName) || /^Greater Spires$/i.test(formationName)) {
		add('Greater Spires of Tzeentch');
	}
	else if (/^Warp Palace of Tzeentch$/i.test(formationName) || /^Warp Palace$/i.test(formationName)) {
		add('Warp Palace of Tzeentch');
	}

	(formation.upgrades || []).uniq().each(function(upgrade) {
		var upgradeName = upgrade && upgrade.name ? upgrade.name : '';
		if (/sorcerer lord/i.test(upgradeName)) {
			add('Thousand Sons Sorcerer Lord');
		}
		if (/^sorcerer$/i.test(upgradeName)) {
			add('Thousand Sons Sorcerer');
		}
		if (/daemon prince of tzeentch/i.test(upgradeName)) {
			add('Daemon Prince of Tzeentch');
		}
		if (/champion of tzeentch/i.test(upgradeName)) {
			add('Champion of Tzeentch');
		}
		if (/daemonic pact/i.test(upgradeName)) {
			add('Daemonic Pact');
		}
		if (/dreadclaw/i.test(upgradeName)) {
			add('Dreadclaw');
		}
		if (/dreadnought/i.test(upgradeName)) {
			add('Thousand Sons Dreadnought');
		}
		if (/icon bearer/i.test(upgradeName)) {
			add('Icon Bearer');
		}
		if (/rhino/i.test(upgradeName)) {
			add('Thousand Sons Rhino');
		}
		if (/land raider/i.test(upgradeName)) {
			add('Thousand Sons Land Raider');
		}
		if (/predator/i.test(upgradeName)) {
			add('Thousand Sons Predator');
		}
		if (/silver tower/i.test(upgradeName)) {
			add('Silver Tower');
		}
		if (/thousand sons terminator/i.test(upgradeName)) {
			add('Thousand Sons Terminators');
		}
		if (/greater daemon/i.test(upgradeName)) {
			add('Lord of Change');
		}
		if (/lesser daemon/i.test(upgradeName)) {
			add('Tzeentch Flamers');
			add('Tzeentch Horrors');
			add('Tzeentch Screamers');
		}
		if (/disc rider/i.test(upgradeName)) {
			add('Sekhmet Disc Riders');
		}
		if (/deceiver/i.test(upgradeName)) {
			add('Deceiver');
		}
	});

	return extras.uniq();
};
