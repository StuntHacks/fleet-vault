import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { deleteSolution, flagSolution, getOpenUpdateIds, getSolutionFlags, getSolutionUpdates, resolveSolutionUpdate, setSolutionVerified, unflagSolution } from "../../lib/api";
import { findBattle, getConditionNodes, getGalaxyUnlocks } from "../../lib/battles";
import { ChainRun, Solution, SolutionFlag, SolutionUpdate } from "../../lib/types";
import { Extras, formatStats } from "./solutionEntry";
import styles from "./solution.module.scss";

const flaggedKey = 'fleetvault_flagged_solutions';
const flaggedThisSession = new Set<number>();

const isFlaggedByUser = (s: Solution) => {
    const ids = JSON.parse(localStorage.getItem(flaggedKey) ?? '[]') as number[];

    if (!ids.includes(s.id)) return false;
    if (s.flagged || flaggedThisSession.has(s.id)) return true;
    localStorage.setItem(flaggedKey, JSON.stringify(ids.filter((id) => id !== s.id)))

    return false;
}

const rememberFlagged = (id: number) => {
    flaggedThisSession.add(id);
    const flagged = JSON.parse(localStorage.getItem(flaggedKey) ?? '[]') as number[];
    localStorage.setItem(flaggedKey, JSON.stringify([...flagged.filter((x) => x !== id), id]))
}

const suggestedKey = 'fleetvault_suggested_updates';
const readSuggested = () => JSON.parse(localStorage.getItem(suggestedKey) ?? '{}') as Record<number, number[]>;

export const rememberSuggestion = (solutionId: number, updateId: number) => {
    const suggested = readSuggested();
    suggested[solutionId] = [...(suggested[solutionId] ?? []), updateId];
    localStorage.setItem(suggestedKey, JSON.stringify(suggested));
}

const getPopupValues = (s: Solution): string[] => {
    const values: string[] = [];

    if (s.boss_alive === false) values.push("Boss dead");
    if (s.shots) values.push(s.shots === 1 ? "Oneshot" : `${s.shots} ${s.chain.length ? "runs" : "shots"}`);
    if (s.boss_alive && !s.shots) values.push("Boss alive");
    if (s.boss_damage != null) values.push(`Damage done: ${s.boss_damage.toLocaleString()}`);
    if (s.fr_total != null) values.push(`Total FR: ${s.fr_total}`);

    return values;
}

const UPDATE_LABELS: Record<string, string> = {
    fr_committed: "FR committed",
    hazard_nodes: "Hazards",
    support_nodes: "Supports",
    boss_alive: "Boss",
    unlocks: "Required unlocks",
    purchases: "Ship selection",
    shots: "Shots",
    fr_total: "Total FR",
    boss_damage: "Damage done",
};

function Screenshot({ url, thumbnailUrl }: { url: string, thumbnailUrl: string | null }) {
    const [thumbnailFailed, setThumbnailFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const thumbnail = thumbnailFailed ? null : thumbnailUrl;

    return (
        <a
            className={clsx(styles.screenshot, !loaded && styles.loading)}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open full size"
        >
            {thumbnail && <img src={thumbnail} alt="" onLoad={() => setLoaded(true)} onError={() => setThumbnailFailed(true)} />}
            <img src={url} alt="Solution screenshot" onLoad={thumbnail ? undefined : () => setLoaded(true)} />
        </a>
    );
}

export function SolutionPopup({ solution: s, isAdmin, showGalaxy, onFlagsChanged, onUpdatesChanged, onVerified, onDeleted }: { solution: Solution, isAdmin: boolean, showGalaxy?: boolean, onFlagsChanged: () => void, onUpdatesChanged?: () => void, onVerified: () => void, onDeleted: () => void }) {
    const battle = findBattle(s.galaxy_id, s.battle_id);

    const { hazards, supports } = getConditionNodes(battle);
    const nodeLabel = (nodes: { id: string, label: string }[], id: string) => nodes.find((n) => n.id === id)?.label ?? id;

    const chained = s.chain.length > 0;
    const runs: ChainRun[] = [s, ...s.chain];
    const [runIndex, setRunIndex] = useState(0);

    const run = runs[runIndex] ?? runs[0];
    
    const [flagged, setFlagged] = useState(() => isFlaggedByUser(s));
    const [flagging, setFlagging] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [flagError, setFlagError] = useState(false);
    const [reason, setReason] = useState('');
    const [flagReasons, setFlagReasons] = useState<SolutionFlag[]>([]);
    const [updates, setUpdates] = useState<SolutionUpdate[]>([]);
    const noteUpdates = updates.filter((u) => u.changes.notes != null);
    const [adminBusy, setAdminBusy] = useState(false);
    const [adminError, setAdminError] = useState<string | null>(null);
    
    const perShot = !chained && !!s.shots && s.shots > 1;
    const obsolete = s.rank_in_group != null && s.rank_in_group > 1;
    const values = getPopupValues(s);
    const navigate = useNavigate();
    
    const [suggested, setSuggested] = useState(() => !!readSuggested()[s.id]?.length);
    
    const showFlagged = flagged || (isAdmin && s.flagged);
    const flagTrigger = useRef<HTMLButtonElement>(null);
    const flagBox = useRef<HTMLDivElement>(null);
    const touchedAt = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const ids = readSuggested()[s.id];
        if (!ids?.length) return;
        let current = true;

        getOpenUpdateIds(ids)
            .then((open) => {
                const stored = readSuggested();
                if (open.length) stored[s.id] = open;
                else delete stored[s.id];
                localStorage.setItem(suggestedKey, JSON.stringify(stored));
                if (current) setSuggested(open.length > 0);
            })
            .catch(() => { });

        return () => { current = false; };
    }, [s.id]);

    useEffect(() => {
        if (!isAdmin || !s.flagged) return;
        let current = true;

        getSolutionFlags(s.id)
            .then((flags) => { if (current) setFlagReasons(flags.filter((f) => f.resolved_at == null && f.reason)); })
            .catch(() => { });

        return () => { current = false; };
    }, [isAdmin, s.id, s.flagged]);

    useEffect(() => {
        if (!isAdmin) return;
        let current = true;

        getSolutionUpdates(s.id)
            .then((result) => { if (current) setUpdates(result); })
            .catch(() => { });

        return () => { current = false; };
    }, [isAdmin, s.id]);

    const formatUpdate = (key: string, value: unknown): string => {
        if (key === "boss_alive") return value ? "Alive" : "Dead";
        if (key === "hazard_nodes") return (value as string[]).map((id) => nodeLabel(hazards, id)).join(", ");
        if (key === "support_nodes") return (value as string[]).map((id) => nodeLabel(supports, id)).join(", ");
        if (key === "unlocks") return (value as string[]).map((u) => getGalaxyUnlocks(s.galaxy_id).find((g) => g.code === u)?.name ?? u).join(", ");
        if (key === "purchases") return Object.entries(value as Record<string, string>).map(([node, ship]) => `${node}: ${ship}`).join(", ");

        return String(value);
    };

    useEffect(() => {
        if (!flagging) return;
        flagBox.current?.getElementsByTagName('textarea')[0]?.focus();

        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (flagBox.current?.contains(target) || flagTrigger.current?.contains(target)) return;
            setFlagging(false);
        };

        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [flagging]);

    const flag = async () => {
        setSubmitting(true);
        setFlagError(false);

        try {
            await flagSolution(s.id, reason);
            rememberFlagged(s.id);
            setFlagged(true);
            setFlagging(false);

            if (isAdmin) {
                window.dispatchEvent(new Event('fv:flags-changed'));
                onFlagsChanged();
            }
        } catch {
            setFlagError(true);
        } finally {
            setSubmitting(false);
        }
    }

    const unflag = async () => {
        setAdminBusy(true);
        setAdminError(null);

        try {
            await unflagSolution(s.id);
            window.dispatchEvent(new Event('fv:flags-changed'));
            setFlagReasons([]);
            onFlagsChanged();
        } catch {
            setAdminError('Unflagging failed, please try again');
        } finally {
            setAdminBusy(false);
        }
    }

    const rejectUpdate = async (id: number) => {
        setAdminBusy(true);
        setAdminError(null);

        try {
            await resolveSolutionUpdate(id, false);
            window.dispatchEvent(new Event('fv:updates-changed'));
            setUpdates((prev) => prev.filter((u) => u.id !== id));
            onUpdatesChanged?.();
        } catch {
            setAdminError('Rejecting failed, please try again');
        } finally {
            setAdminBusy(false);
        }
    }

    const toggleVerified = async () => {
        const verify = s.verified_at == null;
        setAdminBusy(true);
        setAdminError(null);

        try {
            await setSolutionVerified(s.id, verify);
            onVerified();
        } catch {
            setAdminError(`${verify ? 'Verifying' : 'Unverifying'} failed, please try again`);
        } finally {
            setAdminBusy(false);
        }
    }

    const touchStart = (e: React.TouchEvent) => {
        touchedAt.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };

    const swipe = (e: React.TouchEvent) => {
        const start = touchedAt.current;
        touchedAt.current = null;
        if (!start) return;

        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 2) return;

        setRunIndex((i) => Math.min(Math.max(i - Math.sign(dx), 0), runs.length - 1));
    };

    const remove = async () => {
        if (!window.confirm('Really delete this solution?')) return;

        setAdminBusy(true);
        setAdminError(null);

        try {
            await deleteSolution(s.id);
            window.dispatchEvent(new Event('fv:flags-changed'));
            onDeleted();
        } catch {
            setAdminError('Deleting failed, please try again');
            setAdminBusy(false);
        }
    }

    return (
        <div className={styles.popup} onTouchStart={chained ? touchStart : undefined} onTouchEnd={chained ? swipe : undefined}>
            <div className={styles.titleBar}>
                <span className={styles.stats}>
                    {formatStats(s.combat_stats)}&nbsp;·&nbsp;
                    {chained ? s.fr_total : s.fr_used}
                    {!chained && s.fr_committed != null && <span className={styles.small}> / {s.fr_committed}</span>}
                    <span className={styles.small}> FR{perShot && '/shot'}{chained && ' total'}</span>
                </span>
                <div className={styles.title}>
                    <h2>{showGalaxy && `G${s.galaxy_id} · `}{battle?.name}</h2>
                    {s.verified_at && <span className={styles.verifiedLabel}>Verified</span>}
                    {obsolete && <span className={styles.obsoleteLabel}>Obsolete</span>}
                </div>
            </div>

            {chained && (
                <div className={styles.runs}>
                    <button className={styles.runArrow} onClick={() => setRunIndex(runIndex - 1)} disabled={runIndex === 0} aria-label="Previous run">‹</button>
                    <div className={styles.runTitle}>
                        Run {runIndex + 1} of {runs.length}&nbsp;·&nbsp;{run.fr_used}
                        {run.fr_committed != null && <span className={styles.small}> / {run.fr_committed}</span>}
                        <span className={styles.small}> FR</span>
                        <div className={styles.runDots}>
                            {runs.map((_, i) => (
                                <button key={i} className={clsx(styles.runDot, i === runIndex && styles.active)} onClick={() => setRunIndex(i)} aria-label={`Run ${i + 1}`} />
                            ))}
                        </div>
                    </div>
                    <button className={styles.runArrow} onClick={() => setRunIndex(runIndex + 1)} disabled={runIndex === runs.length - 1} aria-label="Next run">›</button>
                </div>
            )}

            {run.screenshot_url && (
                <>
                    <Screenshot key={`${s.id}-${runIndex}`} url={run.screenshot_url} thumbnailUrl={run.thumbnail_url} />
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

                {(s.notes || noteUpdates.length > 0) &&
                    <div className={styles.notes}>
                        <strong>Notes: </strong>
                        {noteUpdates.length ? (
                            <>
                                {s.notes && <span className={styles.removed}>{s.notes}</span>}
                                {noteUpdates.map((u) => <span className={styles.added} key={u.id}>{u.changes.notes}</span>)}
                            </>
                        ) : s.notes}
                    </div>
                }

                <Extras solution={s} />
                <div className={styles.curation}>
                    <div ref={flagBox} className={`${styles.flagging} ${flagging ? '' : styles.hidden}`}>
                        <textarea
                            name="reason"
                            placeholder="Further context..."
                            maxLength={500}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
                                e.preventDefault();
                                if (!submitting) flag();
                            }}
                        />
                        {flagError && <span className={styles.error}>Flagging failed, please try again</span>}
                        <button className={styles.flag} onClick={flag} disabled={submitting}>Flag</button>
                    </div>

                    {isAdmin && updates.map((u) => (
                        <Fragment key={u.id}>
                            <strong className={styles.reasons}>Missing information provided:</strong>
                            {Object.keys(u.changes).some((key) => key !== "notes") && (
                                <div className={clsx(styles.reason, styles.update)}>
                                    {Object.entries(u.changes).filter(([key]) => key !== "notes").map(([key, value]) => (
                                        <span key={key}>{UPDATE_LABELS[key] ?? key}: {formatUpdate(key, value)}</span>
                                    ))}
                                </div>
                            )}
                            <div className={styles.row}>
                                <button className={styles.verify} onClick={() => navigate(`/edit/${s.id}?update=${u.id}`)} disabled={adminBusy}>Apply</button>
                                <button onClick={() => rejectUpdate(u.id)} disabled={adminBusy}>Reject</button>
                            </div>
                        </Fragment>
                    ))}

                    {!showFlagged && <button ref={flagTrigger} className={styles.flag} onClick={() => setFlagging(true)}>Flag as incorrect</button>}
                    {!isAdmin && !suggested && <button onClick={() => navigate(`/suggest/${s.id}`)}>Fill in missing information</button>}
                    {isAdmin && (
                        <>
                            <button className={styles.flag} onClick={remove} disabled={adminBusy}>Delete</button>
                            <button className={s.verified_at ? '' : styles.verify} onClick={toggleVerified} disabled={adminBusy}>{s.verified_at ? 'Unverify' : 'Verify'}</button>
                            {s.flagged && <button onClick={unflag} disabled={adminBusy}>Unflag</button>}
                            <button onClick={() => navigate(`/edit/${s.id}`)} disabled={adminBusy}>Edit</button>
                            {adminError && <span className={styles.error}>{adminError}</span>}
                        </>
                    )}

                    {showFlagged && <span className={styles.flagged}>Flagged as incorrect</span>}
                    {!isAdmin && suggested && <span className={styles.suggested}>Missing information submitted for review</span>}

                    {isAdmin && flagReasons.length > 0 && (
                        <>
                            <strong className={styles.reasons}>Context provided:</strong>
                            {flagReasons.map((f) => <div className={styles.reason} key={f.id}>{f.reason}</div>)}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
