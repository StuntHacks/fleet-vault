import { Link, useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { useBattles } from "../lib/hooks";
import { galaxies } from "../lib/battles";
import styles from "./galaxy.module.scss";
import { useRef } from "react";

export default function GalaxyView() {
    const { galaxy } = useParams();
    let id = parseInt(galaxy || "1", 10);
    id = Math.min(Math.max(id, 1), galaxies.length);
    if (isNaN(id)) {
        id = 1;
    }
    const battles = useBattles(id);
    const listRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        if (!listRef.current) return;
        listRef.current.scrollLeft += e.deltaY * 1.0;
    }

    return (
        <BaseLayout>
            {battles.loading && <p className={styles.info}>Loading...</p>}
            {battles.error && <p className={styles.error}>Error loading battles</p>}
            {!battles.loading && !battles.error && (
                <>
                    <div className={styles.scrollable} onWheel={handleScroll}>
                        ← Scroll here →
                    </div>
                    <div className={styles.battles} ref={listRef}>
                        {galaxies[id - 1].battles.map((b) => (
                            <div className={styles.battle} key={b.id}>
                                <div className={styles.battleName}>{b.name}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </BaseLayout>
    );
}
