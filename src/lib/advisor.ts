const API_URL = "https://api.spaceidle.xyz/suggest_fleet_battle/";
const SHIP_BASE =
    "https://raw.githubusercontent.com/StuntHacks/usi-wiki/refs/heads/master/png/ships/";

export const GRID_IMAGES: Record<string, string> = {
    corvette:       "https://raw.githubusercontent.com/StuntHacks/usi-wiki/refs/heads/master/png/fleet_formations/corvette.png",
    frigate:        "https://raw.githubusercontent.com/StuntHacks/usi-wiki/refs/heads/master/png/fleet_formations/frigate.png",
    fighters:       "https://raw.githubusercontent.com/StuntHacks/usi-wiki/refs/heads/master/png/fleet_formations/fighters.png",
    cruiser:        "https://raw.githubusercontent.com/StuntHacks/usi-wiki/refs/heads/master/png/fleet_formations/cruiser.png",
    single_cruiser: "https://raw.githubusercontent.com/StuntHacks/usi-wiki/refs/heads/master/png/fleet_formations/single_cruiser.png",
    heavy_cruiser:  "https://raw.githubusercontent.com/StuntHacks/usi-wiki/refs/heads/master/png/fleet_formations/heavy_cruiser.png",
};

export const MOD_MAP: Record<string, { name: string; icon: string }> = {
    CorvetteChargeLaserMod:  { name: "Corvette Charge Laser",    icon: "Datacore" },
    ShieldMod:               { name: "Shield (reduced damage)",   icon: "CorvetteShieldMod" },
    FrigateMissileMod:       { name: "Frigate Missiles",         icon: "ArmorPiercing" },
    ArmorMod:                { name: "Armor (reduced damage)",    icon: "ShieldRegenStart" },
    FighterMiniRailgunMod:   { name: "Fighter Mini Railgun",     icon: "ArmorDamageSynergy" },
    CruiserSingleArmorTank:  { name: "Single Armored Cruiser",   icon: "PristineArmor" },
    HeavyCruiserBeamMod:     { name: "Heavy Cruiser Beam Laser", icon: "PowerMode" },
};

export interface Hazard {
    id: string;
    node: string;
    type: string;
}

export interface Battle {
    id: string;
    name: string;
    color?: string;
    hazard?: Hazard[];
    boss?: unknown;
}

export interface Galaxy {
    id: string;
    name: string;
    battles: Battle[];
    minStats: number;
    maxStats: number;
    step: number;
}

export interface AdvisorShip {
    name: string;
    position: { x: number; y: number };
    mods: string[];
}

export interface ParsedAdvisor {
    fr_used: number;
    fr_committed: number;
    boss_damage?: number;
    ships: AdvisorShip[];
}

export async function fetchAdvisors(params: {
    battleId: string;
    combatStat: number;
    hasBoss: boolean;
    hazardIds: string[];
}): Promise<ParsedAdvisor[]> {
    const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            combat_stat_level: params.combatStat,
            fleet_event_id: params.battleId,
            version: 99999999,
            has_boss: params.hasBoss,
            hazard_node_list: params.hazardIds.join(""),
        }),
    });

    if (response.status === 404) return [];

    const data = await response.json() as string[] | null;
    if (!data) return [];

    let parsed = data
        .map(parseAdvisor)
        .filter((a) => !a.boss_damage || a.boss_damage >= 0);

    parsed = dedupeAdvisors(parsed);
    parsed.sort((a, b) => a.fr_used - b.fr_used);
    return parsed;
}

function parseAdvisor(input: string): ParsedAdvisor {
    let v2 = false;
    if (input.startsWith("V2")) {
        v2 = true;
        input = input.substring(2);
    }

    const split = input.split("|");
    const first = split[0].split(",");
    const fr_used = parseFloat(first[0]);
    const fr_committed = parseInt(first[1]);
    split.splice(0, 2);

    let boss_damage: number | undefined = undefined;
    const ships: AdvisorShip[] = [];

    for (const ship of split) {
        if (!ship.includes(";")) {
            boss_damage = parseFloat(ship);
            break;
        }
        const splitShip = ship.split(";");
        if (splitShip[0] === "Null") continue;

        const mods = splitShip[1].split(",");
        const posStr = splitShip[2];
        if (!posStr) continue;

        const positions = posStr.split(v2 ? "*" : ".");
        for (const p of positions) {
            const coords = p.split(",");
            ships.push({
                name: splitShip[0],
                position: { x: parseInt(coords[0]), y: parseInt(coords[1]) },
                mods,
            });
        }
    }

    return { fr_used, fr_committed, boss_damage, ships };
}

export function shipNameToClass(name: string): string {
    const map: Record<string, string> = {
        Corvette:     "corvette",
        Frigate:      "frigate",
        Fighter:      "fighters",
        Cruiser:      "cruiser",
        HeavyCruiser: "heavy_cruiser",
    };
    return map[name] ?? "";
}

export function shipNameToDisplayName(name: string): string {
    if (name === "HeavyCruiser") return "Heavy Cruiser";
    return name;
}

export function shipImage(cls: string): string | null {
    const map: Record<string, string> = {
        corvette:      "Ship_Basic.png",
        frigate:       "Ship_Frigate.png",
        fighters:      "Ship_Fighter.png",
        cruiser:       "Ship_Cruiser.png",
        heavy_cruiser: "Ship_HeavyCruiser.png",
    };
    return map[cls] ? SHIP_BASE + map[cls] : null;
}

function dedupeAdvisors(arr: ParsedAdvisor[]): ParsedAdvisor[] {
    return arr.filter(
        (item, idx, self) =>
            idx === self.findIndex((o) => JSON.stringify(o) === JSON.stringify(item))
    );
}
