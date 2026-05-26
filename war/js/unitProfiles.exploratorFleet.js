// Source: war/source-json/explorator-fleet.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeExploratorFleetName = ArmyforgeUnitProfiles.normalizeExploratorFleetName || function(displayName) {
	if (!displayName) {
		return '';
	}
	return String(displayName).toLowerCase()
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/[’']/g, '')
		.replace(/^\s*\d+\s*[–-]\s*\d+\s*/g, ' ')
		.replace(/^\s*\d+\s*[xX]?\s*/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.strip();
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'exploratorFleet',
	findFunctionName: 'findExploratorFleetProfileByName',
	armyIds: ['AMTL_MarsPrime_NETEA'],
	sourceJsonPaths: ['./source-json/explorator-fleet.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeExploratorFleetName,
	aliases: {
		'Arch Magos': 'Explorator Archmagos',
		'Archmagos': 'Explorator Archmagos',
		'Commander': 'Tech-Priest Dominus',
		'Tech Priest Dominus': 'Tech-Priest Dominus',
		'Tech-Priest Dominus': 'Tech-Priest Dominus',
		'Magos': 'Explorator Magos',
		'Vanguard Maniple': 'Skitarii Vanguard',
		'Skorpius Cohort': 'Skorpius Disintegrator',
		'Skorpius Disintegrators': 'Skorpius Disintegrator',
		'Ranger Centuria': 'Skitarii Rangers',
		'Ironstrider Cavaliers': 'Ironstrider Ballistarius',
		'Ironstriders': 'Ironstrider Ballistarius',
		'Sydonian Dragoons': 'Sydonian Dragoon',
		'Dragoons': 'Sydonian Dragoon',
		'Ruststalker Killclade': 'Sicarian Ruststalkers',
		'Infiltrator Killclade': 'Sicarian Infiltrators',
		'Fulgurite Maniple': 'Electro-Priests',
		'Fulgurite Electro-Priests': 'Electro-Priests',
		'Electro-Priests': 'Electro-Priests',
		'Hounds': 'Serberys Sulphurhounds',
		'Pteraxii Maniple': 'Pteraxii',
		'Onager Cohort': 'Onager Dunecrawler',
		'Onagers': 'Onager Dunecrawler',
		'Kastelan Maniple': 'Kastelan Robots',
		'Cybernetica Datasmith': 'Cybernetica Datasmith',
		'Destroyer Maniple': 'Kataphron Destroyer',
		'Kataphron Destroyers': 'Kataphron Destroyer',
		'Breacher Maniple': 'Kataphron Breacher',
		'Kataphron Breachers': 'Kataphron Breacher',
		'Knights': 'Knight Paladin',
		'Warhound Pack': 'Warhound Class Titan',
		'Reaver': 'Reaver Class Titan',
		'Avenger Strike Fighter': 'Avenger Strike Fighters',
		'Avenger Strike Fighters': 'Avenger Strike Fighters',
		'Ark Mechanicus Battleship': 'Ark Mechanicus Battleship',
		'Secutarii Hoplites': 'Secutarii Hoplite',
		'Secutarii Hoplite': 'Secutarii Hoplite',
		'Secutarii Peltasts': 'Secutarii Peltasts',
		'Skitarii Rangers': 'Skitarii Rangers',
		'Skorpius Duneriders': 'Skorpius Dunerider',
		'Subterranean Assault': 'Termite Assault Drill',
		'Termite Assault Drills': 'Termite Assault Drill',
		'Archaeopters': 'Archaeopter',
		'Seneschal': 'Seneschal',
		'Knight Paladin': 'Knight Paladin',
		'Knight Errant': 'Knight Errant',
		'Warhound Class Titan': 'Warhound Class Titan'
	}
});
