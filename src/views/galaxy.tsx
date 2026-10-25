import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BaseLayout } from "../components/baselayout/baselayout";
import { Modal } from "../components/modal/modal";
import { useGalaxySolutions } from "../lib/hooks";
import type { RankedSolutions } from "../lib/api";
import { findBattle, galaxies, getConditionNodes, getGalaxyUnlocks, isBossBattle } from "../lib/battles";
import styles from "./galaxy.module.scss";
import { useEffect, useMemo, useRef, useState } from "react";
import { Solution } from "../lib/types";
import { Checkbox } from "../components/checkbox/checkbox";
import { CombatStatInput } from "../components/combatStatInput/combatStatInput";

const getUnlockName = (galaxyId: number, unlock: string) => {
    return getGalaxyUnlocks(galaxyId).find((u) => u.code === unlock)?.name ?? unlock;
}

const statFilterKey = (galaxyId: number) => `fleetvault_stat_filter_${galaxyId}`;
const combatStatsKey = (galaxyId: number) => `fleetvault_combat_stats_${galaxyId}`;

const formatStats = (stats: number) => `${Number.isInteger(stats) ? stats.toFixed(1) : stats}x`;

const getBossInfo = (s: Solution) => {
    if (s.boss_alive === false) return "Boss dead";
    if (s.shots) return s.shots === 1 ? "Oneshot" : `${s.shots} shots`;
    if (s.boss_alive) return "Boss alive";
    return null;
}

function Extras({ solution: s }: { solution: Solution }) {
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

function Entry({ solution, obsolete = false, onOpen, preloadImages }: { solution: Solution, obsolete?: boolean, onOpen: (s: Solution) => void, preloadImages: boolean }) {
    const s = solution;
    const perShot = !!s.shots && s.shots > 1;
    const bossInfo = getBossInfo(s);
    const purchases = Object.entries(s.purchases ?? {});
    const hasData = s.support || s.hazards || !!bossInfo || s.non_standard || obsolete;

    const pressedAt = useRef<{ x: number, y: number } | null>(null);
    const open = (e: React.MouseEvent) => {
        const start = pressedAt.current;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
        onOpen(s);
    };

    return (
        <div
            className={`${styles.solution} ${obsolete ? styles.obsolete : ""}`}
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
            {(hasData || purchases.length > 0 || s.unlocks?.length > 0 || s.notes) && (
                <div className={styles.details}>
                    {hasData && (
                        <div className={styles.data}>
                            {(s.support || s.hazards || obsolete) && (
                                <div className={styles.modifiers}>
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

const getPopupValues = (s: Solution): string[] => {
    const values: string[] = [];
    if (s.boss_alive === false) values.push("Boss dead");
    if (s.shots) values.push(s.shots === 1 ? "Oneshot" : `${s.shots} shots`);
    if (s.boss_alive && !s.shots) values.push("Boss alive");
    if (s.boss_damage != null) values.push(`Damage done: ${s.boss_damage.toLocaleString()}`);
    if (s.fr_total != null) values.push(`Total FR: ${s.fr_total}`);
    return values;
}

function SolutionPopup({ solution: s }: { solution: Solution }) {
    const battle = findBattle(s.galaxy_id, s.battle_id);
    const { hazards, supports } = getConditionNodes(battle);
    const nodeLabel = (nodes: { id: string, label: string }[], id: string) => nodes.find((n) => n.id === id)?.label ?? id;
    const perShot = !!s.shots && s.shots > 1;
    const obsolete = s.rank_in_group != null && s.rank_in_group > 1;
    const values = getPopupValues(s);

    return (
        <div className={styles.popup}>
            <div className={styles.titleBar}>
                <span className={styles.stats}>
                    {formatStats(s.combat_stats)}&nbsp;·&nbsp;
                    {s.fr_used}
                    {s.fr_committed != null && <span className={styles.small}> / {s.fr_committed}</span>}
                    <span className={styles.small}> FR{perShot && '/shot'}</span>
                </span>
                <div className={styles.title}>
                    <h2>{battle?.name}</h2>
                    {obsolete && <span className={styles.obsoleteLabel}>Obsolete</span>}
                </div>
            </div>
            {s.screenshot_url && (
                <>
                    <a href={s.screenshot_url} target="_blank" rel="noopener noreferrer" title="Open full size">
                        <img src={s.screenshot_url} alt="Solution screenshot" />
                    </a>
                    <div className={styles.caption}>
                        Click to open full size
                    </div>
                </>
            )}
            <div className={styles.details}>
                {values.length > 0 && (
                    <div className={styles.values}>
                        {values.join(' • ')}
                    </div>
                )}
                {(s.support || s.hazards || s.non_standard) && (
                    <div className={styles.data}>
                        {(s.support || s.hazards) && (
                            <div className={styles.modifiers}>
                                {s.support && !s.support_nodes.length && <span className={styles.support}>Support</span>}
                                {s.support_nodes.map((id) => (
                                    <span className={styles.support} key={id}>Support: {nodeLabel(supports, id)}</span>
                                ))}
                                {s.hazards && !s.hazard_nodes.length && <span className={styles.hazard}>Hazard</span>}
                                {s.hazard_nodes.map((id) => (
                                    <span className={styles.hazard} key={id}>Hazard: {nodeLabel(hazards, id)}</span>
                                ))}
                            </div>
                        )}
                        {s.non_standard && <span className={styles.nonStandard}>Non-standard path</span>}
                    </div>
                )}
                {s.notes &&
                    <div className={styles.notes}>
                        <strong>Notes: </strong>{s.notes}
                    </div>
                }
                <Extras solution={s} />
            </div>
        </div>
    );
}

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

function Solutions({ solutions, onOpen, showObsolete, filtered, preloadImages }: { solutions: RankedSolutions, onOpen: (s: Solution) => void, showObsolete: boolean, filtered: boolean, preloadImages: boolean }) {
    if (!solutions.best.length) return <p className={styles.info}>{filtered ? "No solutions for these stats" : "No solutions yet"}</p>;

    return (
        <>
            {solutions.best.map((s) => (
                <Entry solution={s} key={s.id} onOpen={onOpen} preloadImages={preloadImages} />
            ))}
            {showObsolete && solutions.obsolete.length > 0 && (
                <>
                    <div className={styles.obsoleteHeader}> — Obsolete solutions — </div>
                    {solutions.obsolete.map((s) => (
                        <Entry solution={s} key={s.id} obsolete onOpen={onOpen} preloadImages={preloadImages} />
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
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const closing = useRef(false);

    const [showObsolete, setShowObsolete] = useState(() => localStorage.getItem('fleetvault_show_obsolete') === 'true');
    const [preloadImages, setPreloadImages] = useState(() => (localStorage.getItem('fleetvault_preload_images') ?? 'true') === 'true');
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

    useEffect(() => {
        closing.current = false;
    }, [location.key]);

    const selectedId = Number(searchParams.get("solution")) || null;
    const selected = useMemo(() => {
        if (selectedId == null) return null;
        return Object.values(solutions.byBattle)
            .flatMap((r) => [...r.best, ...r.obsolete])
            .find((s) => s.id === selectedId) ?? null;
    }, [solutions.byBattle, selectedId]);

    const openSolution = (s: Solution) => {
        setSearchParams((params) => {
            params.set("solution", String(s.id));
            return params;
        }, { state: { popup: true } });
    };

    const closeSolution = () => {
        if (closing.current) return;
        closing.current = true;
        if ((location.state as { popup?: boolean } | null)?.popup) {
            navigate(-1);
            return;
        }
        setSearchParams((params) => {
            params.delete("solution");
            return params;
        }, { replace: true });
    };

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
                        </div>
                    </div>
                    <div className={styles.battles} ref={listRef}>
                        {galaxies[id - 1].battles.map((b) => {
                            const results = filterByStats(solutions.forBattle(b.id), statFilter);

                            return (
                                <div className={styles.battle} key={b.id}>
                                    <div className={styles.battleName}>
                                        {b.name}
                                        {isBossBattle(b) && <span className={styles.hasBoss}>Boss</span>}
                                        <span className={styles.count}>
                                            {results.best.length}
                                        </span>
                                    </div>
                                    <Solutions
                                        solutions={results}
                                        onOpen={openSolution}
                                        showObsolete={showObsolete}
                                        filtered={statFilter != null}
                                        preloadImages={preloadImages}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
            <Modal open={!!selected} onClose={closeSolution}>
                {selected && <SolutionPopup solution={selected} />}
            </Modal>
        </BaseLayout>
    );
}
