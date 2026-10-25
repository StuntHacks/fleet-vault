import { useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { Modal } from "../components/modal/modal";
import { useAdminSession, useGalaxySolutions, useSelectedSolution } from "../lib/hooks";
import { type RankedSolutions } from "../lib/api";
import { galaxies, isBossBattle } from "../lib/battles";
import styles from "./galaxy.module.scss";
import { useEffect, useMemo, useRef, useState } from "react";
import { Solution } from "../lib/types";
import { Checkbox } from "../components/checkbox/checkbox";
import { CombatStatInput } from "../components/combatStatInput/combatStatInput";
import { SolutionEntry } from "../components/solution/solutionEntry";
import { SolutionPopup } from "../components/solution/solutionPopup";
import { SolutionColumn, SolutionColumns } from "../components/solution/solutionColumns";

const statFilterKey = (galaxyId: number) => `fleetvault_stat_filter_${galaxyId}`;
const combatStatsKey = (galaxyId: number) => `fleetvault_combat_stats_${galaxyId}`;

const filterByStats = (solutions: RankedSolutions, stats: number | null): RankedSolutions => {
    if (stats == null) return solutions;
    const nearest = Math.max(...solutions.best.map((s) => s.combat_stats).filter((c) => c <= stats + 1e-6));
    const matches = (s: Solution) => Math.abs(s.combat_stats - nearest) < 1e-6;
    return {
        best: solutions.best.filter(matches),
        obsolete: solutions.obsolete.filter(matches),
        flagged: solutions.flagged.filter(matches),
    };
}

function Solutions({ solutions, onOpen, showObsolete, filtered, preloadImages, isAdmin, flaggedOnly }: { solutions: RankedSolutions, onOpen: (s: Solution) => void, showObsolete: boolean, filtered: boolean, preloadImages: boolean, isAdmin: boolean, flaggedOnly: boolean }) {
    if (!solutions.best.length) return <p className={styles.info}>{filtered ? "No solutions for these stats" : "No solutions yet"}</p>;
    const filteredBest = solutions.best.filter((s) => !flaggedOnly || s.flagged);
    const filteredObsolete = solutions.obsolete.filter((s) => !flaggedOnly || s.flagged);

    return (
        <>
            {filteredBest.map((s) => (
                <SolutionEntry solution={s} key={s.id} onOpen={onOpen} preloadImages={preloadImages} isAdmin={isAdmin} />
            ))}
            {showObsolete && filteredObsolete.length > 0 && (
                <>
                    <div className={styles.obsoleteHeader}> — Obsolete solutions — </div>
                    {filteredObsolete.map((s) => (
                        <SolutionEntry solution={s} key={s.id} obsolete onOpen={onOpen} preloadImages={preloadImages} isAdmin={isAdmin} />
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
    const isAdmin = !!useAdminSession();
    const listRef = useRef<HTMLDivElement>(null);
    const { selectedId, openSolution, closeSolution } = useSelectedSolution();

    const [showObsolete, setShowObsolete] = useState(() => localStorage.getItem('fleetvault_show_obsolete') === 'true');
    const [preloadImages, setPreloadImages] = useState(() => (localStorage.getItem('fleetvault_preload_images') ?? 'true') === 'true');
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [filter, setFilter] = useState(() => localStorage.getItem(statFilterKey(id)) === 'true');
    const [combatStats, setCombatStats] = useState(() => localStorage.getItem(combatStatsKey(id)) ?? "1");

    const parsedStats = parseFloat(combatStats);
    const statFilter = filter && !isNaN(parsedStats) ? parsedStats : null;

    useEffect(() => {
        setFilter(localStorage.getItem(statFilterKey(id)) === 'true');
        setCombatStats(localStorage.getItem(combatStatsKey(id)) ?? "1");
    }, [id]);

    const changeFilter = (value: boolean) => {
        setFilter(value);
        localStorage.setItem(statFilterKey(id), String(value));
    };

    const changeCombatStats = (value: string) => {
        setCombatStats(value);
        localStorage.setItem(combatStatsKey(id), value);
    };

    useEffect(() => {
        localStorage.setItem('fleetvault_show_obsolete', String(showObsolete));
    }, [showObsolete]);

    useEffect(() => {
        localStorage.setItem('fleetvault_preload_images', String(preloadImages));
    }, [preloadImages]);

    const selected = useMemo(() => {
        if (selectedId == null) return null;
        return Object.values(solutions.byBattle)
            .flatMap((r) => [...r.best, ...r.obsolete])
            .find((s) => s.id === selectedId) ?? null;
    }, [solutions.byBattle, selectedId]);

    const refreshSolutions = () => { solutions.reload().catch(() => {}); };

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
                    <div className={styles.menuBar}>
                        <div className={styles.settings}>
                            <Checkbox name="filterStats" checked={filter} onChange={changeFilter}>
                                Filter by stats
                            </Checkbox>
                            <CombatStatInput
                                value={combatStats}
                                onChange={changeCombatStats}
                                min={galaxies[id - 1].minStats ?? 1}
                                max={galaxies[id - 1].maxStats ?? 1}
                                step={galaxies[id - 1].step ?? 0.025}
                            />
                        </div>
                        <div className={styles.scrollable} onWheel={handleScroll}>
                            ← Scroll here →
                        </div>
                        <div className={styles.settings}>
                            <Checkbox name="showObsolete" checked={showObsolete} onChange={setShowObsolete}>
                                Show obsolete
                            </Checkbox>
                            <Checkbox name="preloadImages" checked={preloadImages} onChange={setPreloadImages}>
                                Preload images
                            </Checkbox>
                            {isAdmin && (
                                <Checkbox name="flaggedOnly" checked={flaggedOnly} onChange={setFlaggedOnly}>
                                    Show only flagged
                                </Checkbox>
                            )}
                        </div>
                    </div>
                    <SolutionColumns ref={listRef}>
                        {galaxies[id - 1].battles.map((b) => {
                            const results = filterByStats(solutions.forBattle(b.id), statFilter);

                            return (
                                <SolutionColumn key={b.id} title={b.name} boss={isBossBattle(b)} count={results.best.length}>
                                    <Solutions
                                        solutions={results}
                                        onOpen={openSolution}
                                        showObsolete={showObsolete}
                                        filtered={statFilter != null}
                                        preloadImages={preloadImages}
                                        flaggedOnly={flaggedOnly}
                                        isAdmin={isAdmin}
                                    />
                                </SolutionColumn>
                            );
                        })}
                    </SolutionColumns>
                </>
            )}
            <Modal open={!!selected} onClose={closeSolution}>
                {selected && (
                    <SolutionPopup
                        key={selected.id}
                        solution={selected}
                        isAdmin={isAdmin}
                        onUnflagged={refreshSolutions}
                        onDeleted={() => { closeSolution(); refreshSolutions(); }}
                    />
                )}
            </Modal>
        </BaseLayout>
    );
}
