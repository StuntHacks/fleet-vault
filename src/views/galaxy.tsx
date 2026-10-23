import { useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { useGalaxySolutions } from "../lib/hooks";
import type { RankedSolutions } from "../lib/api";
import { galaxies } from "../lib/battles";
import styles from "./galaxy.module.scss";
import { useRef } from "react";
import { Solution } from "../lib/types";

function Entry({ solution, obsolete = false }: { solution: Solution, obsolete?: boolean }) {
    const s = solution;
    return (
        <div className={`${styles.solution} ${obsolete ? styles.obsolete : ""}`} key={s.id}>
            <img src={s.screenshot_url ?? ""} alt="Solution screenshot" />
            {s.combat_stats}x · {s.fr_used}{s.fr_committed ? ` / ${s.fr_committed}` : ""} FR
        </div>
    )
}

function Solutions({ solutions }: { solutions: RankedSolutions }) {
    if (!solutions.best.length) return <p>No solutions yet</p>;
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
                        {galaxies[id - 1].battles.map((b) => (
                            <div className={styles.battle} key={b.id}>
                                <div className={styles.battleName}>{b.name}</div>
                                <Solutions solutions={solutions.forBattle(b.id)} />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </BaseLayout>
    );
}
