// Source: war/source-json/hedonic-crusade.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeHedonicCrusadeName = ArmyforgeUnitProfiles.normalizeHedonicCrusadeName || function(displayName) {
	if (!displayName) {
		return '';
	}
	return String(displayName).toLowerCase()
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/[’']/g, '')
		.replace(/\bhouse devine\b/g, ' ')
		.replace(/\bhedonic crusade\b/g, ' ')
		.replace(/\bchaos navy\b/g, ' ')
		.replace(/\bwar engines\b/g, ' ')
		.replace(/\bdaemon pool\b/g, ' ')
		.replace(/\bhell blades\b/g, 'hell blade')
		.replace(/\bhell talons\b/g, 'hell talon')
		.replace(/\bhell knights\b/g, 'hell knight')
		.replace(/\bhell slicers\b/g, 'hell slicer')
		.replace(/\bhell scourges\b/g, 'hell scourge')
		.replace(/\bhell striders\b/g, 'hell strider')
		.replace(/\bgreater daemons\b/g, 'greater daemon')
		.replace(/\blesser daemons\b/g, 'lesser daemon')
		.replace(/^\s*\d+\s*[–-]\s*\d+\s*/g, ' ')
		.replace(/^\s*\d+\s*[xX]?\s*/g, ' ')
		.replace(/\b(formation|formations|company|companies|household|households|vassal|vassals|squadron|squadrons|pool|units|unit|the|a|an|any|one|two|three|four|five|six|seven|eight|nine|ten|up|to|add|replace|with|or|and|plus|per|army|may|take)\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.strip();
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'hedonicCrusade',
	findFunctionName: 'findHedonicCrusadeProfileByName',
	armyIds: ['CHAOS_House_Devine_NETEA'],
	sourceJsonPaths: ['./source-json/hedonic-crusade.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeHedonicCrusadeName,
	aliases: {
		'Knight Household': 'Hell-Knight',
		'Hell-Knights': 'Hell-Knight',
		'Hell-Knight': 'Hell-Knight',
		'Hell-Slicers': 'Hell-Slicer',
		'Hell-Slicer': 'Hell-Slicer',
		'Hell-Scourges': 'Hell-Scourge',
		'Hell-Scourge': 'Hell-Scourge',
		'Hell-Strider Household': 'Hell-Strider',
		'Hell-Striders': 'Hell-Strider',
		'Hell-Strider': 'Hell-Strider',
		'Voluptuary': 'Voluptuary',
		'Arch-Hedonist': 'Arch-Hedonist',
		'Cultist': 'Cultists',
		'Cultists': 'Cultists',
		'Mutants': 'Mutants',
		'Demagogue': 'Demagogue',
		'Chaos Marine Aspiring Champion': 'Chaos Marine Aspiring Champion',
		'Aspiring Champion': 'Chaos Marine Aspiring Champion',
		'Debaser': 'Debaser',
		'Debasers': 'Debaser',
		'Noise Marine': 'Noise Marines',
		'Noise Marines': 'Noise Marines',
		'Chaos Lord': 'Chaos Lord',
		'Sorcerer Lord': 'Sorcerer Lord',
		'Land Transporter': 'Land Transporter',
		'Land Transporters': 'Land Transporter',
		'Chaos Rhino': 'Chaos Rhino',
		'Chaos Rhinos': 'Chaos Rhino',
		'Daemonic Pact': 'Daemonic Pact',
		'Icon Bearer': 'Icon Bearer',
		'Champion of Slaanesh': 'Champion of Slaanesh',
		'Hell Blade': 'Hell Blade',
		'Hell Blades': 'Hell Blade',
		'Hell Talon': 'Hell Talon',
		'Hell Talons': 'Hell Talon',
		'Questor': 'Questor Titan',
		'Questor Titan': 'Questor Titan',
		'Subjugator': 'Subjugator Titan',
		'Subjugator Titan': 'Subjugator Titan',
		'Ravisher': 'Ravisher Titan',
		'Ravisher Titan': 'Ravisher Titan',
		'Painlord': 'Painlord Titan',
		'Painlord Titan': 'Painlord Titan',
		'Greater Daemon': 'Keeper of Secrets',
		'Greater Daemons': 'Keeper of Secrets',
		'Keeper of Secrets': 'Keeper of Secrets',
		'Lesser Daemon': 'Daemonettes',
		'Lesser Daemons': 'Daemonettes',
		'Daemonettes': 'Daemonettes',
		'Fiends of Slaanesh': 'Fiends of Slaanesh',
		'Fiend of Slaanesh': 'Fiends of Slaanesh',
		'Steeds of Slaanesh': 'Steeds of Slaanesh',
		'Steed of Slaanesh': 'Steeds of Slaanesh'
	}
});

ArmyforgeUnitProfiles.hedonicCrusadeAdditionalProfilesForFormation = function(formation) {
	var extras = [];
	var listId = ArmyforgeUI.urlData ? ArmyforgeUI.urlData.list : null;
	if (listId != 'CHAOS_House_Devine_NETEA' || !formation || !formation.type) {
		return extras;
	}

	var formationName = formation.type.name || '';
	if (/^Knight Household$/i.test(formationName)) {
		extras.push('Hell-Knight');
		extras.push('Hell-Slicer');
	}
	else if (/^Hell-Strider Household$/i.test(formationName)) {
		extras.push('Hell-Strider');
	}
	else if (/^Cultist$/i.test(formationName)) {
		extras.push('Demagogue');
		extras.push('Chaos Marine Aspiring Champion');
		extras.push('Cultists');
		extras.push('Mutants');
	}
	else if (/^Debaser$/i.test(formationName)) {
		extras.push('Debaser');
	}
	else if (/^Noise Marine$/i.test(formationName)) {
		extras.push('Noise Marines');
	}
	else if (/^Hell Blade$/i.test(formationName)) {
		extras.push('Hell Blade');
	}
	else if (/^Hell Talon$/i.test(formationName)) {
		extras.push('Hell Talon');
	}
	else if (/^Questor$/i.test(formationName)) {
		extras.push('Questor Titan');
	}
	else if (/^Subjugator$/i.test(formationName)) {
		extras.push('Subjugator Titan');
	}
	else if (/^Ravisher$/i.test(formationName)) {
		extras.push('Ravisher Titan');
	}
	else if (/^Painlord$/i.test(formationName)) {
		extras.push('Painlord Titan');
	}
	else if (/^Daemon Pool$/i.test(formationName)) {
		extras.push('Keeper of Secrets');
		extras.push('Daemonettes');
		extras.push('Fiends of Slaanesh');
		extras.push('Steeds of Slaanesh');
	}

	formation.upgrades.uniq().each(function(upgrade) {
		var upgradeName = upgrade && upgrade.name ? upgrade.name : '';
		if (/hell-?knight/i.test(upgradeName)) {
			extras.push('Hell-Knight');
		}
		if (/hell-?slicer/i.test(upgradeName)) {
			extras.push('Hell-Slicer');
		}
		if (/hell-?scourge/i.test(upgradeName)) {
			extras.push('Hell-Scourge');
		}
		if (/hell-?strider/i.test(upgradeName)) {
			extras.push('Hell-Strider');
		}
		if (/voluptuary/i.test(upgradeName)) {
			extras.push('Voluptuary');
		}
		if (/arch-?hedonist/i.test(upgradeName)) {
			extras.push('Arch-Hedonist');
		}
		if (/demagogue/i.test(upgradeName)) {
			extras.push('Demagogue');
		}
		if (/aspiring champion/i.test(upgradeName)) {
			extras.push('Chaos Marine Aspiring Champion');
		}
		if (/cultists?/i.test(upgradeName)) {
			extras.push('Cultists');
		}
		if (/mutants?/i.test(upgradeName)) {
			extras.push('Mutants');
		}
		if (/debasers?/i.test(upgradeName)) {
			extras.push('Debaser');
		}
		if (/noise marine/i.test(upgradeName)) {
			extras.push('Noise Marines');
		}
		if (/chaos lord/i.test(upgradeName)) {
			extras.push('Chaos Lord');
		}
		if (/sorcerer lord/i.test(upgradeName)) {
			extras.push('Sorcerer Lord');
		}
		if (/land transporter/i.test(upgradeName)) {
			extras.push('Land Transporter');
		}
		if (/rhino/i.test(upgradeName)) {
			extras.push('Chaos Rhino');
		}
		if (/icon bearer/i.test(upgradeName)) {
			extras.push('Icon Bearer');
		}
		if (/champion of slaanesh/i.test(upgradeName)) {
			extras.push('Champion of Slaanesh');
		}
		if (/hell blade/i.test(upgradeName)) {
			extras.push('Hell Blade');
		}
		if (/hell talon/i.test(upgradeName)) {
			extras.push('Hell Talon');
		}
		if (/questor/i.test(upgradeName)) {
			extras.push('Questor Titan');
		}
		if (/subjugator/i.test(upgradeName)) {
			extras.push('Subjugator Titan');
		}
		if (/ravisher/i.test(upgradeName)) {
			extras.push('Ravisher Titan');
		}
		if (/painlord/i.test(upgradeName)) {
			extras.push('Painlord Titan');
		}
		if (/greater daemon/i.test(upgradeName)) {
			extras.push('Keeper of Secrets');
		}
		if (/lesser daemon/i.test(upgradeName)) {
			extras.push('Daemonettes');
			extras.push('Fiends of Slaanesh');
			extras.push('Steeds of Slaanesh');
		}
	});

	return extras.uniq();
};
