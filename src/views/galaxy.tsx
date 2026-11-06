import { useNavigate, useParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { Modal, ModalTarget } from "../components/modal/modal";
import { refreshGalaxies, useAdminSession, useGalaxyAccess, useGalaxyBattles, useGalaxySolutions, useSelectedSolution } from "../lib/hooks";
import { type RankedSolutions, updateBattleOrder } from "../lib/api";
import { combatStatsKey, galaxies, isBossBattle, statFilterKey } from "../lib/battles";
import styles from "./galaxy.module.scss";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Solution } from "../lib/types";
import { Checkbox } from "../components/checkbox/checkbox";
import { CombatStatInput } from "../components/combatStatInput/combatStatInput";
import { formatStats, SolutionEntry } from "../components/solution/solutionEntry";
import { SolutionPopup } from "../components/solution/solutionPopup";
import { SolutionColumn, SolutionColumns } from "../components/solution/solutionColumns";
import { GalaxyNotes } from "../components/galaxyNotes/galaxyNotes";
import { HiddenGalaxy } from "../components/hiddenGalaxy/hiddenGalaxy";

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

const sameUnlocks = (a: string[], b: string[]) =>
    a.length === b.length && a.every((u) => b.includes(u));

const pickBest = (solutions: Solution[], stats: number, unlocks: string[]): Solution | null => {
    const nearest = nearestStats(solutions, stats);
    const atStats = solutions.filter((s) => Math.abs(s.combat_stats - nearest) < 1e-6);
    const matching = atStats.filter((s) => sameUnlocks(s.unlocks, unlocks));
    return (matching.length ? matching : atStats)
        .sort((a, b) => Number(a.flagged) - Number(b.flagged)
            || (a.fr_total ?? a.fr_used) - (b.fr_total ?? b.fr_used)
            || Number(b.verified_at != null) - Number(a.verified_at != null))[0] ?? null;
}

function Solutions({
    solutions,
    onOpen,
    showObsolete,
    filtered,
    preloadImages,
    isAdmin,
    include
}: {
    solutions: RankedSolutions,
    onOpen: (s: Solution) => void,
    showObsolete: boolean,
    filtered: boolean,
    preloadImages: boolean,
    isAdmin: boolean,
    include: (s: Solution) => boolean
}) {
    if (!solutions.best.length) return <p className={styles.info}>{filtered ? "No solutions for these stats" : "No solutions yet"}</p>;
    const filteredBest = solutions.best.filter(include);
    const filteredObsolete = solutions.obsolete.filter(include);

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
    const battles = useGalaxyBattles(id);
    const allowed = access.canView(id);
    const navigate = useNavigate();

    useEffect(() => {
        if (!access.loading && !allowed) navigate('/', { replace: true });
    }, [access.loading, allowed, navigate]);

    const listRef = useRef<HTMLDivElement>(null);
    const menuBarRef = useRef<HTMLDivElement>(null);
    const [scrolled, setScrolled] = useState(false);
    const { selectedId, openSolution, switchSolution, closeSolution } = useSelectedSolution();

    const [showObsolete, setShowObsolete] = useState(() => localStorage.getItem('fleetvault_show_obsolete') === 'true');
    const [preloadImages, setPreloadImages] = useState(() => (localStorage.getItem('fleetvault_preload_images') ?? 'true') === 'true');
    const [flaggedOnly, setFlaggedOnly] = useState(false);
    const [notesOnly, setNotesOnly] = useState(false);
    const [savingOrder, setSavingOrder] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
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

    useEffect(() => {
        const container = menuBarRef.current?.parentElement;
        if (!container) return;
        const onScroll = () => setScrolled(container.scrollTop > 0);
        onScroll();
        container.addEventListener('scroll', onScroll, { passive: true });
        return () => container.removeEventListener('scroll', onScroll);
    }, [listReady]);

    const [navOrigin, setNavOrigin] = useState<{ stats: number, unlocks: string[] } | null>(null);

    useEffect(() => {
        if (selectedId == null) setNavOrigin(null);
    }, [selectedId]);

    const neighbor = (direction: 1 | -1): ModalTarget | null => {
        if (!selected) return null;
        const origin = navOrigin ?? { stats: selected.combat_stats, unlocks: selected.unlocks };

        for (let i = battles.findIndex((b) => b.id === selected.battle_id) + direction; i >= 0 && i < battles.length; i += direction) {
            const best = pickBest(solutions.forBattle(battles[i].id).best, origin.stats, origin.unlocks);

            if (best) return { title: battles[i].name, onSelect: () => { setNavOrigin(origin); switchSolution(best); } };
        }

        return null;
    };

    const include = (s: Solution) => (!flaggedOnly || s.flagged) && (!notesOnly || !!s.notes?.trim());

    const sibling = (direction: 1 | -1): ModalTarget | null => {
        if (!selected) return null;

        const all = solutions.forBattle(selected.battle_id);
        const visible = filterByStats(all, statFilter, upToStats);
        let list = [...visible.best, ...(showObsolete ? visible.obsolete : [])].filter(include);

        if (!list.some((s) => s.id === selected.id)) list = [...all.best, ...all.obsolete];

        const target = list[list.findIndex((s) => s.id === selected.id) + direction];

        if (!target) return null;

        return {
            title: `${formatStats(target.combat_stats)} · ${target.fr_total ?? target.fr_used} FR`,
            onSelect: () => { setNavOrigin(null); switchSolution(target); },
        };
    };

    const columns = battles
        .map((b) => ({ battle: b, results: filterByStats(solutions.forBattle(b.id), statFilter, upToStats) }))
        .filter(({ results }) => (!flaggedOnly && !notesOnly) || results.best.some(include) || (showObsolete && results.obsolete.some(include)));

    const refreshSolutions = () => { solutions.reload().catch(() => {}); };

    const moveBattle = async (from: number, direction: 1 | -1) => {
        const order = battles.map((b) => b.id);
        [order[from], order[from + direction]] = [order[from + direction], order[from]];
        setSavingOrder(true);
        try {
            await updateBattleOrder(id, order);
            await refreshGalaxies();
        } catch {
            alert("Saving battle order failed, please try again");
        } finally {
            setSavingOrder(false);
        }
    };

    const columnMove = (battleId: string) => {
        if (!isAdmin || flaggedOnly) return undefined;
        const index = battles.findIndex((b) => b.id === battleId);
        return {
            earlier: !savingOrder && index > 0 ? () => moveBattle(index, -1) : null,
            later: !savingOrder && index < battles.length - 1 ? () => moveBattle(index, 1) : null,
        };
    };

    const handleScroll = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY === 0) return;
        e.preventDefault();

        const list = listRef.current;
        const first = list?.firstElementChild as HTMLElement | null;
        if (!list || !first) return;
        
        const stops = Array.from(list.children, (child) => (child as HTMLElement).offsetLeft - first.offsetLeft);
        const left = list.scrollLeft;
        const target = e.deltaY > 0 ? stops.find((s) => s > left + 1) : stops.reverse().find((s) => s < left - 1);

        if (target != null) list.scrollLeft = target;
    }

    return (
        <BaseLayout>
            {(solutions.loading || !allowed) && <p className={styles.info}>Loading...</p>}
            {solutions.error && <p className={styles.error}>Error loading solutions</p>}
            {listReady && (
                <>
                    <div ref={menuBarRef} className={clsx(styles.menuBar, settingsOpen && styles.open, scrolled && styles.scrolled)}>
                        <button className={styles.settingsToggle} onClick={() => setSettingsOpen(!settingsOpen)}>
                            Settings & Filters
                            {statFilter != null && <span>{upToStats ? "Up to " : "At "}{formatStats(statFilter)}</span>}
                            <span className={styles.arrow}>{settingsOpen ? "▴" : "▾"}</span>
                        </button>
                        <div className={styles.settings}>
                            <Checkbox name="filterStats" checked={filter} onChange={changeFilter}>
                                Filter by stats
                            </Checkbox>
                            <Checkbox name="upToStats" checked={upToStats} onChange={changeUpToStats} disabled={!filter}>
                                Include lower stats
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
                                <>
                                    <Checkbox name="flaggedOnly" checked={flaggedOnly} onChange={setFlaggedOnly}>
                                        Show only flagged
                                    </Checkbox>
                                    <Checkbox name="notesOnly" checked={notesOnly} onChange={setNotesOnly}>
                                        Show only with notes
                                    </Checkbox>
                                </>
                            )}
                        </div>
                    </div>
                    {isAdmin && access.isHidden(id) && <HiddenGalaxy galaxyId={id} />}
                    <GalaxyNotes galaxyId={id} isAdmin={isAdmin} />
                    <SolutionColumns ref={listRef}>
                        {flaggedOnly && !columns.length && <p className={styles.info}>No flagged solutions</p>}
                        {columns.map(({ battle: b, results }) => (
                            <SolutionColumn key={b.id} id={`battle-${b.id}`} title={b.name} boss={isBossBattle(b)} count={results.best.length} move={columnMove(b.id)}>
                                <Solutions
                                    solutions={results}
                                    onOpen={openSolution}
                                    showObsolete={showObsolete}
                                    filtered={statFilter != null}
                                    preloadImages={preloadImages}
                                    include={include}
                                    isAdmin={isAdmin}
                                />
                            </SolutionColumn>
                        ))}
                    </SolutionColumns>
                </>
            )}
            <Modal open={!!selected} onClose={closeSolution} nav={{ prev: neighbor(-1), next: neighbor(1), up: sibling(-1), down: sibling(1) }}>
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
