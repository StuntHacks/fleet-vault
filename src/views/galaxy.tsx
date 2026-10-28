import { useNavigate, useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { Modal, ModalTarget } from "../components/modal/modal";
import { useAdminSession, useGalaxyAccess, useGalaxySolutions, useSelectedSolution } from "../lib/hooks";
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
import { GalaxyNotes } from "../components/galaxyNotes/galaxyNotes";
import { HiddenGalaxy } from "../components/hiddenGalaxy/hiddenGalaxy";

const statFilterKey = (galaxyId: number) => `fleetvault_stat_filter_${galaxyId}`;
const combatStatsKey = (galaxyId: number) => `fleetvault_combat_stats_${galaxyId}`;
const upToStatsKey = (galaxyId: number) => `fleetvault_up_to_stats_${galaxyId}`;

const nearestStats = (solutions: Solution[], stats: number) =>
    Math.max(...solutions.map((s) => s.combat_stats).filter((c) => c <= stats + 1e-6));

const highestFirst = (solutions: Solution[]) => [...solutions].sort((a, b) => b.combat_stats - a.combat_stats);

const filterByStats = (solutions: RankedSolutions, stats: number | null, upTo: boolean): RankedSolutions => {
    if (stats == null) return solutions;
    if (upTo) {
        const matches = (s: Solution) => s.combat_stats <= stats + 1e-6;
        return {
            best: highestFirst(solutions.best.filter(matches)),
            obsolete: highestFirst(solutions.obsolete.filter(matches)),
            flagged: solutions.flagged.filter(matches),
        };
    }
    const nearest = nearestStats(solutions.best, stats);
    const matches = (s: Solution) => Math.abs(s.combat_stats - nearest) < 1e-6;
    return {
        best: solutions.best.filter(matches),
        obsolete: solutions.obsolete.filter(matches),
        flagged: solutions.flagged.filter(matches),
    };
}

const pickBest = (solutions: Solution[], stats: number): Solution | null => {
    const nearest = nearestStats(solutions, stats);
    return solutions
        .filter((s) => Math.abs(s.combat_stats - nearest) < 1e-6)
        .sort((a, b) => Number(a.flagged) - Number(b.flagged)
            || a.fr_used - b.fr_used
            || Number(b.verified_at != null) - Number(a.verified_at != null))[0] ?? null;
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
    const access = useGalaxyAccess();
    const allowed = access.canView(id);
    const navigate = useNavigate();

    useEffect(() => {
        if (!access.loading && !allowed) navigate('/', { replace: true });
    }, [access.loading, allowed, navigate]);

    const listRef = useRef<HTMLDivElement>(null);
    const { selectedId, openSolution, switchSolution, closeSolution } = useSelectedSolution();

    const [showObsolete, setShowObsolete] = useState(() => localStorage.getItem('fleetvault_show_obsolete') === 'true');
    const [preloadImages, setPreloadImages] = useState(() => (localStorage.getItem('fleetvault_preload_images') ?? 'true') === 'true');
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [filter, setFilter] = useState(() => localStorage.getItem(statFilterKey(id)) === 'true');
    const [combatStats, setCombatStats] = useState(() => localStorage.getItem(combatStatsKey(id)) ?? "1");
    const [upToStats, setUpToStats] = useState(() => localStorage.getItem(upToStatsKey(id)) === 'true');

    const parsedStats = parseFloat(combatStats);
    const statFilter = filter && !isNaN(parsedStats) ? parsedStats : null;

    useEffect(() => {
        setFilter(localStorage.getItem(statFilterKey(id)) === 'true');
        setCombatStats(localStorage.getItem(combatStatsKey(id)) ?? "1");
        setUpToStats(localStorage.getItem(upToStatsKey(id)) === 'true');
    }, [id]);

    const changeFilter = (value: boolean) => {
        setFilter(value);
        localStorage.setItem(statFilterKey(id), String(value));
    };

    const changeUpToStats = (value: boolean) => {
        setUpToStats(value);
        localStorage.setItem(upToStatsKey(id), String(value));
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

    const listReady = !solutions.loading && !solutions.error && allowed;
    const scrolledTo = useRef<number | null>(null);

    useEffect(() => {
        if (!listReady || selectedId == null || scrolledTo.current === selectedId) return;

        const target =
            document.getElementById(`solution-${selectedId}`)
            ?? (selected && document.getElementById(`battle-${selected.battle_id}`));

        if (!target || !listRef.current) return;

        const align = scrolledTo.current == null ? "center" : "nearest";
        scrolledTo.current = selectedId;
        const scroll = () => target.scrollIntoView({ block: align, inline: align });

        const observer = new ResizeObserver(scroll);
        observer.observe(listRef.current);
        setTimeout(() => observer.disconnect(), 2000);
    }, [listReady, selectedId, selected]);

    const [navStats, setNavStats] = useState<number | null>(null);

    useEffect(() => {
        if (selectedId == null) setNavStats(null);
    }, [selectedId]);

    const neighbor = (direction: 1 | -1): ModalTarget | null => {
        if (!selected) return null;
        const battles = galaxies[id - 1].battles;
        const stats = navStats ?? selected.combat_stats;
        for (let i = battles.findIndex((b) => b.id === selected.battle_id) + direction; i >= 0 && i < battles.length; i += direction) {
            const best = pickBest(solutions.forBattle(battles[i].id).best, stats);
            if (best) return { title: battles[i].name, onSelect: () => { setNavStats(stats); switchSolution(best); } };
        }
        return null;
    };

    const columns = galaxies[id - 1].battles
        .map((b) => ({ battle: b, results: filterByStats(solutions.forBattle(b.id), statFilter, upToStats) }))
        .filter(({ results }) => !flaggedOnly || results.best.some((s) => s.flagged) || (showObsolete && results.obsolete.some((s) => s.flagged)));

    const refreshSolutions = () => { solutions.reload().catch(() => {}); };

    const handleScroll = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        if (!listRef.current) return;
        listRef.current.scrollLeft += e.deltaY * 1.0;
    }

    return (
        <BaseLayout>
            {(solutions.loading || !allowed) && <p className={styles.info}>Loading...</p>}
            {solutions.error && <p className={styles.error}>Error loading solutions</p>}
            {listReady && (
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
                            <Checkbox name="upToStats" checked={upToStats} onChange={changeUpToStats} disabled={!filter}>
                                Include lower stats
                            </Checkbox>
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
                    {isAdmin && access.isHidden(id) && <HiddenGalaxy galaxyId={id} />}
                    <GalaxyNotes galaxyId={id} isAdmin={isAdmin} />
                    <SolutionColumns ref={listRef}>
                        {flaggedOnly && !columns.length && <p className={styles.info}>No flagged solutions</p>}
                        {columns.map(({ battle: b, results }) => (
                            <SolutionColumn key={b.id} id={`battle-${b.id}`} title={b.name} boss={isBossBattle(b)} count={results.best.length}>
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
                        ))}
                    </SolutionColumns>
                </>
            )}
            <Modal open={!!selected} onClose={closeSolution} nav={{ prev: neighbor(-1), next: neighbor(1) }}>
                {selected && (
                    <SolutionPopup
                        key={selected.id}
                        solution={selected}
                        isAdmin={isAdmin}
                        onFlagsChanged={refreshSolutions}
                        onVerified={refreshSolutions}
                        onDeleted={() => { closeSolution(); refreshSolutions(); }}
                    />
                )}
            </Modal>
        </BaseLayout>
    );
}
