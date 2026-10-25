import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { Modal } from "../components/modal/modal";
import { SolutionColumn, SolutionColumns } from "../components/solution/solutionColumns";
import { SolutionEntry } from "../components/solution/solutionEntry";
import { SolutionPopup } from "../components/solution/solutionPopup";
import { useAdminSession, useFlaggedSolutions, useSelectedSolution } from "../lib/hooks";
import { findBattle, galaxies } from "../lib/battles";
import { Solution } from "../lib/types";
import styles from "./galaxy.module.scss";

const battleIndex = (s: Solution) => galaxies[s.galaxy_id - 1]?.battles.findIndex((b) => b.id === s.battle_id) ?? -1;

export default function FlaggedView() {
    const session = useAdminSession();
    const isAdmin = !!session;
    const navigate = useNavigate();
    const solutions = useFlaggedSolutions();
    const listRef = useRef<HTMLDivElement>(null);
    const { selectedId, openSolution, closeSolution } = useSelectedSolution();

    useEffect(() => {
        if (session === null) navigate('/');
    }, [session, navigate]);

    const byGalaxy = useMemo(() => {
        const result: Record<number, Solution[]> = {};
        for (const s of solutions.solutions) (result[s.galaxy_id] ??= []).push(s);
        for (const list of Object.values(result)) list.sort((a, b) => battleIndex(a) - battleIndex(b));
        return result;
    }, [solutions.solutions]);

    const selected = solutions.solutions.find((s) => s.id === selectedId) ?? null;

    const refreshSolutions = () => { solutions.reload().catch(() => {}); };

    const handleScroll = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        if (!listRef.current) return;
        listRef.current.scrollLeft += e.deltaY * 1.0;
    }

    if (!isAdmin) return <BaseLayout />;

    return (
        <BaseLayout>
            {solutions.loading && <p className={styles.info}>Loading...</p>}
            {solutions.error && <p className={styles.error}>Error loading solutions</p>}
            {!solutions.loading && !solutions.error && (
                <>
                    <div className={styles.menuBar}>
                        <div className={styles.scrollable} onWheel={handleScroll}>
                            ← Scroll here →
                        </div>
                    </div>
                    <SolutionColumns ref={listRef}>
                        {!solutions.solutions.length && <p className={styles.info}>No flagged solutions</p>}
                        {Object.entries(byGalaxy).map(([galaxyId, list]) => (
                            <SolutionColumn key={galaxyId} title={`Galaxy ${galaxyId}`} count={list.length}>
                                {list.map((s) => (
                                    <SolutionEntry
                                        solution={s}
                                        key={s.id}
                                        obsolete={s.rank_in_group != null && s.rank_in_group > 1}
                                        onOpen={openSolution}
                                        preloadImages
                                        isAdmin={isAdmin}
                                        battleName={findBattle(s.galaxy_id, s.battle_id)?.name ?? s.battle_id}
                                    />
                                ))}
                            </SolutionColumn>
                        ))}
                    </SolutionColumns>
                </>
            )}
            <Modal open={!!selected} onClose={closeSolution}>
                {selected && (
                    <SolutionPopup
                        key={selected.id}
                        solution={selected}
                        isAdmin={isAdmin}
                        onFlagsChanged={() => { closeSolution(); refreshSolutions(); }}
                        onVerified={refreshSolutions}
                        onDeleted={() => { closeSolution(); refreshSolutions(); }}
                    />
                )}
            </Modal>
        </BaseLayout>
    );
}
