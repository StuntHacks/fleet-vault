import { Navigate, useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { useSolutions } from "../lib/hooks";
import { Battle } from "../lib/advisor";
import { ConditionNode, galaxies, getConditionNodes } from "../lib/battles";
import type { Solution } from "../lib/types";

function conditions(s: Solution, battle: Battle | undefined): string[] {
    const { hazards, supports } = getConditionNodes(battle);
    const label = (nodes: ConditionNode[], id: string) => nodes.find((n) => n.id === id)?.label ?? id;
    const result: string[] = [];
    if (s.hazards) {
        result.push(s.hazard_nodes.length ? `Hazard: ${s.hazard_nodes.map((id) => label(hazards, id)).join(", ")}` : "Hazard");
    }
    if (s.support) {
        result.push(s.support_nodes.length ? `Support: ${s.support_nodes.map((id) => label(supports, id)).join(", ")}` : "Support");
    }
    if (s.boss_alive !== null) {
        result.push(s.boss_alive ? "Boss alive" : "Boss defeated");
    }
    if (s.unlocks?.length) {
        result.push(`Unlocked: ${s.unlocks.join(", ")}`);
    }
    return result;
}

function details(s: Solution): string[] {
    const result: string[] = [];
    const boss = [
        s.shots ? (s.shots === 1 ? "One shot" : `${s.shots} shots`) : null,
        s.fr_total != null ? `${s.fr_total} FR total` : null,
        s.boss_damage != null ? `${s.boss_damage} damage` : null,
    ].filter(Boolean);
    if (boss.length) result.push(boss.join(" · "));

    const purchases = Object.entries(s.purchases ?? {});

    if (purchases.length) result.push(`Purchases: ${purchases.map(([node, ship]) => (ship === "none" ? `no ${node}` : `${node} ${ship}`)).join(", ")}`);
    if (s.non_standard) result.push("Non-standard path");
    return result;
}

function SolutionItem({ solution: s, battle }: { solution: Solution; battle: Battle | undefined }) {
    return (
        <li>
            {s.screenshot_url && (
                <a href={s.screenshot_url} target="_blank" rel="noopener noreferrer">
                    <img src={s.screenshot_url} alt="screenshot" style={{ maxWidth: "300px" }} />
                </a>
            )}
            <p>Combat Stats: {s.combat_stats}</p>
            <p>FR Used{s.shots && s.shots > 1 ? " (per shot)" : ""}: {s.fr_used}</p>
            {s.fr_committed != null && <p>FR Committed: {s.fr_committed}</p>}
            {conditions(s, battle).map((c) => <p key={c}>{c}</p>)}
            {details(s).map((d) => <p key={d}>{d}</p>)}
            {s.notes && <p>Notes: {s.notes}</p>}
        </li>
    );
}

export default function BattleView() {
    const { galaxy, battle } = useParams();
    let id = parseInt(galaxy || "1", 10);
    id = Math.min(Math.max(id, 1), galaxies.length);
    if (isNaN(id)) {
        id = 1;
    }

    const legacyIndex = /^\d+$/.test(battle ?? "") ? parseInt(battle!, 10) : undefined;
    const battleKey = legacyIndex !== undefined ? galaxies[id - 1].battles[legacyIndex]?.id : battle;
    const battleData = galaxies[id - 1].battles.find((b) => b.id === battleKey);

    const solutions = useSolutions(id, battleKey ?? "");

    if (legacyIndex !== undefined && battleData) {
        return <Navigate to={`/g/${id}/b/${battleData.id}`} replace />;
    }

    if (!battleData) {
        return (
            <BaseLayout>
                <p>Unknown battle</p>
            </BaseLayout>
        );
    }

    return (
        <BaseLayout>
            {solutions.loading && <p>Loading...</p>}
            {solutions.error && <p>Error loading solutions</p>}
            {!solutions.loading && !solutions.error && (
                <>
                    <h1>Best</h1>
                    <ul>
                        {solutions.best.map((s) => <SolutionItem key={s.id} solution={s} battle={battleData} />)}
                    </ul>
                    <h1>Obsolete</h1>
                    <ul>
                        {solutions.obsolete.map((s) => <SolutionItem key={s.id} solution={s} battle={battleData} />)}
                    </ul>
                    {solutions.flagged.length > 0 && (
                        <>
                            <h1>Flagged</h1>
                            <ul>
                                {solutions.flagged.map((s) => <SolutionItem key={s.id} solution={s} battle={battleData} />)}
                            </ul>
                        </>
                    )}
                </>
            )}
        </BaseLayout>
    );
}
