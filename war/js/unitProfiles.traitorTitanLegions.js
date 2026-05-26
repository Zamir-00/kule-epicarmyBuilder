// Source: war/source-json/traitor-titan-legions.json

var ArmyforgeUnitProfiles = ArmyforgeUnitProfiles || {};

ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsName = ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsName || function(displayName) {
	if (!displayName) {
		return '';
	}
	return String(displayName).toLowerCase()
		.replace(/<[^>]*>/g, ' ')
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/[’']/g, '')
		.replace(/[-–—]/g, ' ')
		.replace(/&/g, ' ')
		.replace(/\bhell\s+blades?\b/g, 'hell blade')
		.replace(/\bhell\s+talons?\b/g, 'hell talon')
		.replace(/\bwarhounds?\b/g, 'warhound')
		.replace(/\bsubjugators?\b/g, 'subjugator')
		.replace(/\bquestors?\b/g, 'questor')
		.replace(/\bdefilers?\b/g, 'defiler')
		.replace(/\bgreater\s+brass\s+scorpions?\b/g, 'greater brass scorpion')
		.replace(/\bdaemon\s+knights?\b/g, 'daemon knight')
		.replace(/\bchaos\s+knights?\b/g, 'chaos knight')
		.replace(/\bfleshhounds?\b/g, 'flesh hounds')
		.replace(/\bfighter-bombers?\b/g, 'fighter bomber')
		.replace(/\bfighters?\b/g, 'fighter')
		.replace(/\bbombers?\b/g, 'bomber')
		.replace(/\bgreater\s+daemon\s+possession\b/g, 'greater daemon possession')
		.replace(/\beye\s+of\s+the\s+gods\b/g, 'eye of the gods')
		.replace(/\bchaos\s+undivided\b/g, 'chaos undivided')
		.replace(/\b(?:0-1|1-3)\b/g, ' ')
		.replace(/\b(?:formation|formations|company|companies|retinue|retinues|squadron|squadrons|battery|batteries|engine|engines|pack|pool|upgrade|upgrades|option|options|unit|units|class|army|support|battle|scout|close|combat|weapon|weapons|arm|carapace|head|tail|only|onlynly|of|the|a|an|any|one|two|three|four|five|six|seven|eight|nine|ten|with|and|or|plus|per|for|may|take|add|replace|configuration|configurations)\b/g, ' ')
		.replace(/\b(?:khorne|nurgle|slaanesh|tzeentch)\b/g, function(match) { return match; })
		.replace(/\bretlaxi[-\s]*pattern\b/g, 'retlaxi pattern')
		.replace(/\bharbringer\b/g, 'harbringer')
		.replace(/\s+/g, ' ')
		.strip();
};

ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsSelectionName = ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsSelectionName || function(displayName) {
	if (!displayName) {
		return '';
	}
	var text = String(displayName).toLowerCase()
		.replace(/<[^>]*>/g, ' ')
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.replace(/[’']/g, '')
		.replace(/[-–—]/g, ' ')
		.replace(/&/g, ' ');
	while (/\([^()]*\)/.test(text)) {
		text = text.replace(/\([^()]*\)/g, ' ');
	}
	text = text.replace(/[()]/g, ' ');
	text = text
		.replace(/\bgreater\s+daemon\s+possession\b/g, ' ')
		.replace(/\beye\s+of\s+the\s+gods\b/g, ' ')
		.replace(/\bchaos\s+undivided\b/g, ' ')
		.replace(/\bhell\s+blades?\b/g, 'hell blade')
		.replace(/\bhell\s+talons?\b/g, 'hell talon')
		.replace(/\bwarhounds?\b/g, 'warhound')
		.replace(/\bdefilers?\b/g, 'defiler')
		.replace(/\bsubjugators?\b/g, 'subjugator')
		.replace(/\bquestors?\b/g, 'questor')
		.replace(/\bgreater\s+brass\s+scorpions?\b/g, 'greater brass scorpion')
		.replace(/\bhell\s+scourges?\b/g, 'hell-scourge')
		.replace(/\bhell\s+knights?\b/g, 'hell-knight')
		.replace(/\bhell\s+striders?\b/g, 'hell-strider')
		.replace(/\brenegade\s+knights?\b/g, 'renegade knight')
		.replace(/\bmauler\s+knights?\b/g, 'mauler knight')
		.replace(/\bdecay\s+knights?\b/g, 'decay knight')
		.replace(/\bchange\s+knights?\b/g, 'change knight')
		.replace(/\bdaemonic\s+assault\s+engines?\b/g, 'daemonic assault engine')
		.replace(/\b(?:support|battle|scout|close\s+combat|weapon|weapons|arm|carapace|only|onlynly)\b/g, ' ')
		.replace(/\b(?:formation|formations|company|companies|retinue|retinues|squadron|squadrons|battery|batteries|engine|engines|pack|pool|upgrade|upgrades|option|options|unit|units|class|army|of|the|a|an|any|one|two|three|four|five|six|seven|eight|nine|ten|with|and|or|plus|per|for|may|take|add|replace|configuration|configurations)\b/g, ' ')
		.replace(/\b(?:x|×)\s*\d+\b/g, ' ')
		.replace(/\b\d+\s*(?:x|×)\b/g, ' ')
		.replace(/\s+/g, ' ')
		.strip();
	return text;
};

ArmyforgeUnitProfiles.traitorTitanLegionsLookupCanonicalProfile = function(canonicalName) {
	if (!canonicalName) {
		return null;
	}
	var normalized = ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsName(canonicalName);
	var faction = ArmyforgeUnitProfiles.traitorTitanLegions;
	if (!faction) {
		return null;
	}
	var key = faction.nameToKey[normalized] || faction.nameToKey[normalized.replace(/\s+/g, '')];
	if (!key) {
		return null;
	}
	return faction.profiles[key] || null;
};

ArmyforgeUnitProfiles.traitorTitanLegionsResolveExactBuilderName = function(displayName) {
	var text = displayName ? String(displayName) : '';
	if (!text) {
		return null;
	}
	var exactMatches = [
		[/^CARRION LORD\b/i, 'Chaos Emperor Titan'],
		[/^SKULLHOARDER\b/i, 'Chaos Emperor Titan'],
		[/^VICEKEEPER\b/i, 'Chaos Emperor Titan'],
		[/^BLIGHTSPREADER\b/i, 'Chaos Emperor Titan'],
		[/^GIFTGRANTER\b/i, 'Chaos Emperor Titan'],
		[/^FORGELORD\b/i, 'Chaos Warlord Titan'],
		[/^BANELORD\b/i, 'Chaos Warlord Titan'],
		[/^PAINLORD\b/i, 'Chaos Warlord Titan'],
		[/^PLAGUELORD\b/i, 'Chaos Warlord Titan'],
		[/^WARPLORD\b/i, 'Chaos Warlord Titan'],
		[/^HERALD\b/i, 'Chaos Reaver Titan'],
		[/^RAVAGER\b/i, 'Chaos Reaver Titan'],
		[/^REVILER\b/i, 'Chaos Reaver Titan'],
		[/^REPUGNANT\b/i, 'Chaos Reaver Titan'],
		[/^MUTATOR\b/i, 'Chaos Reaver Titan'],
		[/^FORGEHOUND\b/i, 'Chaos Warhound Titan'],
		[/^FERAL WARHOUND\b/i, 'Chaos Warhound Titan'],
		[/^PLAGUEHOUND\b/i, 'Chaos Warhound Titan'],
		[/^WARPHOUND\b/i, 'Chaos Warhound Titan'],
		[/^DEATH WHEEL\b/i, 'Retlaxi Pattern Death Wheel'],
		[/^LORD OF BATTLES\b/i, 'Lord of Battles'],
		[/^GREATER BRASS SCORPION\b/i, 'Greater Brass Scorpion'],
		[/^SUBJUGATOR\b/i, 'Subjugator Titan'],
		[/^QUESTOR\b/i, 'Questor Titan'],
		[/^DAEMON KNIGHTS.*HELL-?SCOURGES?\b/i, 'Hell-Scourge'],
		[/^DAEMON KNIGHTS.*HELL-?KNIGHTS?\b/i, 'Hell-Knight'],
		[/^DAEMON KNIGHTS.*HELL-?STRIDERS?\b/i, 'Hell-Strider'],
		[/^CHAOS KNIGHTS \(Chaos Undivided\)/i, 'Renegade Knight of Chaos Undivided'],
		[/^CHAOS KNIGHTS \(Khorne\)/i, 'Mauler Knight of Khorne'],
		[/^CHAOS KNIGHTS \(Nurgle\)/i, 'Decay Knight of Nurgle'],
		[/^CHAOS KNIGHTS \(Tzeentch\)/i, 'Change Knight of Tzeentch'],
		[/^DAEMON ASSAULT ENGINES?\b/i, 'Daemonic Assault Engine'],
		[/^DEFILERS \(Chaos Undivided\)/i, 'Retlaxi Pattern Defiler (Chaos Undivided)'],
		[/^DEFILERS \(Nurgle\)/i, 'Retlaxi Pattern Defiler (Nurgle)'],
		[/^DEFILERS \(Tzeentch\)/i, 'Retlaxi Pattern Defiler (Tzeentch)'],
		[/^DAEMONIC ARTILLERY\b/i, 'Cannon of Khorne'],
		[/^HELL BLADE SQUADRON\b/i, 'Hell Blade'],
		[/^HELL TALON SQUADRON\b/i, 'Hell Talon'],
		[/^HARBRINGER BOMBER\b/i, 'Harbringer Bomber'],
		[/^CHAOS BATTLESHIP\b/i, 'Despoiler Class Battleship'],
		[/^GREATER DAEMON POSSESSION\b/i, 'Greater Daemon Possession'],
		[/^EYE OF THE GODS\b/i, 'Eye of the Gods'],
		[/^LESSER DAEMON POOL\b/i, 'Bloodletters of Khorne']
	];
	var match = null;
	exactMatches.find(function(entry) {
		if (entry[0].test(text)) {
			match = entry[1];
			return true;
		}
		return false;
	});
	return match;
};

ArmyforgeUnitProfiles.registerFaction({
	namespace: 'traitorTitanLegions',
	findFunctionName: 'findTraitorTitanLegionsProfileByName',
	armyIds: ['CHAOS_titans_NETEA'],
	sourceJsonPaths: ['./source-json/traitor-titan-legions.json'],
	normalizer: ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsName,
	aliases: {
		'CARRION LORD   (Chaos Emperor Titan of Chaos Undivided)': 'Chaos Emperor Titan',
		'SKULLHOARDER   (Chaos Emperor Titan of Khorne)': 'Chaos Emperor Titan',
		'VICEKEEPER   (Chaos Emperor Titan of Slaanesh)': 'Chaos Emperor Titan',
		'BLIGHTSPREADER   (Chaos Emperor Titan of Nurgle)': 'Chaos Emperor Titan',
		'GIFTGRANTER   (Chaos Emperor Titan of Tzeentch)': 'Chaos Emperor Titan',
		'FORGELORD   (Chaos Warlord Titan of Chaos Undivided)': 'Chaos Warlord Titan',
		'BANELORD (Chaos Warlord Titan of Khorne)': 'Chaos Warlord Titan',
		'PAINLORD  (Chaos Warlord Titan of Slaanesh)': 'Chaos Warlord Titan',
		'PLAGUELORD (Chaos Warlord Titan of Nurgle)': 'Chaos Warlord Titan',
		'WARPLORD  (Chaos Warlord Titan of Tzeentch)': 'Chaos Warlord Titan',
		'HERALD (Chaos Reaver Titan of Chaos Undivided)': 'Chaos Reaver Titan',
		'RAVAGER (Chaos Reaver Titan of Khorne)': 'Chaos Reaver Titan',
		'REVILER (Chaos Reaver Titan of Slaanesh)': 'Chaos Reaver Titan',
		'REPUGNANT (Chaos Reaver Titan of Nurgle)': 'Chaos Reaver Titan',
		'MUTATOR (Chaos Reaver Titan of Tzeentch)': 'Chaos Reaver Titan',
		'FORGEHOUND (Chaos Warhound of Chaos Undivided)': 'Chaos Warhound Titan',
		'FORGEHOUND Pack (Chaos Warhounds of Chaos Undivided)': 'Chaos Warhound Titan',
		'FERAL WARHOUND Pack (Chaos Warhounds of Khorne)': 'Chaos Warhound Titan',
		'PLAGUEHOUND (Chaos Warhound of Nurgle)': 'Chaos Warhound Titan',
		'PLAGUEHOUND Pack (Chaos Warhounds of Nurgle)': 'Chaos Warhound Titan',
		'WARPHOUND (Chaos Warhound of Tzeentch)': 'Chaos Warhound Titan',
		'WARPHOUND Pack (Chaos Warhounds of Tzeentch)': 'Chaos Warhound Titan',
		'DEATH WHEEL (Chaos Undivided)': 'Retlaxi Pattern Death Wheel',
		'LORD OF BATTLES (Khorne)': 'Lord of Battles',
		'GREATER BRASS SCORPION (Khorne)': 'Greater Brass Scorpion',
		'SUBJUGATOR (Slaanesh)': 'Subjugator Titan',
		'QUESTOR (Slaanesh)': 'Questor Titan',
		'DAEMON KNIGHTS Hell-Scourges (Slaanesh)': 'Hell-Scourge',
		'DAEMON KNIGHTS Hell-Knights (Slaanesh)': 'Hell-Knight',
		'DAEMON KNIGHTS Hell-Striders (Slaanesh)': 'Hell-Strider',
		'CHAOS KNIGHTS (Chaos Undivided)': 'Renegade Knight of Chaos Undivided',
		'CHAOS KNIGHTS (Khorne)': 'Mauler Knight of Khorne',
		'CHAOS KNIGHTS (Nurgle)': 'Decay Knight of Nurgle',
		'CHAOS KNIGHTS (Tzeentch)': 'Change Knight of Tzeentch',
		'DAEMON ASSAULT ENGINES (Khorne)': 'Daemonic Assault Engine',
		'DEFILERS (Chaos Undivided)': 'Retlaxi Pattern Defiler (Chaos Undivided)',
		'DEFILERS (Nurgle)': 'Retlaxi Pattern Defiler (Nurgle)',
		'DEFILERS (Tzeentch)': 'Retlaxi Pattern Defiler (Tzeentch)',
		'DAEMONIC ARTILLERY (Khorne)': 'Cannon of Khorne',
		'LESSER DAEMON POOL': 'Bloodletters of Khorne',
		'HELL BLADE SQUADRON': 'Hell Blade',
		'HELL TALON SQUADRON': 'Hell Talon',
		'HARBRINGER BOMBER': 'Harbringer Bomber',
		'CHAOS BATTLESHIP': 'Despoiler Class Battleship',
		'Carrion Lord Class': 'Chaos Emperor Titan',
		'Carrion Lord': 'Chaos Emperor Titan',
		'Chaos Emperor Titan': 'Chaos Emperor Titan',
		'Skullhoarder': 'Chaos Emperor Titan',
		'Vicekeeper': 'Chaos Emperor Titan',
		'Blightspreader': 'Chaos Emperor Titan',
		'Giftgranter': 'Chaos Emperor Titan',
		'Forgelord Class': 'Chaos Warlord Titan',
		'Forgelord': 'Chaos Warlord Titan',
		'Chaos Warlord Titan': 'Chaos Warlord Titan',
		'Banelord': 'Chaos Warlord Titan',
		'Painlord': 'Chaos Warlord Titan',
		'Plaguelord': 'Chaos Warlord Titan',
		'Warplord': 'Chaos Warlord Titan',
		'Herald Class': 'Chaos Reaver Titan',
		'Herald': 'Chaos Reaver Titan',
		'Chaos Reaver Titan': 'Chaos Reaver Titan',
		'Ravager': 'Chaos Reaver Titan',
		'Reviler': 'Chaos Reaver Titan',
		'Repugnant': 'Chaos Reaver Titan',
		'Mutator': 'Chaos Reaver Titan',
		'Forgehound Class': 'Chaos Warhound Titan',
		'Forgehound': 'Chaos Warhound Titan',
		'Chaos Warhound Titan': 'Chaos Warhound Titan',
		'Chaos Warhound': 'Chaos Warhound Titan',
		'Feral Warhound': 'Chaos Warhound Titan',
		'Plaguehound': 'Chaos Warhound Titan',
		'Warphound': 'Chaos Warhound Titan',
		'Death Wheel': 'Retlaxi Pattern Death Wheel',
		'Retlaxi Death Wheel': 'Retlaxi Pattern Death Wheel',
		'Retlaxi Pattern Death Wheel': 'Retlaxi Pattern Death Wheel',
		'Lord of Battles': 'Lord of Battles',
		'Greater Brass Scorpions': 'Greater Brass Scorpion',
		'Greater Brass Scorpion': 'Greater Brass Scorpion',
		'Subjugators': 'Subjugator Titan',
		'Subjugator': 'Subjugator Titan',
		'Subjugator Titan': 'Subjugator Titan',
		'Questors': 'Questor Titan',
		'Questor': 'Questor Titan',
		'Questor Titan': 'Questor Titan',
		'Daemon Knights of Slaanesh': 'Hell-Scourge',
		'Hell-Scourges': 'Hell-Scourge',
		'Hell-Scourge': 'Hell-Scourge',
		'Hell-Knights': 'Hell-Knight',
		'Hell-Knight': 'Hell-Knight',
		'Hell-Striders': 'Hell-Strider',
		'Hell-Strider': 'Hell-Strider',
		'Chaos Knights': 'Renegade Knight of Chaos Undivided',
		'Renegade Knights': 'Renegade Knight of Chaos Undivided',
		'Renegade Knight': 'Renegade Knight of Chaos Undivided',
		'Renegade Knight of Chaos Undivided': 'Renegade Knight of Chaos Undivided',
		'Mauler Knights': 'Mauler Knight of Khorne',
		'Mauler Knight': 'Mauler Knight of Khorne',
		'Mauler Knight of Khorne': 'Mauler Knight of Khorne',
		'Decay Knights': 'Decay Knight of Nurgle',
		'Decay Knight': 'Decay Knight of Nurgle',
		'Decay Knight of Nurgle': 'Decay Knight of Nurgle',
		'Change Knights': 'Change Knight of Tzeentch',
		'Change Knight': 'Change Knight of Tzeentch',
		'Change Knight of Tzeentch': 'Change Knight of Tzeentch',
		'Daemonic Assault Engine': 'Daemonic Assault Engine',
		'Daemonic Assault Engines': 'Daemonic Assault Engine',
		'Defilers (Chaos Undivided)': 'Retlaxi Pattern Defiler (Chaos Undivided)',
		'Defilers (Nurgle)': 'Retlaxi Pattern Defiler (Nurgle)',
		'Defilers (Tzeentch)': 'Retlaxi Pattern Defiler (Tzeentch)',
		'Retlaxi Pattern Defiler': 'Retlaxi Pattern Defiler (Chaos Undivided)',
		'Daemonic Artillery': 'Cannon of Khorne',
		'Cannons of Khorne': 'Cannon of Khorne',
		'Cannon of Khorne': 'Cannon of Khorne',
		'Lesser Daemon Pool': 'Bloodletters of Khorne',
		'Bloodletters': 'Bloodletters of Khorne',
		'Bloodletters of Khorne': 'Bloodletters of Khorne',
		'Plaguebearers': 'Plaguebearers of Nurgle',
		'Plaguebearers of Nurgle': 'Plaguebearers of Nurgle',
		'Daemonettes': 'Daemonettes of Slaanesh',
		'Daemonettes of Slaanesh': 'Daemonettes of Slaanesh',
		'Flamers': 'Flamers of Tzeentch',
		'Flamers of Tzeentch': 'Flamers of Tzeentch',
		'Daemonic Beasts': 'Daemonic Beasts of Chaos Undivided',
		'Daemonic Beasts of Chaos Undivided': 'Daemonic Beasts of Chaos Undivided',
		'Screamers': 'Screamers of Tzeentch',
		'Screamers of Tzeentch': 'Screamers of Tzeentch',
		'Flesh Hounds': 'Flesh Hounds of Khorne',
		'Fleshhounds': 'Flesh Hounds of Khorne',
		'Flesh Hounds of Khorne': 'Flesh Hounds of Khorne',
		'Daemonettes on Steeds': 'Daemonettes on Steeds',
		'Hell Blade Squadron': 'Hell Blade',
		'Hell Blade Fighters': 'Hell Blade',
		'Hell Blades': 'Hell Blade',
		'Hell Blade': 'Hell Blade',
		'Hell Talon Squadron': 'Hell Talon',
		'Hell Talon Fighter-Bombers': 'Hell Talon',
		'Hell Talons': 'Hell Talon',
		'Hell Talon': 'Hell Talon',
		'Harbringer': 'Harbringer Bomber',
		'Harbinger': 'Harbringer Bomber',
		'Harbringer Bomber': 'Harbringer Bomber',
		'Harbinger Bomber': 'Harbringer Bomber',
		'0-1 Chaos Battleship': 'Despoiler Class Battleship',
		'Chaos Battleship': 'Despoiler Class Battleship',
		'Despoiler Battleship': 'Despoiler Class Battleship',
		'Despoiler Class Battleship': 'Despoiler Class Battleship',
		'Greater Daemon Possession': 'Greater Daemon Possession',
		'0-1 Greater Daemon Possession': 'Greater Daemon Possession',
		'Eye of the Gods': 'Eye of the Gods',
		'0-1 Eye of the Gods': 'Eye of the Gods',
		'Command Head': 'Command Head',
		'Battle Head': 'Battle Head',
		'Void Head': 'Void Head',
		'Daemon Maw': 'Daemon Maw',
		'Plague Maw': 'Plague Maw',
		'Gun Tail': 'Gun Tail',
		'Razor Tail': 'Razor Tail',
		'Retlaxi Cyclone': 'Retlaxi Cyclone',
		'Cannon of Chaos': 'Cannon of Chaos',
		'Havoc Vortex Missiles': 'Havoc Vortex Missiles',
		'Havoc Warp Missiles': 'Havoc Warp Missiles',
		'Chaos Plasma Incinerator': 'Chaos Plasma Incinerator',
		'Hellstrike Cannon': 'Hellstrike Cannon',
		'Beam of Change': 'Beam of Change',
		'Heavy Plague Mortar': 'Heavy Plague Mortar',
		'Beam of Ecstasy': 'Beam of Ecstasy',
		'Retlaxi Trident': 'Retlaxi Trident',
		'Heretek Shrine': 'Heretek Shrine',
		'Battle Titan CC Weapon': 'Battle Titan CC Weapon',
		'Havoc Barrage Missiles': 'Havoc Barrage Missiles',
		'Chaos Plasma Cremator': 'Chaos Plasma Cremator',
		'Doom Burner': 'Doom Burner',
		'Doom Fist': 'Doom Fist',
		'Mangler': 'Mangler',
		'Tzeentch Cannon': 'Tzeentch Cannon',
		'Coruscant Hail': 'Coruscant Hail',
		'Corruption Cannon': 'Corruption Cannon',
		'Plague Flail': 'Plague Flail',
		'Rot Cannon': 'Rot Cannon',
		'Sonic Devastator': 'Sonic Devastator',
		'Musk Flail': 'Musk Flail',
		'Chaos Reaper Mega Bolter': 'Chaos Reaper Mega Bolter',
		'Hellmouth': 'Hellmouth',
		'Chaos Plasma Furnace': 'Chaos Plasma Furnace',
		'Death Storm': 'Death Storm',
		'Ursus Claw': 'Ursus Claw',
		'Gaze of Tzeentch': 'Gaze of Tzeentch',
		'Arcane Cannons': 'Arcane Cannons',
		'Pus Cannon': 'Pus Cannon',
		'Boil Cannon': 'Boil Cannon'
	}
});

// Add selection-normalizer alias entries for all aliases.
// In the original IIFE every alias was registered with includeSelectionNormalization=true,
// which adds selectionNormalized and selectionCompact forms to nameToKey.
// registerFaction only uses the primary normalizer, so we replay the selection-normalizer
// pass here for all aliases whose selectionNormalized form differs from the primary one.
(function() {
	var faction = ArmyforgeUnitProfiles.traitorTitanLegions;
	var normalizer = ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsName;
	var selectionNormalizer = ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsSelectionName;

	function addSelectionAlias(alias, targetName) {
		var targetKey = normalizer(targetName).replace(/\s+/g, '_');
		if (!targetKey) {
			return;
		}
		var selNorm = selectionNormalizer(alias);
		if (selNorm) {
			faction.nameToKey[selNorm] = targetKey;
			var selCompact = selNorm.replace(/\s+/g, '');
			if (selCompact) {
				faction.nameToKey[selCompact] = targetKey;
			}
		}
	}

	// Replay selection-normalization for all aliases (same list as registerFaction above).
	var aliases = {
		'CARRION LORD   (Chaos Emperor Titan of Chaos Undivided)': 'Chaos Emperor Titan',
		'SKULLHOARDER   (Chaos Emperor Titan of Khorne)': 'Chaos Emperor Titan',
		'VICEKEEPER   (Chaos Emperor Titan of Slaanesh)': 'Chaos Emperor Titan',
		'BLIGHTSPREADER   (Chaos Emperor Titan of Nurgle)': 'Chaos Emperor Titan',
		'GIFTGRANTER   (Chaos Emperor Titan of Tzeentch)': 'Chaos Emperor Titan',
		'FORGELORD   (Chaos Warlord Titan of Chaos Undivided)': 'Chaos Warlord Titan',
		'BANELORD (Chaos Warlord Titan of Khorne)': 'Chaos Warlord Titan',
		'PAINLORD  (Chaos Warlord Titan of Slaanesh)': 'Chaos Warlord Titan',
		'PLAGUELORD (Chaos Warlord Titan of Nurgle)': 'Chaos Warlord Titan',
		'WARPLORD  (Chaos Warlord Titan of Tzeentch)': 'Chaos Warlord Titan',
		'HERALD (Chaos Reaver Titan of Chaos Undivided)': 'Chaos Reaver Titan',
		'RAVAGER (Chaos Reaver Titan of Khorne)': 'Chaos Reaver Titan',
		'REVILER (Chaos Reaver Titan of Slaanesh)': 'Chaos Reaver Titan',
		'REPUGNANT (Chaos Reaver Titan of Nurgle)': 'Chaos Reaver Titan',
		'MUTATOR (Chaos Reaver Titan of Tzeentch)': 'Chaos Reaver Titan',
		'FORGEHOUND (Chaos Warhound of Chaos Undivided)': 'Chaos Warhound Titan',
		'FORGEHOUND Pack (Chaos Warhounds of Chaos Undivided)': 'Chaos Warhound Titan',
		'FERAL WARHOUND Pack (Chaos Warhounds of Khorne)': 'Chaos Warhound Titan',
		'PLAGUEHOUND (Chaos Warhound of Nurgle)': 'Chaos Warhound Titan',
		'PLAGUEHOUND Pack (Chaos Warhounds of Nurgle)': 'Chaos Warhound Titan',
		'WARPHOUND (Chaos Warhound of Tzeentch)': 'Chaos Warhound Titan',
		'WARPHOUND Pack (Chaos Warhounds of Tzeentch)': 'Chaos Warhound Titan',
		'DEATH WHEEL (Chaos Undivided)': 'Retlaxi Pattern Death Wheel',
		'LORD OF BATTLES (Khorne)': 'Lord of Battles',
		'GREATER BRASS SCORPION (Khorne)': 'Greater Brass Scorpion',
		'SUBJUGATOR (Slaanesh)': 'Subjugator Titan',
		'QUESTOR (Slaanesh)': 'Questor Titan',
		'DAEMON KNIGHTS Hell-Scourges (Slaanesh)': 'Hell-Scourge',
		'DAEMON KNIGHTS Hell-Knights (Slaanesh)': 'Hell-Knight',
		'DAEMON KNIGHTS Hell-Striders (Slaanesh)': 'Hell-Strider',
		'CHAOS KNIGHTS (Chaos Undivided)': 'Renegade Knight of Chaos Undivided',
		'CHAOS KNIGHTS (Khorne)': 'Mauler Knight of Khorne',
		'CHAOS KNIGHTS (Nurgle)': 'Decay Knight of Nurgle',
		'CHAOS KNIGHTS (Tzeentch)': 'Change Knight of Tzeentch',
		'DAEMON ASSAULT ENGINES (Khorne)': 'Daemonic Assault Engine',
		'DEFILERS (Chaos Undivided)': 'Retlaxi Pattern Defiler (Chaos Undivided)',
		'DEFILERS (Nurgle)': 'Retlaxi Pattern Defiler (Nurgle)',
		'DEFILERS (Tzeentch)': 'Retlaxi Pattern Defiler (Tzeentch)',
		'DAEMONIC ARTILLERY (Khorne)': 'Cannon of Khorne',
		'LESSER DAEMON POOL': 'Bloodletters of Khorne',
		'HELL BLADE SQUADRON': 'Hell Blade',
		'HELL TALON SQUADRON': 'Hell Talon',
		'HARBRINGER BOMBER': 'Harbringer Bomber',
		'CHAOS BATTLESHIP': 'Despoiler Class Battleship',
		'Carrion Lord Class': 'Chaos Emperor Titan',
		'Carrion Lord': 'Chaos Emperor Titan',
		'Chaos Emperor Titan': 'Chaos Emperor Titan',
		'Skullhoarder': 'Chaos Emperor Titan',
		'Vicekeeper': 'Chaos Emperor Titan',
		'Blightspreader': 'Chaos Emperor Titan',
		'Giftgranter': 'Chaos Emperor Titan',
		'Forgelord Class': 'Chaos Warlord Titan',
		'Forgelord': 'Chaos Warlord Titan',
		'Chaos Warlord Titan': 'Chaos Warlord Titan',
		'Banelord': 'Chaos Warlord Titan',
		'Painlord': 'Chaos Warlord Titan',
		'Plaguelord': 'Chaos Warlord Titan',
		'Warplord': 'Chaos Warlord Titan',
		'Herald Class': 'Chaos Reaver Titan',
		'Herald': 'Chaos Reaver Titan',
		'Chaos Reaver Titan': 'Chaos Reaver Titan',
		'Ravager': 'Chaos Reaver Titan',
		'Reviler': 'Chaos Reaver Titan',
		'Repugnant': 'Chaos Reaver Titan',
		'Mutator': 'Chaos Reaver Titan',
		'Forgehound Class': 'Chaos Warhound Titan',
		'Forgehound': 'Chaos Warhound Titan',
		'Chaos Warhound Titan': 'Chaos Warhound Titan',
		'Chaos Warhound': 'Chaos Warhound Titan',
		'Feral Warhound': 'Chaos Warhound Titan',
		'Plaguehound': 'Chaos Warhound Titan',
		'Warphound': 'Chaos Warhound Titan',
		'Death Wheel': 'Retlaxi Pattern Death Wheel',
		'Retlaxi Death Wheel': 'Retlaxi Pattern Death Wheel',
		'Retlaxi Pattern Death Wheel': 'Retlaxi Pattern Death Wheel',
		'Lord of Battles': 'Lord of Battles',
		'Greater Brass Scorpions': 'Greater Brass Scorpion',
		'Greater Brass Scorpion': 'Greater Brass Scorpion',
		'Subjugators': 'Subjugator Titan',
		'Subjugator': 'Subjugator Titan',
		'Subjugator Titan': 'Subjugator Titan',
		'Questors': 'Questor Titan',
		'Questor': 'Questor Titan',
		'Questor Titan': 'Questor Titan',
		'Daemon Knights of Slaanesh': 'Hell-Scourge',
		'Hell-Scourges': 'Hell-Scourge',
		'Hell-Scourge': 'Hell-Scourge',
		'Hell-Knights': 'Hell-Knight',
		'Hell-Knight': 'Hell-Knight',
		'Hell-Striders': 'Hell-Strider',
		'Hell-Strider': 'Hell-Strider',
		'Chaos Knights': 'Renegade Knight of Chaos Undivided',
		'Renegade Knights': 'Renegade Knight of Chaos Undivided',
		'Renegade Knight': 'Renegade Knight of Chaos Undivided',
		'Renegade Knight of Chaos Undivided': 'Renegade Knight of Chaos Undivided',
		'Mauler Knights': 'Mauler Knight of Khorne',
		'Mauler Knight': 'Mauler Knight of Khorne',
		'Mauler Knight of Khorne': 'Mauler Knight of Khorne',
		'Decay Knights': 'Decay Knight of Nurgle',
		'Decay Knight': 'Decay Knight of Nurgle',
		'Decay Knight of Nurgle': 'Decay Knight of Nurgle',
		'Change Knights': 'Change Knight of Tzeentch',
		'Change Knight': 'Change Knight of Tzeentch',
		'Change Knight of Tzeentch': 'Change Knight of Tzeentch',
		'Daemonic Assault Engine': 'Daemonic Assault Engine',
		'Daemonic Assault Engines': 'Daemonic Assault Engine',
		'Defilers (Chaos Undivided)': 'Retlaxi Pattern Defiler (Chaos Undivided)',
		'Defilers (Nurgle)': 'Retlaxi Pattern Defiler (Nurgle)',
		'Defilers (Tzeentch)': 'Retlaxi Pattern Defiler (Tzeentch)',
		'Retlaxi Pattern Defiler': 'Retlaxi Pattern Defiler (Chaos Undivided)',
		'Daemonic Artillery': 'Cannon of Khorne',
		'Cannons of Khorne': 'Cannon of Khorne',
		'Cannon of Khorne': 'Cannon of Khorne',
		'Lesser Daemon Pool': 'Bloodletters of Khorne',
		'Bloodletters': 'Bloodletters of Khorne',
		'Bloodletters of Khorne': 'Bloodletters of Khorne',
		'Plaguebearers': 'Plaguebearers of Nurgle',
		'Plaguebearers of Nurgle': 'Plaguebearers of Nurgle',
		'Daemonettes': 'Daemonettes of Slaanesh',
		'Daemonettes of Slaanesh': 'Daemonettes of Slaanesh',
		'Flamers': 'Flamers of Tzeentch',
		'Flamers of Tzeentch': 'Flamers of Tzeentch',
		'Daemonic Beasts': 'Daemonic Beasts of Chaos Undivided',
		'Daemonic Beasts of Chaos Undivided': 'Daemonic Beasts of Chaos Undivided',
		'Screamers': 'Screamers of Tzeentch',
		'Screamers of Tzeentch': 'Screamers of Tzeentch',
		'Flesh Hounds': 'Flesh Hounds of Khorne',
		'Fleshhounds': 'Flesh Hounds of Khorne',
		'Flesh Hounds of Khorne': 'Flesh Hounds of Khorne',
		'Daemonettes on Steeds': 'Daemonettes on Steeds',
		'Hell Blade Squadron': 'Hell Blade',
		'Hell Blade Fighters': 'Hell Blade',
		'Hell Blades': 'Hell Blade',
		'Hell Blade': 'Hell Blade',
		'Hell Talon Squadron': 'Hell Talon',
		'Hell Talon Fighter-Bombers': 'Hell Talon',
		'Hell Talons': 'Hell Talon',
		'Hell Talon': 'Hell Talon',
		'Harbringer': 'Harbringer Bomber',
		'Harbinger': 'Harbringer Bomber',
		'Harbringer Bomber': 'Harbringer Bomber',
		'Harbinger Bomber': 'Harbringer Bomber',
		'0-1 Chaos Battleship': 'Despoiler Class Battleship',
		'Chaos Battleship': 'Despoiler Class Battleship',
		'Despoiler Battleship': 'Despoiler Class Battleship',
		'Despoiler Class Battleship': 'Despoiler Class Battleship',
		'Greater Daemon Possession': 'Greater Daemon Possession',
		'0-1 Greater Daemon Possession': 'Greater Daemon Possession',
		'Eye of the Gods': 'Eye of the Gods',
		'0-1 Eye of the Gods': 'Eye of the Gods',
		'Command Head': 'Command Head',
		'Battle Head': 'Battle Head',
		'Void Head': 'Void Head',
		'Daemon Maw': 'Daemon Maw',
		'Plague Maw': 'Plague Maw',
		'Gun Tail': 'Gun Tail',
		'Razor Tail': 'Razor Tail',
		'Retlaxi Cyclone': 'Retlaxi Cyclone',
		'Cannon of Chaos': 'Cannon of Chaos',
		'Havoc Vortex Missiles': 'Havoc Vortex Missiles',
		'Havoc Warp Missiles': 'Havoc Warp Missiles',
		'Chaos Plasma Incinerator': 'Chaos Plasma Incinerator',
		'Hellstrike Cannon': 'Hellstrike Cannon',
		'Beam of Change': 'Beam of Change',
		'Heavy Plague Mortar': 'Heavy Plague Mortar',
		'Beam of Ecstasy': 'Beam of Ecstasy',
		'Retlaxi Trident': 'Retlaxi Trident',
		'Heretek Shrine': 'Heretek Shrine',
		'Battle Titan CC Weapon': 'Battle Titan CC Weapon',
		'Havoc Barrage Missiles': 'Havoc Barrage Missiles',
		'Chaos Plasma Cremator': 'Chaos Plasma Cremator',
		'Doom Burner': 'Doom Burner',
		'Doom Fist': 'Doom Fist',
		'Mangler': 'Mangler',
		'Tzeentch Cannon': 'Tzeentch Cannon',
		'Coruscant Hail': 'Coruscant Hail',
		'Corruption Cannon': 'Corruption Cannon',
		'Plague Flail': 'Plague Flail',
		'Rot Cannon': 'Rot Cannon',
		'Sonic Devastator': 'Sonic Devastator',
		'Musk Flail': 'Musk Flail',
		'Chaos Reaper Mega Bolter': 'Chaos Reaper Mega Bolter',
		'Hellmouth': 'Hellmouth',
		'Chaos Plasma Furnace': 'Chaos Plasma Furnace',
		'Death Storm': 'Death Storm',
		'Ursus Claw': 'Ursus Claw',
		'Gaze of Tzeentch': 'Gaze of Tzeentch',
		'Arcane Cannons': 'Arcane Cannons',
		'Pus Cannon': 'Pus Cannon',
		'Boil Cannon': 'Boil Cannon'
	};

	for (var alias in aliases) {
		if (Object.prototype.hasOwnProperty.call(aliases, alias)) {
			addSelectionAlias(alias, aliases[alias]);
		}
	}
})();

// Override the auto-generated finder to add the exact-builder-name fast path and
// the selection-normalizer fallback, both of which the shared buildFinder does not provide.
ArmyforgeUnitProfiles.findTraitorTitanLegionsProfileByName = function(displayName, listId) {
	if (!displayName) {
		return null;
	}
	if (listId && !ArmyforgeUnitProfiles.traitorTitanLegions.armyIds.member(listId)) {
		return null;
	}
	var exactMatch = ArmyforgeUnitProfiles.traitorTitanLegionsResolveExactBuilderName(displayName);
	if (exactMatch) {
		var exactProfile = ArmyforgeUnitProfiles.traitorTitanLegionsLookupCanonicalProfile(exactMatch);
		if (exactProfile) {
			return exactProfile;
		}
	}
	var normalized = ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsName(displayName);
	var key = ArmyforgeUnitProfiles.traitorTitanLegions.nameToKey[normalized] || ArmyforgeUnitProfiles.traitorTitanLegions.nameToKey[normalized.replace(/\s+/g, '')];
	if (!key) {
		var selectionNormalized = ArmyforgeUnitProfiles.normalizeTraitorTitanLegionsSelectionName(displayName);
		key = ArmyforgeUnitProfiles.traitorTitanLegions.nameToKey[selectionNormalized] || ArmyforgeUnitProfiles.traitorTitanLegions.nameToKey[selectionNormalized.replace(/\s+/g, '')];
	}
	if (!key) {
		return null;
	}
	return ArmyforgeUnitProfiles.traitorTitanLegions.profiles[key] || null;
};

ArmyforgeUnitProfiles.traitorTitanLegionsAdditionalProfilesForFormation = function(formation) {
	var extras = [];
	var listId = ArmyforgeUI.urlData ? ArmyforgeUI.urlData.list : null;
	if (listId != 'CHAOS_titans_NETEA' || !formation || !formation.type) {
		return extras;
	}

	function add(name) {
		if (!name || extras.include(name)) {
			return;
		}
		extras.push(name);
	}

	function addMatchedCandidate(candidate) {
		var profile = ArmyforgeUnitProfiles.findTraitorTitanLegionsProfileByName(candidate, listId);
		if (profile) {
			add(profile.name);
		}
	}

	var formationName = formation.type.name || '';
	if (/lesser daemon pool/i.test(formationName)) {
		[
			'Bloodletters of Khorne',
			'Plaguebearers of Nurgle',
			'Daemonettes of Slaanesh',
			'Flamers of Tzeentch',
			'Daemonic Beasts of Chaos Undivided',
			'Screamers of Tzeentch',
			'Flesh Hounds of Khorne',
			'Daemonettes on Steeds'
		].each(add);
	}

	formation.upgrades.uniq().each(function(upgrade) {
		var upgradeName = upgrade && upgrade.name ? upgrade.name : '';
		if (!upgradeName) {
			return;
		}
		if (/greater daemon possession/i.test(upgradeName)) {
			add('Greater Daemon Possession');
		}
		if (/eye of the gods/i.test(upgradeName)) {
			add('Eye of the Gods');
		}
		String(upgradeName).replace(/&/g, '+').split(/[+,]/).each(function(part) {
			var cleaned = part ? part.strip() : '';
			if (!cleaned) {
				return;
			}
			addMatchedCandidate(cleaned);
		});
	});

	return extras.uniq();
};
