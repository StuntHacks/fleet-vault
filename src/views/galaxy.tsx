import { useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { useGalaxySolutions } from "../lib/hooks";
import type { RankedSolutions } from "../lib/api";
import { galaxies, getGalaxyUnlocks, isBossBattle } from "../lib/battles";
import styles from "./galaxy.module.scss";
import { useRef } from "react";
import { Solution } from "../lib/types";

const getUnlockName = (galaxyId: number, unlock: string) => {
    return getGalaxyUnlocks(galaxyId).find((u) => u.code === unlock)?.name ?? unlock;
}

const getBossInfo = (s: Solution) => {
    if (s.boss_alive === false) return "Boss dead";
    if (s.shots) return s.shots === 1 ? "Oneshot" : `${s.shots} shots`;
    if (s.boss_alive) return "Boss alive";
    return null;
}

function Entry({ solution, obsolete = false }: { solution: Solution, obsolete?: boolean }) {
    const s = solution;
    const perShot = !!s.shots && s.shots > 1;
    const bossInfo = getBossInfo(s);
    const purchases = Object.entries(s.purchases ?? {});
    const hasData = s.support || s.hazards || !!bossInfo;

    return (
        <div className={`${styles.solution} ${obsolete ? styles.obsolete : ""}`} key={s.id}>
            <div className={styles.screenshot}>
                {solution.screenshot_url && <img src={solution.screenshot_url} loading="lazy" alt="Solution screenshot" />}
                <div className={styles.info}>
                    <span className={styles.stats} title="Combat stats">
                        {`${Number.isInteger(s.combat_stats) ? s.combat_stats.toFixed(1) : s.combat_stats}x`}
                    </span>
                    <span className={styles.resources} title={perShot ? 'FR used per shot / committed' : 'FR used / committed'}>
                        {s.fr_used}
                        {s.fr_committed != null && <span className={styles.small}> / {s.fr_committed}</span>}
                        <span className={styles.small}> FR{perShot && '/shot'}</span>
                    </span>
                </div>
            </div>
            {(hasData || purchases.length > 0 || s.unlocks?.length > 0 || s.notes) && (
                <div className={styles.details}>
                    {hasData && (
                        <div className={styles.data}>
                            {(s.support || s.hazards) && (
                                <div className={styles.modifiers}>
                                    {s.support && <span className={styles.support}>Support</span>}
                                    {s.hazards && <span className={styles.hazard}>Hazard</span>}
                                </div>
                            )}
                            {bossInfo && (
                                <div className={styles.bossInfo}>
                                    <span>{bossInfo}</span>
                                </div>
                            )}
                            {s.non_standard && <span className={styles.nonStandard}>Non-standard path</span>}
                        </div>
                    )}
                    {purchases.length > 0 && (
                        <div className={styles.unlocks}>
                            <strong>Ship selection: </strong>
                            {purchases.map(([node, name], index) => (
                                <span key={`${s.id}-${node}-${index}`}>{node}: {name}</span>
                            ))}
                        </div>
                    )}
                    {(s.unlocks?.length > 0) && (
                        <div className={styles.unlocks}>
                            <strong>Required unlocks: </strong>
                            {s.unlocks.map((unlock, index) => (
                                <span key={`${s.id}-${unlock}-${index}`}>{getUnlockName(s.galaxy_id, unlock)}</span>
                            ))}
                        </div>
                    )}
                    {s.notes &&
                        <div className={styles.notes}>
                            <strong>Notes: </strong>{s.notes}
                        </div>
                    }
                </div>
            )}
        </div>
    )
}

function Solutions({ solutions }: { solutions: RankedSolutions }) {
    if (!solutions.best.length) return <p className={styles.info}>No solutions yet</p>;
    return (
        <>
            {solutions.best.map((s) => (
                <Entry solution={s} key={s.id} />
            ))}
            {solutions.obsolete.length > 0 && (
                <>
                    <div className={styles.obsoleteHeader}> — Obsolete solutions — </div>
                    {solutions.obsolete.map((s) => (
                        <Entry solution={s} key={s.id} obsolete />
                    ))}
                </>
            )}
        </>
    );
}

export default function GalaxyView() {
    const { galaxy } = useParams();
    let id = parseInt(galaxy || "1", 10);
    id = Math.min(Math.max(id, 1), galaxies.length);
    if (isNaN(id)) {
        id = 1;
    }
    const solutions = useGalaxySolutions(id);
    const listRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        if (!listRef.current) return;
        listRef.current.scrollLeft += e.deltaY * 1.0;
    }

    return (
        <BaseLayout>
            {solutions.loading && <p className={styles.info}>Loading...</p>}
            {solutions.error && <p className={styles.error}>Error loading solutions</p>}
            {!solutions.loading && !solutions.error && (
                <>
                    <div className={styles.scrollable} onWheel={handleScroll}>
                        ← Scroll here →
                    </div>
                    <div className={styles.battles} ref={listRef}>
                        {galaxies[id - 1].battles.map((b) => {
                            const results = solutions.forBattle(b.id);

                            return (
                                <div className={styles.battle} key={b.id}>
                                    <div className={styles.battleName}>
                                        {b.name}
                                        {isBossBattle(b) && <span className={styles.hasBoss}>Boss</span>}
                                        <span className={styles.count}>
                                            {results.best.length}
                                        </span>
                                    </div>
                                    <Solutions solutions={results} />
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </BaseLayout>
    );
}
