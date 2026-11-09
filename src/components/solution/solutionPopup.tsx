import { Fragment, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { deleteSolution, flagSolution, getOpenUpdateIds, getSolutionFlags, getSolutionUpdates, resolveSolutionUpdate, setSolutionVerified, undoFlag, unflagSolution } from "../../lib/api";
import { Battle } from "../../lib/advisor";
import { findBattle, getConditionNodes, usesReinforcements } from "../../lib/battles";
import { ChainRun, Solution, SolutionFlag, SolutionUpdate } from "../../lib/types";
import { Extras, formatStats, formatUpdate, UPDATE_LABELS } from "./solutionEntry";
import styles from "./solution.module.scss";

const flaggedKey = 'fleetvault_flagged_solutions';
const flagTokensKey = 'fleetvault_flag_tokens';
const flaggedThisSession = new Set<number>();

const readFlagTokens = () => JSON.parse(localStorage.getItem(flagTokensKey) ?? '{}') as Record<number, string>;

const isFlaggedByUser = (s: Solution) => {
    const ids = JSON.parse(localStorage.getItem(flaggedKey) ?? '[]') as number[];

    if (!ids.includes(s.id)) return false;
    if (s.flagged || flaggedThisSession.has(s.id)) return true;
    forgetFlagged(s.id);

    return false;
}

const rememberFlagged = (id: number, token: string | null) => {
    flaggedThisSession.add(id);
    const flagged = JSON.parse(localStorage.getItem(flaggedKey) ?? '[]') as number[];
    localStorage.setItem(flaggedKey, JSON.stringify([...flagged.filter((x) => x !== id), id]))

    const tokens = readFlagTokens();
    if (token) tokens[id] = token;
    else delete tokens[id];
    localStorage.setItem(flagTokensKey, JSON.stringify(tokens));
}

const forgetFlagged = (id: number) => {
    flaggedThisSession.delete(id);
    const flagged = JSON.parse(localStorage.getItem(flaggedKey) ?? '[]') as number[];
    localStorage.setItem(flaggedKey, JSON.stringify(flagged.filter((x) => x !== id)));

    const tokens = readFlagTokens();
    delete tokens[id];
    localStorage.setItem(flagTokensKey, JSON.stringify(tokens));
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

const getFlagWarnings = (s: Solution, battle: Battle | undefined, reason: string): ReactNode[] => {
    const warnings: ReactNode[] = [];

    if (usesReinforcements(battle, s.support, s.support_nodes)) {
        warnings.push(<p key="support">This solution has a reinforcement support node active. Make sure it's active for you as well, and make sure <strong>all</strong> your weapons and mods are set as indicated, <strong>even those on ships you haven't actually deployed</strong>, as the reinforcements will use the loadout you selected.</p>);
    }

    if (/screenshot|stats/i.test(reason)) {
        warnings.push(<p key="stats">As stated on the previous screen, the stats shown in the screenshot may not always match what's listed in the solution entry - the setup should work regardless.</p>);
    }

    if (s.verified_at) {
        warnings.push(<p key="verified">You're trying to flag a verified solution. Bar some fleet changes, they all were tested and should work. Make sure you try it with <strong>exactly</strong> the ships from the screenshot and stats from the description.</p>);
    }

    return warnings;
}

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

export function SolutionPopup({ solution: s, isAdmin, showGalaxy, viewers, onFlagsChanged, onUpdatesChanged, onVerified, onDeleted }: { solution: Solution, isAdmin: boolean, showGalaxy?: boolean, viewers?: string[], onFlagsChanged: () => void, onUpdatesChanged?: () => void, onVerified: () => void, onDeleted: () => void }) {
    const battle = findBattle(s.galaxy_id, s.battle_id);

    const { hazards, supports } = getConditionNodes(battle);
    const nodeLabel = (nodes: { id: string, label: string }[], id: string) => nodes.find((n) => n.id === id)?.label ?? id;

    const chained = s.chain.length > 0;
    const runs: ChainRun[] = [s, ...s.chain];
    const [runIndex, setRunIndex] = useState(0);

    const run = runs[runIndex] ?? runs[0];
    
    const [flagged, setFlagged] = useState(() => isFlaggedByUser(s));
    const [undoToken, setUndoToken] = useState<string | null>(() => readFlagTokens()[s.id] ?? null);
    const [undoError, setUndoError] = useState<string | null>(null);
    const [flagging, setFlagging] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [flagError, setFlagError] = useState(false);
    const [reason, setReason] = useState('');
    const [warnings, setWarnings] = useState<ReactNode[]>([]);
    const [confirming, setConfirming] = useState(false);
    const [flagHeight, setFlagHeight] = useState<number>();
    const [flagReasons, setFlagReasons] = useState<SolutionFlag[]>([]);
    const [updates, setUpdates] = useState<SolutionUpdate[]>([]);
    const noteUpdates = updates.filter((u) => u.changes.notes != null);
    const [adminBusy, setAdminBusy] = useState(false);
    const [adminError, setAdminError] = useState<string | null>(null);
    
    const perShot = !chained && !!s.shots && s.shots > 1;
    const obsolete = s.rank_in_group != null && s.rank_in_group > 1;
    const values = getPopupValues(s);
    const reinforcements = usesReinforcements(battle, s.support, s.support_nodes);
    const navigate = useNavigate();
    const isUpdatesPage = !!useMatch('/updates');
    
    const [suggested, setSuggested] = useState(() => !!readSuggested()[s.id]?.length);
    
    const showFlagged = flagged || (isAdmin && s.flagged);
    const flagTrigger = useRef<HTMLButtonElement>(null);
    const flagBox = useRef<HTMLDivElement>(null);
    const flagForm = useRef<HTMLDivElement>(null);
    const flagConfirm = useRef<HTMLDivElement>(null);
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

    useEffect(() => {
        if (!flagging) return;

        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (flagBox.current?.contains(target) || flagTrigger.current?.contains(target)) return;
            setFlagging(false);
        };

        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [flagging]);

    useLayoutEffect(() => {
        const pane = (confirming ? flagConfirm : flagForm).current;
        if (!pane) return;

        setFlagHeight(pane.offsetHeight);
        const observer = new ResizeObserver(() => setFlagHeight(pane.offsetHeight));
        observer.observe(pane);

        return () => observer.disconnect();
    }, [confirming, warnings]);

    useEffect(() => {
        if (!flagging) return;

        const target = confirming
            ? flagConfirm.current?.getElementsByTagName('button')[0]
            : flagForm.current?.getElementsByTagName('textarea')[0];
        target?.focus({ preventScroll: true });
    }, [flagging, confirming]);

    const requestFlag = () => {
        if (submitting) return;

        const found = getFlagWarnings(s, battle, reason);
        if (!found.length) return flag();

        setWarnings(found);
        setFlagError(false);
        setConfirming(true);
    }

    const flag = async () => {
        setSubmitting(true);
        setFlagError(false);

        try {
            const token = await flagSolution(s.id, reason);
            rememberFlagged(s.id, token);
            setFlagged(true);
            setUndoToken(token);
            setUndoError(null);
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

    const undoOwnFlag = async () => {
        if (!undoToken) return;
        setSubmitting(true);
        setUndoError(null);

        try {
            const undone = await undoFlag(undoToken);
            setUndoToken(null);

            if (!undone) {
                rememberFlagged(s.id, null);
                setUndoError('This flag has already been reviewed');
                return;
            }

            forgetFlagged(s.id);
            setFlagged(false);

            if (isAdmin) {
                window.dispatchEvent(new Event('fv:flags-changed'));
                onFlagsChanged();
            }
        } catch {
            setUndoError('Undoing failed, please try again');
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

            {!!viewers?.length && (
                <div className={styles.viewersBanner}>
                    <span className={styles.eye}>👁</span>
                    Also being viewed by:&nbsp;
                    {viewers.join(", ")}
                </div>
            )}

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
                {reinforcements && (
                    <div className={styles.disclaimer}>
                        <strong>Notice:</strong> This battle has a <strong>reinforcement</strong> support node active. Make sure <strong>all</strong> of your ships have their mods and weapons set as indicated, <strong>even if they're not deployed</strong>!
                    </div>
                )}

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
                    <div
                        ref={flagBox}
                        className={clsx(styles.flagging, !flagging && styles.hidden)}
                        style={{ height: flagHeight }}
                        onTransitionEnd={(e) => { if (e.target === e.currentTarget && !flagging) setConfirming(false); }}
                    >
                        <div ref={flagForm} className={clsx(styles.flagPane, confirming && styles.away)}>
                            <p>Please make sure the setup you tried is <strong>identical</strong> to the one shown here, and note that the stats shown in the screenshot may not always match what's listed in the solution. That's normal, and the setup should work regardless.<br /><br /><strong>If you have a better setup than this one, please submit it instead of flagging this solution.</strong></p>
                            <textarea
                                name="reason"
                                placeholder="Further context..."
                                maxLength={500}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
                                    e.preventDefault();
                                    requestFlag();
                                }}
                            />
                            {flagError && !confirming && <span className={styles.error}>Flagging failed, please try again</span>}
                            <button className={styles.flag} onClick={requestFlag} disabled={submitting}>Flag</button>
                        </div>
                        <div ref={flagConfirm} className={clsx(styles.flagPane, styles.confirm, confirming && styles.active)}>
                            {warnings}
                            <p><strong>Do you still wish to flag it?</strong></p>
                            {flagError && confirming && <span className={styles.error}>Flagging failed, please try again</span>}
                            <div className={styles.flagButtons}>
                                <button onClick={() => setFlagging(false)} disabled={submitting}>Cancel</button>
                                <button className={styles.flag} onClick={flag} disabled={submitting}>Yes, flag it</button>
                            </div>
                        </div>
                    </div>

                    {isAdmin && updates.map((u) => (
                        <Fragment key={u.id}>
                            <strong className={styles.reasons}>Missing information provided:</strong>
                            {Object.keys(u.changes).some((key) => key !== "notes") && (
                                <div className={clsx(styles.reason, styles.update)}>
                                    {Object.entries(u.changes).filter(([key]) => key !== "notes").map(([key, value]) => (
                                        <span key={key}>{UPDATE_LABELS[key] ?? key}: {formatUpdate(s, key, value)}</span>
                                    ))}
                                </div>
                            )}
                            <div className={styles.row}>
                                <button className={styles.verify} onClick={() => navigate(`/edit/${s.id}?update=${u.id}`, isUpdatesPage ? { state: { returnTo: '/updates' } } : undefined)} disabled={adminBusy}>Apply</button>
                                <button onClick={() => rejectUpdate(u.id)} disabled={adminBusy}>Reject</button>
                            </div>
                        </Fragment>
                    ))}

                    {!showFlagged && <button ref={flagTrigger} className={styles.flag} onClick={() => { setConfirming(false); setFlagging(true); }}>Flag as incorrect</button>}
                    {flagged && undoToken && <button onClick={undoOwnFlag} disabled={submitting}>Undo flag</button>}
                    {!isAdmin && !suggested && <button onClick={() => navigate(`/suggest/${s.id}`)}>Fill in missing information</button>}
                    <button onClick={() => navigate(`/copy/${s.id}`)}>Copy to different stats</button>
                    {isAdmin && (
                        <div className={styles.adminRow}>
                            <button className={styles.flag} onClick={remove} disabled={adminBusy}>Delete</button>
                            <button className={s.verified_at ? '' : styles.verify} onClick={toggleVerified} disabled={adminBusy}>{s.verified_at ? 'Unverify' : 'Verify'}</button>
                            {s.flagged && <button onClick={unflag} disabled={adminBusy}>Unflag</button>}
                            <button onClick={() => navigate(`/edit/${s.id}`)} disabled={adminBusy}>Edit</button>
                            {adminError && <span className={styles.error}>{adminError}</span>}
                        </div>
                    )}

                    {showFlagged && <span className={styles.flagged}>Flagged as incorrect</span>}
                    {undoError && <span className={styles.error}>{undoError}</span>}
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
