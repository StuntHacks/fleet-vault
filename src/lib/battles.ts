import galaxyData from "../data.json";
import { Battle, Galaxy, PurchaseNode } from "./advisor";

export const galaxies = galaxyData.galaxies as Galaxy[];

export interface ConditionNode {
    id: string;
    label: string;
}

export interface Unlock {
    code: string;
    name: string;
}

const GALAXY_UNLOCKS: Record<number, Unlock[]> = {
    1: [{ code: "FP", name: "Starting Frigate" }],
    2: [{ code: "CL", name: "Charge Laser" }, { code: "MI", name: "Missiles" }],
    3: [{ code: "AR", name: "Frigate Armor" }, { code: "SH", name: "Corvette Shield" }],
    4: [{ code: "MR", name: "Mini Railgun" }, { code: "FP", name: "Starting Fighter" }],
    5: [{ code: "AT", name: "Cruiser Armor Tank" }, { code: "CP", name: "Starting Cruiser" }],
    6: [{ code: "BE", name: "Heavy Cruiser Beam" }, { code: "HP", name: "Starting Heavy Cruiser" }],
    8: [{ code: "HL", name: "Starting Heavy Cruiser" }, { code: "CL", name: "Starting Cruiser" }],
    9: [{ code: "PC", name: "Particle Cannon" }],
    11: [{ code: "CRF", name: "Corvette Rapid Fire" }, { code: "TM", name: "Temporary Corvette Burst" }],
    12: [{ code: "FHB", name: "Frigate Health Boost" }, { code: "TM", name: "Temporary Frigate Shotgun" }],
};

export const SHIPS_BY_CLASS: Record<PurchaseNode["class"], string[]> = {
    light: ["Corvette", "Frigate", "Fighter"],
    medium: ["Cruiser", "Heavy Cruiser"],
};

export function getGalaxyPurchases(galaxyId: number | undefined): PurchaseNode[] {
    return galaxyId ? getGalaxyData(galaxyId)?.purchases ?? [] : [];
}

export function getGalaxyUnlocks(galaxyId: number | undefined): Unlock[] {
    return galaxyId ? GALAXY_UNLOCKS[galaxyId] ?? [] : [];
}

export function getGalaxyData(galaxyId: number): Galaxy | undefined {
    return galaxies[galaxyId - 1];
}

export function findBattle(galaxyId: number, battleKey: string): Battle | undefined {
    return getGalaxyData(galaxyId)?.battles.find((b) => b.id === battleKey);
}

export function getConditionNodes(battle: Battle | undefined): { hazards: ConditionNode[]; supports: ConditionNode[] } {
    const hazards: ConditionNode[] = [];
    const supports: ConditionNode[] = [];
    const types: Record<string, string[]> = {};

    for (const h of battle?.hazard ?? []) {
        if (h.id === battle?.id) continue;
        if (!types[h.id]) {
            types[h.id] = [];
            (h.support ? supports : hazards).push({ id: h.id, label: h.node });
        }
        types[h.id].push(h.type);
    }

    for (const node of [...hazards, ...supports]) {
        node.label = `${node.label} (${types[node.id].join(", ")})`;
    }
    return { hazards, supports };
}

export function isBossBattle(battle: Battle | undefined): boolean {
    return !!battle?.boss;
}
