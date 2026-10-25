import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteSolution, flagSolution, getSolutionFlags, unflagSolution } from "../../lib/api";
import { findBattle, getConditionNodes } from "../../lib/battles";
import { Solution, SolutionFlag } from "../../lib/types";
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

const getPopupValues = (s: Solution): string[] => {
    const values: string[] = [];
    if (s.boss_alive === false) values.push("Boss dead");
    if (s.shots) values.push(s.shots === 1 ? "Oneshot" : `${s.shots} shots`);
    if (s.boss_alive && !s.shots) values.push("Boss alive");
    if (s.boss_damage != null) values.push(`Damage done: ${s.boss_damage.toLocaleString()}`);
    if (s.fr_total != null) values.push(`Total FR: ${s.fr_total}`);
    return values;
}

export function SolutionPopup({ solution: s, isAdmin, onUnflagged, onDeleted }: { solution: Solution, isAdmin: boolean, onUnflagged: () => void, onDeleted: () => void }) {
    const battle = findBattle(s.galaxy_id, s.battle_id);
    const { hazards, supports } = getConditionNodes(battle);
    const nodeLabel = (nodes: { id: string, label: string }[], id: string) => nodes.find((n) => n.id === id)?.label ?? id;
    const perShot = !!s.shots && s.shots > 1;
    const obsolete = s.rank_in_group != null && s.rank_in_group > 1;
    const values = getPopupValues(s);
    const navigate = useNavigate();
    const [flagged, setFlagged] = useState(() => isFlaggedByUser(s));
    const [flagging, setFlagging] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [flagError, setFlagError] = useState(false);
    const [reason, setReason] = useState('');
    const [flagReasons, setFlagReasons] = useState<SolutionFlag[]>([]);
    const [adminBusy, setAdminBusy] = useState(false);
    const [adminError, setAdminError] = useState<string | null>(null);
    const flagBox = useRef<HTMLDivElement>(null);
    const flagTrigger = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isAdmin || !s.flagged) return;
        let current = true;
        getSolutionFlags(s.id)
            .then((flags) => { if (current) setFlagReasons(flags.filter((f) => f.resolved_at == null && f.reason)); })
            .catch(() => {});
        return () => { current = false; };
    }, [isAdmin, s.id, s.flagged]);

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

    const flag = async () => {
        setSubmitting(true);
        setFlagError(false);
        try {
            await flagSolution(s.id, reason);
            rememberFlagged(s.id);
            setFlagged(true);
            setFlagging(false);
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
            onUnflagged();
        } catch {
            setAdminError('Unflagging failed, please try again');
        } finally {
            setAdminBusy(false);
        }
    }

    const remove = async () => {
        if (!window.confirm('Delete this solution? This cannot be undone.')) return;
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


                    {!isAdmin && !flagged && <button ref={flagTrigger} className={styles.flag} onClick={() => setFlagging(true)}>Flag as incorrect</button>}
                    {isAdmin && (
                        <>
                            <button className={styles.flag} onClick={remove} disabled={adminBusy}>Delete</button>
                            {s.flagged && <button onClick={unflag} disabled={adminBusy}>Unflag</button>}
                            <button onClick={() => navigate(`/edit/${s.id}`)} disabled={adminBusy}>Edit</button>
                            {adminError && <span className={styles.error}>{adminError}</span>}
                        </>
                    )}

                    {!isAdmin && flagged && <span className={styles.flagged}>Flagged as incorrect</span>}
                    {isAdmin && s.flagged && <span className={styles.flagged}>Flagged as incorrect</span>}

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
