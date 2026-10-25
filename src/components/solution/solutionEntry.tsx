import { useRef } from "react";
import { getGalaxyUnlocks } from "../../lib/battles";
import { Solution } from "../../lib/types";
import styles from "./solution.module.scss";

const getUnlockName = (galaxyId: number, unlock: string) => {
    return getGalaxyUnlocks(galaxyId).find((u) => u.code === unlock)?.name ?? unlock;
}

export const formatStats = (stats: number) => `${Number.isInteger(stats) ? stats.toFixed(1) : stats}x`;

const getBossInfo = (s: Solution) => {
    if (s.boss_alive === false) return "Boss dead";
    if (s.shots) return s.shots === 1 ? "Oneshot" : `${s.shots} shots`;
    if (s.boss_alive) return "Boss alive";
    return null;
}

export function Extras({ solution: s }: { solution: Solution }) {
    const purchases = Object.entries(s.purchases ?? {});

    return (
        <>
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
        </>
    );
}

export function SolutionEntry({ solution, obsolete = false, onOpen, preloadImages, isAdmin, battleName }: { solution: Solution, obsolete?: boolean, onOpen: (s: Solution) => void, preloadImages: boolean, isAdmin: boolean, battleName?: string }) {
    const s = solution;
    const perShot = !!s.shots && s.shots > 1;
    const bossInfo = getBossInfo(s);
    const purchases = Object.entries(s.purchases ?? {});
    const verified = s.verified_at != null;
    const hasData = verified || s.support || s.hazards || !!bossInfo || s.non_standard || obsolete;

    const pressedAt = useRef<{ x: number, y: number } | null>(null);
    const open = (e: React.MouseEvent) => {
        const start = pressedAt.current;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
        onOpen(s);
    };

    return (
        <div
            className={`${styles.solution} ${obsolete ? styles.obsolete : ""} ${s.flagged && isAdmin ? styles.flagged : ""}`}
            role="button"
            tabIndex={0}
            onMouseDown={(e) => { pressedAt.current = { x: e.clientX, y: e.clientY }; }}
            onClick={open}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault();
                onOpen(s);
            }}
        >
            <div className={styles.screenshot}>
                {solution.screenshot_url && preloadImages && <img src={solution.screenshot_url} loading="lazy" alt="Solution screenshot" />}
                <div className={styles.info}>
                    <span className={styles.stats} title="Combat stats">
                        {formatStats(s.combat_stats)}
                    </span>
                    <span className={styles.resources} title={perShot ? 'FR used per shot / committed' : 'FR used / committed'}>
                        {s.fr_used}
                        {s.fr_committed != null && <span className={styles.small}> / {s.fr_committed}</span>}
                        <span className={styles.small}> FR{perShot && '/shot'}</span>
                    </span>
                </div>
            </div>
            {(battleName || hasData || purchases.length > 0 || s.unlocks?.length > 0 || s.notes) && (
                <div className={styles.details}>
                    {battleName && <div className={styles.battleLabel}>{battleName}</div>}
                    {hasData && (
                        <div className={styles.data}>
                            {(verified || s.support || s.hazards || obsolete) && (
                                <div className={styles.modifiers}>
                                    {verified && <span className={styles.verified}>Verified</span>}
                                    {s.support && <span className={styles.support}>Support</span>}
                                    {s.hazards && <span className={styles.hazard}>Hazard</span>}
                                    {obsolete && <span className={styles.obsoleteLabel}>Obsolete</span>}
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
                    <Extras solution={s} />
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
