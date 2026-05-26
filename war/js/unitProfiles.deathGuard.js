// Source: war/source-json/death-guard.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeDeathGuardName = ArmyforgeUnitProfiles.normalizeDeathGuardName || function(displayName) {
	if (!displayName) {
		return '';
	}
	return String(displayName).toLowerCase()
		.replace(/<[^>]*>/g, ' ')
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/[’']/g, '')
		.replace(/\bdeath guard\b/g, ' ')
		.replace(/\bhellblades\b/g, 'hellblade')
		.replace(/\bhelltalons\b/g, 'hell talon')
		.replace(/\bplague reapers\b/g, 'plaguereaper')
		.replace(/\bnurgling swarms\b/g, 'nurgling swarm')
		.replace(/\bbeasts of nurgle\b/g, 'beast of nurgle non summoned')
		.replace(/\blesser daemon\b/g, 'plaguebearers')
		.replace(/\bgreater daemon\b/g, 'great unclean one')
		.replace(/\bvindicators\b/g, 'death guard vindicator')
		.replace(/\bpredators\b/g, 'death guard predator')
		.replace(/\bland raiders\b/g, 'death guard land raider')
		.replace(/\brhinos\b/g, 'death guard rhino')
		.replace(/\bblight drones\b/g, 'blight drone')
		.replace(/^\s*\d+\s*[–-]\s*\d+\s*/g, ' ')
		.replace(/^\s*\d+\s*[xX]?\s*/g, ' ')
		.replace(/\b(army|formation|formations|company|companies|retinue|retinues|platoon|platoons|squadron|squadrons|battery|batteries|swarm|swarms|pool|upgrades?|upgrade|of|the|a|an|any|one|two|three|four|five|six|seven|eight|nine|ten|with|and|or|plus|per|for|may|take|add|replace|unit|units)\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.strip();
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'deathGuard',
	findFunctionName: 'findDeathGuardProfileByName',
	armyIds: ['CHAOS_dg_NETEA'],
	sourceJsonPaths: ['./source-json/death-guard.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeDeathGuardName,
	aliases: {
		'1+ Plague Marine Retinue': 'Plague Marines',
		'Plague Marine Retinue': 'Plague Marines',
		'Plague Marines': 'Plague Marines',
		'Vectorium Lord': 'Vectorium Lord',
		'Plaguecaster Lord': 'Plaguecaster Lord',
		'Armoured Assault Company': 'Death Guard Vindicator',
		'Death Guard Vindicators': 'Death Guard Vindicator',
		'Death Guard Vindicator': 'Death Guard Vindicator',
		'Blightlord Terminators': 'Blightlord Terminators',
		'Deathshroud Terminators': 'Deathshroud Terminators',
		'Blight Drone Swarm': 'Blight Drone',
		'Blight Drones': 'Blight Drone',
		'Blight Drone': 'Blight Drone',
		'Armoured Company': 'Death Guard Predator',
		'Death Guard Predators': 'Death Guard Predator',
		'Death Guard Predator': 'Death Guard Predator',
		'Death Guard Land Raiders': 'Death Guard Land Raider',
		'Death Guard Land Raider': 'Death Guard Land Raider',
		'Plague Marine Chosen': 'Plague Marine Chosen',
		'Walker Horde': 'Defiler',
		'Defiler': 'Defiler',
		'Desecrator': 'Desecrator',
		'Plague Hulk': 'Plague Hulk',
		'Plague Hulk (test 070)': 'Plague Hulk (test 070)',
		'Contagion Towers': 'Contagion Tower',
		'Contagion Tower': 'Contagion Tower',
		'Plague Towers': 'Plague Tower',
		'Plague Tower': 'Plague Tower',
		'Plague Zombie Infestation': 'Plague Zombies',
		'Plague Zombies': 'Plague Zombies',
		'Plaguereaper Company': 'Plaguereaper',
		'Plague Reapers': 'Plaguereaper',
		'Plague Reaper': 'Plaguereaper',
		'Plaguereapers': 'Plaguereaper',
		'Plaguereaper': 'Plaguereaper',
		'Daemon Pool': 'Plaguebearers',
		'Lesser Daemon': 'Plaguebearers',
		'Lesser Daemons': 'Plaguebearers',
		'Plaguebearers': 'Plaguebearers',
		'Greater Daemon': 'Great Unclean One',
		'Greater Daemons': 'Great Unclean One',
		'Great Unclean One': 'Great Unclean One',
		'Fester Titan': 'Fester Titan',
		'Repugnant Titan': 'Repugnant Titan',
		'Plaguelord Titan': 'Plaguelord Titan',
		'Hellblades': 'Hellblade',
		'Death Guard Hellblades': 'Hellblade',
		'Hellblade': 'Hellblade',
		'Helltalons': 'Hell Talon',
		'Death Guard Helltalons': 'Hell Talon',
		'Hell Talon': 'Hell Talon',
		'Helltalon': 'Hell Talon',
		'0-1 Plague Ship': 'Plague Ship',
		'Plague Ship': 'Plague Ship',
		'Beasts': 'Chaos Spawn',
		'Beasts of Nurgle': 'Beast of Nurgle, non-summoned',
		'Beast of Nurgle': 'Beast of Nurgle, non-summoned',
		'Chaos Spawn': 'Chaos Spawn',
		'Champion of Nurgle': 'Champion of Nurgle',
		'0-1 Daemon Prince': 'Death Guard Daemon Prince',
		'Daemon Prince': 'Death Guard Daemon Prince',
		'Death Guard Daemon Prince': 'Death Guard Daemon Prince',
		'Daemonic Pact': 'Daemonic Pact',
		"Nurgle's Rot": "Nurgle's Rot",
		'Havocs': 'Plague Marine Havocs',
		'Plague Marine Havocs': 'Plague Marine Havocs',
		'Icon Bearer': 'Blightbringer Icon Bearer',
		'Blightbringer Icon Bearer': 'Blightbringer Icon Bearer',
		'Land Raiders': 'Death Guard Land Raider',
		'Nurgling Infestation': 'Nurgling Swarm',
		'Nurgling Swarms': 'Nurgling Swarm',
		'Nurgling Swarm': 'Nurgling Swarm',
		'0-1 Nurgle Warlord': 'Lord of Contagion',
		'Nurgle Warlord': 'Lord of Contagion',
		'Lord of Contagion': 'Lord of Contagion',
		'Rhinos': 'Death Guard Rhino',
		'Death Guard Rhinos': 'Death Guard Rhino',
		'Death Guard Rhino': 'Death Guard Rhino',
		'Teleportarium': 'Teleportarium',
		'Vindicators': 'Death Guard Vindicator',
		'Walkers': 'Defiler'
	}
});

ArmyforgeUnitProfiles.deathGuardFormationHasUpgrade = function(formation, pattern) {
	if (!formation || !formation.upgrades || !pattern) {
		return false;
	}
	return formation.upgrades.any(function(u) {
		return u && u.name && pattern.test(u.name);
	});
};

ArmyforgeUnitProfiles.deathGuardAdditionalProfilesForFormation = function(formation) {
	var extras = [];
	var listId = ArmyforgeUI.urlData ? ArmyforgeUI.urlData.list : null;
	if (listId != 'CHAOS_dg_NETEA' || !formation || !formation.type) {
		return extras;
	}

	var formationName = formation.type.name || '';
	if (/^(1\+ ?)?Plague Marine Retinue$/i.test(formationName)) {
		extras.push('Plague Marines');
		extras.push('Vectorium Lord');
		extras.push('Plaguecaster Lord');
	}
	else if (/^Armoured Assault Company$/i.test(formationName)) {
		extras.push('Death Guard Vindicator');
	}
	else if (/^Blightlord Terminators$/i.test(formationName)) {
		extras.push('Blightlord Terminators');
		extras.push('Vectorium Lord');
		extras.push('Plaguecaster Lord');
	}
	else if (/^Blight Drone Swarm/i.test(formationName)) {
		extras.push('Blight Drone');
	}
	else if (/^Armoured Company$/i.test(formationName)) {
		var hasPredator = ArmyforgeUnitProfiles.deathGuardFormationHasUpgrade(formation, /predator/i);
		var hasLandRaider = ArmyforgeUnitProfiles.deathGuardFormationHasUpgrade(formation, /land raider/i);
		if (hasPredator || hasLandRaider) {
			if (hasPredator) {
				extras.push('Death Guard Predator');
			}
			if (hasLandRaider) {
				extras.push('Death Guard Land Raider');
			}
		}
		else {
			extras.push('Death Guard Predator');
			extras.push('Death Guard Land Raider');
		}
	}
	else if (/^Plague Marine Chosen$/i.test(formationName)) {
		extras.push('Plague Marine Chosen');
	}
	else if (/^Walker Horde$/i.test(formationName)) {
		var hasDefiler = ArmyforgeUnitProfiles.deathGuardFormationHasUpgrade(formation, /defiler/i);
		var hasDesecrator = ArmyforgeUnitProfiles.deathGuardFormationHasUpgrade(formation, /desecrator/i);
		var hasPlagueHulk = ArmyforgeUnitProfiles.deathGuardFormationHasUpgrade(formation, /plague hulk/i);
		var hasDreadnought = ArmyforgeUnitProfiles.deathGuardFormationHasUpgrade(formation, /dreadnought/i);
		if (hasDefiler || hasDesecrator || hasPlagueHulk || hasDreadnought) {
			if (hasDefiler) {
				extras.push('Defiler');
			}
			if (hasDesecrator) {
				extras.push('Desecrator');
			}
			if (hasPlagueHulk) {
				extras.push('Plague Hulk');
			}
			if (hasDreadnought) {
				extras.push('Death Guard Dreadnought');
			}
		}
		else {
			extras.push('Defiler');
			extras.push('Desecrator');
			extras.push('Plague Hulk');
			extras.push('Death Guard Dreadnought');
		}
	}
	else if (/^Contagion Towers$/i.test(formationName)) {
		extras.push('Contagion Tower');
	}
	else if (/^Plague Towers$/i.test(formationName)) {
		extras.push('Plague Tower');
	}
	else if (/^Plague Zombie Infestation$/i.test(formationName)) {
		extras.push('Plague Zombies');
	}
	else if (/^(Plaguereaper Company|Plague Reapers)$/i.test(formationName)) {
		extras.push('Plaguereaper');
	}
	else if (/^Daemon Pool$/i.test(formationName)) {
		extras.push('Plaguebearers');
		extras.push('Great Unclean One');
	}
	else if (/^Fester Titan$/i.test(formationName)) {
		extras.push('Fester Titan');
	}
	else if (/^Repugnant Titan$/i.test(formationName)) {
		extras.push('Repugnant Titan');
	}
	else if (/^Plaguelord Titan$/i.test(formationName)) {
		extras.push('Plaguelord Titan');
	}
	else if (/^Hellblades$/i.test(formationName)) {
		extras.push('Hellblade');
	}
	else if (/^Helltalons$/i.test(formationName)) {
		extras.push('Hell Talon');
	}
	else if (/^0-1 Plague Ship$/i.test(formationName)) {
		extras.push('Plague Ship');
	}

	formation.upgrades.uniq().each(function(upgrade) {
		var upgradeName = upgrade && upgrade.name ? upgrade.name : '';
		if (/vectorium lord/i.test(upgradeName)) {
			extras.push('Vectorium Lord');
		}
		if (/plaguecaster lord/i.test(upgradeName)) {
			extras.push('Plaguecaster Lord');
		}
		if (/death guard vindicator|vindicators/i.test(upgradeName)) {
			extras.push('Death Guard Vindicator');
		}
		if (/blight drone/i.test(upgradeName)) {
			extras.push('Blight Drone');
		}
		if (/predator/i.test(upgradeName)) {
			extras.push('Death Guard Predator');
		}
		if (/land raider/i.test(upgradeName)) {
			extras.push('Death Guard Land Raider');
		}
		if (/defiler/i.test(upgradeName)) {
			extras.push('Defiler');
		}
		if (/desecrator/i.test(upgradeName)) {
			extras.push('Desecrator');
		}
		if (/plague hulk/i.test(upgradeName)) {
			extras.push('Plague Hulk');
		}
		if (/dreadnought/i.test(upgradeName)) {
			extras.push('Death Guard Dreadnought');
		}
		if (/contagion tower/i.test(upgradeName)) {
			extras.push('Contagion Tower');
		}
		if (/plague tower/i.test(upgradeName)) {
			extras.push('Plague Tower');
		}
		if (/plague zombies?/i.test(upgradeName)) {
			extras.push('Plague Zombies');
		}
		if (/plaguereaper|plague reaper/i.test(upgradeName)) {
			extras.push('Plaguereaper');
		}
		if (/lesser daemon|plaguebearers?/i.test(upgradeName)) {
			extras.push('Plaguebearers');
		}
		if (/greater daemon|great unclean one/i.test(upgradeName)) {
			extras.push('Great Unclean One');
		}
		if (/hellblade/i.test(upgradeName)) {
			extras.push('Hellblade');
		}
		if (/helltalon|hell talon/i.test(upgradeName)) {
			extras.push('Hell Talon');
		}
		if (/plague ship/i.test(upgradeName)) {
			extras.push('Plague Ship');
		}
		if (/nurgling infestation/i.test(upgradeName)) {
			extras.push('Nurgling Swarm');
		}
		if (/rhinos?/i.test(upgradeName)) {
			extras.push('Death Guard Rhino');
		}
		if (/daemon prince/i.test(upgradeName)) {
			extras.push('Death Guard Daemon Prince');
		}
		if (/champion of nurgle/i.test(upgradeName)) {
			extras.push('Champion of Nurgle');
		}
	});

	return extras.uniq();
};
