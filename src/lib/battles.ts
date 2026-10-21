import galaxyData from "../data.json";
import { Battle, Galaxy } from "./advisor";

export const galaxies = galaxyData.galaxies as Galaxy[];

export interface ConditionNode {
    id: string;
    label: string;
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
        if (!types[h.id]) {
            types[h.id] = [];
            (h.node.startsWith("F") ? supports : hazards).push({ id: h.id, label: h.node });
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
