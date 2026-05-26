// Source: war/source-json/vraksian-traitors.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeVraksianTraitorsName = ArmyforgeUnitProfiles.normalizeVraksianTraitorsName || function(displayName) {
	if (!displayName) {
		return '';
	}
	return String(displayName).toLowerCase()
		.replace(/<[^>]*>/g, ' ')
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/[’']/g, '')
		.replace(/\bvraksian\b/g, ' ')
		.replace(/\bvarksian\b/g, ' ')
		.replace(/\bimperial guard\b/g, ' ')
		.replace(/\bchaos allies\b/g, ' ')
		.replace(/\bchaos ally\b/g, ' ')
		.replace(/\bdeathstrike missile launchers\b/g, 'deathstrike launcher')
		.replace(/\bdeath strike missile launchers\b/g, 'deathstrike launcher')
		.replace(/\bdeathstrike missile launcher\b/g, 'deathstrike launcher')
		.replace(/\bdeath strike missile launcher\b/g, 'deathstrike launcher')
		.replace(/\bhell blades\b/g, 'hellblade')
		.replace(/\bhell talons\b/g, 'helltalon')
		.replace(/\bsentinels\b/g, 'sentinal')
		.replace(/\bnurgle warlord\b/g, 'lord of contagion')
		.replace(/^\s*\d+(?:\.\d+)?\s*/g, ' ')
		.replace(/^\s*\d+\s*[–-]\s*\d+\s*/g, ' ')
		.replace(/\b(army|formation|formations|company|companies|retinue|retinues|squadron|squadrons|battery|batteries|platoon|platoons|units|unit|upgrades?|upgrade|option|options|of|the|a|an|any|one|two|three|four|five|six|seven|eight|nine|ten|with|and|or|plus|per|for|may|take|add|replace)\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.strip();
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'vraksianTraitors',
	findFunctionName: 'findVraksianTraitorsProfileByName',
	armyIds: ['CHAOS_VraksianTraitors_NETEA'],
	sourceJsonPaths: ['./source-json/vraksian-traitors.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeVraksianTraitorsName,
	aliases: {
		'1.1 Regimental HQ': 'Supreme Commander',
		'Regimental HQ': 'Supreme Commander',
		'Vraksian Supreme Commander': 'Supreme Commander',
		'Supreme Commander': 'Supreme Commander',
		'Imperial Guard Infantry Units': 'Varksian Infantry',
		'Imperial Guard Infantry': 'Varksian Infantry',
		'Vraksian Infantry': 'Varksian Infantry',
		'Varksian Infantry': 'Varksian Infantry',
		'Chimeras': 'Chimera',
		'Chimera': 'Chimera',
		'Infantry Company': 'Commander',
		'Vraksian Commander': 'Commander',
		'Commander': 'Commander',
		'Leman Russ Tank Company': 'Leman Russ',
		'Leman Russ Tanks': 'Leman Russ',
		'Leman Russ': 'Leman Russ',
		'Leman Russ Vanquisher': 'Leman Russ Vanquisher',
		'0-1 Malcador Tank Company': 'Malcador Tank',
		'Malcador Tank Company': 'Malcador Tank',
		'Malcador': 'Malcador Tank',
		'Malcador Tank': 'Malcador Tank',
		'Malcador Defender': 'Malcador Defender Tank',
		'Malcador Defender Tank': 'Malcador Defender Tank',
		'Malcador Annihilator': 'Malcador Annihilator Tank',
		'Malcador Annihilator Tank': 'Malcador Annihilator Tank',
		'Artillery Company 0-1': 'Basilisk',
		'Artillery Company': 'Basilisk',
		'Basilisks': 'Basilisk',
		'Basilisk': 'Basilisk',
		'Artillery Squadron': 'Basilisk',
		'Bombards': 'Bombard',
		'Bombard': 'Bombard',
		'Manticores': 'Manticores',
		'Manticore': 'Manticores',
		'Sentinel Squadron': 'Sentinal',
		'Sentinels': 'Sentinal',
		'Sentinel': 'Sentinal',
		'Sentinal': 'Sentinal',
		'Flak Battery': 'Hydra',
		'Hydras': 'Hydra',
		'Hydra': 'Hydra',
		'Disciples of Xaphan': 'Disciples of Xaphan',
		'Heavy Artillery Squadron': 'Minotaur Artillery Tank',
		'Minotaur Artillery Tanks': 'Minotaur Artillery Tank',
		'Minotaur Artillary Tank': 'Minotaur Artillery Tank',
		'Minotaur Artillery Tank': 'Minotaur Artillery Tank',
		'Tank Hunter Squadron - Valdor Tank Hunters': 'Valdor Tank Hunter',
		'Tank Hunter Squadron - Leman Russ Destroyers': 'Leman Russ Tank Destroyer',
		'Tank Hunter Squadron': 'Valdor Tank Hunter',
		'Valdor Tank Hunters': 'Valdor Tank Hunter',
		'Valdor Tank Hunter': 'Valdor Tank Hunter',
		'Leman Russ Destroyers Tank Hunters': 'Leman Russ Tank Destroyer',
		'Leman Russ Destroyer': 'Leman Russ Tank Destroyer',
		'Leman Russ Tank Destroyer': 'Leman Russ Tank Destroyer',
		'Armored Fist Company': 'Varksian Infantry',
		'Armoured Fist Company': 'Varksian Infantry',
		'Salamander Command Vehicle': 'Salamander Commander Vehicle',
		'Salamander Commander Vehicle': 'Salamander Commander Vehicle',
		'0-1 Deathstrike Battery': 'Death Strike Laucher',
		'Deathstrike Battery': 'Death Strike Laucher',
		'Deathstrike missile launchers': 'Death Strike Laucher',
		'Deathstrike Launcher': 'Death Strike Laucher',
		'Death Strike Launcher': 'Death Strike Laucher',
		'Death Strike Laucher': 'Death Strike Laucher',
		'Fire Support Platoon': 'Varksian Fire Support Squad',
		'Support Squads': 'Varksian Fire Support Squad',
		'Fire Support Squad': 'Varksian Fire Support Squad',
		'Varksian Fire Support Squad': 'Varksian Fire Support Squad',
		'Infantry Reinforcements': 'Varksian Infantry',
		'Infantry Units': 'Varksian Infantry',
		'Tank Squadron': 'Leman Russ',
		'Leman Russ Demolisher': 'Leman Russ Demolisher',
		'Hellhound Squadron': 'Hellhounds',
		'Hellhound': 'Hellhounds',
		'Hellhounds': 'Hellhounds',
		'Griffon Squadron': 'Griffon',
		'Griffons': 'Griffon',
		'Griffon': 'Griffon',
		'Ogryn Berserkers': 'Orygns Berserkers',
		'Ogryn Beserkers': 'Orygns Berserkers',
		'Ogryns Berserkers': 'Orygns Berserkers',
		'Orygns Berserkers': 'Orygns Berserkers',
		'Flak': 'Hydra',
		'Alpha Legion Retinue': 'Alpha Legion Space Marine',
		'Alpha Legion Space Marine units': 'Alpha Legion Space Marine',
		'Alpha Legion Space Marine': 'Alpha Legion Space Marine',
		'Alpha Legion Lord': 'Alpha Legion Lord',
		'Rhinos': 'Alpha Legion Rhino',
		'Alpha Legion Rhino': 'Alpha Legion Rhino',
		'Hell Blade Squadron': 'HellBlade',
		'Hell Blades': 'HellBlade',
		'Hell Blade': 'HellBlade',
		'HellBlade': 'HellBlade',
		'Hell Talon Squadron': 'Helltalon',
		'Hell Talons': 'Helltalon',
		'Hell Talon': 'Helltalon',
		'Helltalon': 'Helltalon',
		'Harbinger Bomber': 'Hell Bringer',
		'Harbinger': 'Hell Bringer',
		'Hell Bringer': 'Hell Bringer',
		'Hellbringer': 'Hell Bringer',
		'Chaos Warhounds': 'Vraks Warhound',
		'Chaos Warhound Pack': 'Vraks Warhound',
		'Chaos Warhound Titan': 'Vraks Warhound',
		'Chaos Warhound': 'Vraks Warhound',
		'Vraks Warhound': 'Vraks Warhound',
		'Chaos Reaver Titan': 'Vraks Reaver',
		'Chaos Reaver': 'Vraks Reaver',
		'Vraks Reaver': 'Vraks Reaver',
		'Chaos Warlord Titan': 'Vraks Warlord',
		'Chaos Warlord': 'Vraks Warlord',
		'Vraks Warlord': 'Vraks Warlord',
		'Enforcer': 'Enforcer'
	}
});

ArmyforgeUnitProfiles.vraksianTraitorsAdditionalProfilesForFormation = function(formation) {
	var extras = [];
	var listId = ArmyforgeUI.urlData ? ArmyforgeUI.urlData.list : null;
	if (listId != 'CHAOS_VraksianTraitors_NETEA' || !formation || !formation.type) {
		return extras;
	}

	var formationName = formation.type.name || '';
	function add(name) {
		if (name) {
			extras.push(name);
		}
	}

	if (/^(1\.1\s*)?Regimental HQ$/i.test(formationName)) {
		add('Supreme Commander');
		add('Varksian Infantry');
	}
	else if (/^Infantry Company$/i.test(formationName)) {
		add('Commander');
		add('Varksian Infantry');
	}
	else if (/^Leman Russ Tank Company$/i.test(formationName)) {
		add('Leman Russ');
		add('Leman Russ Vanquisher');
	}
	else if (/^0-1 Malcador Tank Company$/i.test(formationName)) {
		add('Malcador Tank');
		add('Malcador Defender Tank');
		add('Malcador Annihilator Tank');
	}
	else if (/^Artillery Company/i.test(formationName)) {
		add('Basilisk');
	}
	else if (/^Artillery Squadron$/i.test(formationName)) {
		add('Basilisk');
		add('Bombard');
		add('Manticores');
	}
	else if (/^Sentinel Squadron$/i.test(formationName)) {
		add('Sentinal');
	}
	else if (/^Flak Battery$/i.test(formationName)) {
		add('Hydra');
	}
	else if (/^Disciples of Xaphan$/i.test(formationName)) {
		add('Disciples of Xaphan');
		add('Chimera');
	}
	else if (/^Heavy Artillery Squadron$/i.test(formationName)) {
		add('Minotaur Artillery Tank');
	}
	else if (/^Tank Hunter Squadron - Valdor Tank Hunters$/i.test(formationName)) {
		add('Valdor Tank Hunter');
	}
	else if (/^Tank Hunter Squadron - Leman Russ Destroyers$/i.test(formationName)) {
		add('Leman Russ Tank Destroyer');
	}
	else if (/^Tank Hunter Squadron/i.test(formationName)) {
		add('Valdor Tank Hunter');
		add('Leman Russ Tank Destroyer');
	}
	else if (/^Armored Fist Company$/i.test(formationName) || /^Armoured Fist Company$/i.test(formationName)) {
		add('Varksian Infantry');
		add('Chimera');
		add('Salamander Commander Vehicle');
	}
	else if (/^0-1 Deathstrike Battery$/i.test(formationName)) {
		add('Death Strike Laucher');
	}
	else if (/^Alpha Legion Retinue$/i.test(formationName)) {
		add('Alpha Legion Space Marine');
		add('Alpha Legion Lord');
		add('Alpha Legion Rhino');
	}
	else if (/^Hell Blade Squadron$/i.test(formationName)) {
		add('HellBlade');
	}
	else if (/^Hell Talon Squadron$/i.test(formationName)) {
		add('Helltalon');
	}
	else if (/^Harbinger Bomber$/i.test(formationName)) {
		add('Hell Bringer');
	}
	else if (/^Chaos Warhound/i.test(formationName) || /^Chaos Warhounds$/i.test(formationName)) {
		add('Vraks Warhound');
	}
	else if (/^Chaos Reaver Titan$/i.test(formationName)) {
		add('Vraks Reaver');
	}
	else if (/^Chaos Warlord Titan$/i.test(formationName)) {
		add('Vraks Warlord');
	}

	formation.upgrades.uniq().each(function(upgrade) {
		var upgradeName = upgrade && upgrade.name ? upgrade.name : '';
		if (/chimera/i.test(upgradeName)) {
			add('Chimera');
		}
		if (/vanquisher/i.test(upgradeName)) {
			add('Leman Russ Vanquisher');
		}
		if (/malcador defender/i.test(upgradeName)) {
			add('Malcador Defender Tank');
		}
		if (/malcador annihilator/i.test(upgradeName)) {
			add('Malcador Annihilator Tank');
		}
		if (/malcador tank/i.test(upgradeName)) {
			add('Malcador Tank');
		}
		if (/leman russ demolisher/i.test(upgradeName)) {
			add('Leman Russ Demolisher');
		}
		if (/leman russ tank destroyer/i.test(upgradeName) || /destroyers?/i.test(upgradeName)) {
			add('Leman Russ Tank Destroyer');
		}
		if (/leman russ/i.test(upgradeName)) {
			add('Leman Russ');
		}
		if (/basilisk/i.test(upgradeName)) {
			add('Basilisk');
		}
		if (/bombard/i.test(upgradeName)) {
			add('Bombard');
		}
		if (/manticore/i.test(upgradeName)) {
			add('Manticores');
		}
		if (/sentinel/i.test(upgradeName)) {
			add('Sentinal');
		}
		if (/hydra/i.test(upgradeName)) {
			add('Hydra');
		}
		if (/disciples of xaphan/i.test(upgradeName)) {
			add('Disciples of Xaphan');
		}
		if (/minotaur/i.test(upgradeName)) {
			add('Minotaur Artillery Tank');
		}
		if (/valdor/i.test(upgradeName)) {
			add('Valdor Tank Hunter');
		}
		if (/deathstrike/i.test(upgradeName)) {
			add('Death Strike Laucher');
		}
		if (/salamander/i.test(upgradeName)) {
			add('Salamander Commander Vehicle');
		}
		if (/alpha legion space marine/i.test(upgradeName)) {
			add('Alpha Legion Space Marine');
		}
		if (/alpha legion lord/i.test(upgradeName)) {
			add('Alpha Legion Lord');
		}
		if (/rhino/i.test(upgradeName)) {
			add('Alpha Legion Rhino');
		}
		if (/hell ?blade/i.test(upgradeName)) {
			add('HellBlade');
		}
		if (/hell ?talon/i.test(upgradeName)) {
			add('Helltalon');
		}
		if (/harbinger/i.test(upgradeName)) {
			add('Hell Bringer');
		}
		if (/warhound/i.test(upgradeName)) {
			add('Vraks Warhound');
		}
		if (/reaver/i.test(upgradeName)) {
			add('Vraks Reaver');
		}
		if (/warlord/i.test(upgradeName)) {
			add('Vraks Warlord');
		}
		if (/support squad/i.test(upgradeName)) {
			add('Varksian Fire Support Squad');
		}
		if (/infantry/i.test(upgradeName)) {
			add('Varksian Infantry');
		}
		if (/hellhound/i.test(upgradeName)) {
			add('Hellhounds');
		}
		if (/griffon/i.test(upgradeName)) {
			add('Griffon');
		}
		if (/ogryn/i.test(upgradeName)) {
			add('Orygns Berserkers');
		}
		if (/flak/i.test(upgradeName)) {
			add('Hydra');
		}
	});

	return extras.uniq();
};
