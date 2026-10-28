import { useState, useEffect } from "react";
import { BaseLayout } from "../components/baselayout/baselayout";
import { FileUpload } from "../components/fileUpload/fileUpload";
import GalaxySelect from "../components/galaxySelect/galaxySelect";
import { CombatStatInput } from "../components/combatStatInput/combatStatInput";
import { Checkbox } from "../components/checkbox/checkbox";
import { isEmpty, missingInfo, resolveSolutionUpdate, submitSolution, suggestSolutionUpdate, updateSolution } from "../lib/api";
import { Solution } from "../lib/types";
import { useGalaxyAccess } from "../lib/hooks";
import { ConditionNode, galaxies, getConditionNodes, getGalaxyPurchases, getGalaxyUnlocks, isBossBattle, SHIPS_BY_CLASS } from "../lib/battles";
import styles from "./submit.module.scss";
import clsx from "clsx";
import { Link, Navigate, useParams, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/button/button";
import { rememberSuggestion } from "../components/solution/solutionPopup";

const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SCREENSHOT_MB = 10;

function screenshotError(file: File | undefined): string | null {
    if (!file) return null;
    if (!SCREENSHOT_TYPES.includes(file.type)) return "Screenshots must be PNG, JPEG or WebP";
    if (file.size > MAX_SCREENSHOT_MB * 1024 * 1024) return `Screenshots can be at most ${MAX_SCREENSHOT_MB} MB`;
    return null;
}

function selectedNodes(active: boolean, options: ConditionNode[], chosen: string[]): string[] {
    if (!active) return [];
    if (options.length === 1) return [options[0].id];
    return chosen.filter((id) => options.some((o) => o.id === id));
}

const optional = (value?: number | null) => value != null ? String(value) : "";

export default function SubmitView() {
    const { galaxy } = useParams();
    const location = useLocation();
    const access = useGalaxyAccess();
    let id = undefined;
    if (galaxy) {
        id = Math.min(Math.max(parseInt(galaxy || "1", 10), 1), galaxies.length);
        if (isNaN(id)) {
            id = undefined;
        }
    }

    if (id && access.loading) return <BaseLayout />;
    if (id && !access.canView(id)) return <Navigate to="/submit" replace state={location.state} />;

    return <SolutionForm galaxy={id} />;
}

export function SolutionForm({ galaxy: id, solution: s, suggest, updateId }: { galaxy?: number, solution?: Solution, suggest?: boolean, updateId?: number }) {
    const navigate = useNavigate();
    const editing = !!s;
    const locked = (value: unknown) => !!suggest && !isEmpty(value);
    const [selectedGalaxy, setSelectedGalaxy] = useState<number | undefined>(s ? s.galaxy_id : id);
    const [selectedBattle, setSelectedBattle] = useState<number | undefined>(() => {
        if (!s) return undefined;
        const index = galaxies[s.galaxy_id - 1]?.battles.findIndex((b) => b.id === s.battle_id) ?? -1;
        return index >= 0 ? index + 1 : undefined;
    });
    const [screenshot, setScreenshot] = useState<File | undefined>(undefined);

    const location = useLocation();
    useEffect(() => {
        const state = location.state as { pastedFile?: File } | null;
        if (state?.pastedFile) {
            setScreenshot(state.pastedFile);
            window.history.replaceState({}, '');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (suggest) return;
        const handler = (e: Event) => setScreenshot((e as CustomEvent<File>).detail);
        window.addEventListener('fv:paste-image', handler);
        return () => window.removeEventListener('fv:paste-image', handler);
    }, [suggest]);

    const [combatStats, setCombatStats] = useState<string>(s ? String(s.combat_stats) : "1");
    const [frUsed, setFrUsed] = useState<string>(s ? String(s.fr_used) : "");
    const [frCommitted, setFrCommitted] = useState<string>(optional(s?.fr_committed));
    const [hazard, setHazard] = useState(s?.hazards ?? false);
    const [hazardNodes, setHazardNodes] = useState<string[]>(s?.hazard_nodes ?? []);
    const [support, setSupport] = useState(s?.support ?? false);
    const [supportNodes, setSupportNodes] = useState<string[]>(s?.support_nodes ?? []);
    const [bossDefeated, setBossDefeated] = useState(s?.boss_alive === false);
    const [unlocks, setUnlocks] = useState<string[]>(s?.unlocks ?? []);
    const [purchases, setPurchases] = useState<Record<string, string>>(s?.purchases ?? {});
    const [shots, setShots] = useState<string>(optional(s?.shots));
    const [frTotal, setFrTotal] = useState<string>(optional(s?.fr_total));
    const [bossDamage, setBossDamage] = useState<string>(optional(s?.boss_damage));
    const [notes, setNotes] = useState<string>(s?.notes ?? "");
    const [unflag, setUnflag] = useState(true);
    const [verified, setVerified] = useState(s?.verified_at != null);

    const battleData = selectedGalaxy && selectedBattle
        ? galaxies[selectedGalaxy - 1]?.battles[selectedBattle - 1]
        : undefined;
    const { hazards: hazardOptions, supports: supportOptions } = getConditionNodes(battleData);
    const isBoss = isBossBattle(battleData);
    const showConditionField = hazardOptions.length > 0 || supportOptions.length > 0;
    const [loading, setLoading] = useState(false);

    const frUsedValue = parseFloat(frUsed.replace(",", "."));
    const frCommittedValue = parseFloat(frCommitted.replace(",", "."));
    const frCommittedTooLow = !isNaN(frUsedValue) && !isNaN(frCommittedValue) && frCommittedValue < frUsedValue;

    const galaxyUnlocks = getGalaxyUnlocks(selectedGalaxy);
    const galaxyPurchases = getGalaxyPurchases(selectedGalaxy);
    const showBossResults = isBoss && !bossDefeated;
    const shotsValue = parseInt(shots, 10);
    const multiShot = showBossResults && shotsValue > 1;
    const frTotalValue = parseFloat(frTotal.replace(",", "."));
    const bossDamageValue = parseFloat(bossDamage.replace(",", "."));
    const frTotalTooLow = multiShot && !isNaN(frUsedValue) && !isNaN(frTotalValue) && frTotalValue < frUsedValue;
    const screenshotProblem = screenshotError(screenshot);

    const toggleNode = (setter: (update: (prev: string[]) => string[]) => void) => (nodeId: string, checked: boolean) =>
        setter((prev) => checked ? [...prev, nodeId] : prev.filter((n) => n !== nodeId));

    const fields = battleData && {
        galaxyId: selectedGalaxy!,
        battleId: battleData.id,
        combatStats: parseFloat(combatStats.replace(",", ".")),
        frUsed: frUsedValue,
        frCommitted: frCommittedValue,
        notes: notes,
        screenshot: screenshot || undefined,
        hazards: hazard,
        hazardNodes: selectedNodes(hazard, hazardOptions, hazardNodes),
        support: support,
        supportNodes: selectedNodes(support, supportOptions, supportNodes),
        bossAlive: isBoss && (bossDefeated || !suggest || s?.boss_alive != null || shotsValue > 0 || Number.isFinite(bossDamageValue)) ? !bossDefeated : null,
        unlocks: unlocks.filter((u) => galaxyUnlocks.some((g) => g.code === u)),
        purchases: Object.fromEntries(Object.entries(purchases).filter(([node, ship]) => ship && galaxyPurchases.some((p) => p.name === node))),
        shots: showBossResults && shotsValue > 0 ? shotsValue : null,
        frTotal: multiShot && Number.isFinite(frTotalValue) ? frTotalValue : null,
        bossDamage: showBossResults && Number.isFinite(bossDamageValue) ? bossDamageValue : null,
    };
    const filledIn = suggest && s && fields ? missingInfo(s, fields) : {};

    const submit = () => {
        if (!fields) return;
        setLoading(true);
        const request = suggest && s
            ? suggestSolutionUpdate(s.id, filledIn).then((updateId) => { rememberSuggestion(s.id, updateId); return s.id; })
            : s
            ? updateSolution(s.id, fields, s.flagged && unflag, verified).then(() => updateId ? resolveSolutionUpdate(updateId, true) : undefined).then(() => s.id)
            : submitSolution({ ...fields, advancedSolution: undefined, submittedBy: "Anonymous" });
        request.then((solutionId) => {
            navigate(`/g/${selectedGalaxy}?solution=${solutionId}`, { replace: editing });
        }).catch((e) => {
            alert(`Failed to ${suggest ? "submit changes" : editing ? "save solution" : "submit solution"}: ` + e.message);
            console.error(e);
            setLoading(false);
        });
    };

    return (
        <BaseLayout galaxy={s?.galaxy_id}>
            <div className={styles.form}>
                <Link to={s ? `/g/${s.galaxy_id}?solution=${s.id}` : `/g/${id}`} className={styles.backlink}>
                    {editing ? "← Back to solution" : "← Back to galaxy"}
                </Link>
                {!editing && (
                    <div className={styles.disclaimer}>
                        <strong>Thank you for submitting to the fleet vault. </strong>Please ensure your screenshot is in <strong>horizontal orientation</strong>, and any notes you provide are written in <strong>english</strong>. Ideally, please use the default skin for your ships, and include all relevant information down below.
                    </div>
                )}
                {suggest && (
                    <div className={styles.disclaimer}>
                        <strong>Please fill in any missing information. </strong>Only empty fields can be filled in. To edit existing information, please flag the solution for review instead.
                    </div>
                )}
                {(!suggest || s?.screenshot_url) && <FileUpload
                    accept={SCREENSHOT_TYPES.join(",")}
                    preview
                    file={screenshot}
                    previewSrc={s?.screenshot_url ?? undefined}
                    className={styles.fileUpload}
                    onFileSelected={(file) => setScreenshot(file)}
                    idleText={screenshot ? screenshot.name : "Click or drag a screenshot to upload"}
                    disabled={suggest}
                />}
                {screenshotProblem && (
                    <span className={styles.error}>{screenshotProblem}</span>
                )}
                <div className={styles.field}>
                    <span className={styles.label}>Galaxy</span>
                    <GalaxySelect isSelect selected={selectedGalaxy} className={styles.galaxySelect} disabled={suggest} callback={(galaxyId) => { setSelectedGalaxy(galaxyId); setSelectedBattle(undefined); setCombatStats("1"); setUnlocks([]); setPurchases({}); }} />
                </div>
                <div className={clsx(styles.field, {[styles.hidden]: !selectedGalaxy})}>
                    <span className={styles.label}>Battle</span>
                    <GalaxySelect
                        isSelect
                        selected={selectedBattle}
                        className={styles.galaxySelect}
                        placeholder="Select Battle"
                        disabled={suggest}
                        items={selectedGalaxy
                            ? galaxies[selectedGalaxy - 1]?.battles.map((b, i) => ({ label: b.name, value: i + 1 }))
                            : []}
                        callback={(battleId) => {
                            setSelectedBattle(battleId);
                            setHazard(false);
                            setHazardNodes([]);
                            setSupport(false);
                            setSupportNodes([]);
                            setBossDefeated(false);
                            setShots("");
                            setFrTotal("");
                            setBossDamage("");
                        }}
                    />
                </div>
                <div className={clsx(styles.field, { [styles.hidden]: !selectedGalaxy })}>
                    <span className={styles.label}>Combat Stats</span>
                    <CombatStatInput
                        value={combatStats}
                        onChange={setCombatStats}
                        min={selectedGalaxy ? galaxies[selectedGalaxy - 1].minStats : 1}
                        max={selectedGalaxy ? galaxies[selectedGalaxy - 1].maxStats : 1}
                        step={selectedGalaxy ? galaxies[selectedGalaxy - 1].step : 0.025}
                        disabled={!selectedGalaxy || suggest}
                    />
                </div>
                <div className={clsx(styles.field, { [styles.hidden]: !selectedGalaxy })}>
                    <span className={styles.label}>{multiShot ? "FR Used (per shot)" : "FR Used"}</span>
                    <CombatStatInput
                        value={frUsed}
                        onChange={setFrUsed}
                        min={0}
                        step={0.01}
                        decimals={2}
                        stepper={false}
                        allowEmpty
                        disabled={!selectedGalaxy || suggest}
                    />
                </div>
                <div className={clsx(styles.field, { [styles.hidden]: !selectedGalaxy })}>
                    <span className={styles.label}>FR Committed</span>
                    <CombatStatInput
                        value={frCommitted}
                        onChange={setFrCommitted}
                        min={0}
                        step={0.01}
                        decimals={2}
                        stepper={false}
                        allowEmpty
                        disabled={!selectedGalaxy || locked(s?.fr_committed)}
                    />
                </div>
                {frCommittedTooLow && (
                    <span className={styles.error}>FR Committed can't be lower than FR Used</span>
                )}
                {showConditionField && (
                    <div className={clsx(styles.field, { [styles.hidden]: !selectedBattle })}>
                        <span className={styles.label}>Active</span>
                        <div className={styles.checkboxes}>
                            {hazardOptions.length > 0 && (
                                <Checkbox checked={hazard} onChange={setHazard} disabled={suggest}>Hazard</Checkbox>
                            )}
                            {supportOptions.length > 0 && (
                                <Checkbox checked={support} onChange={setSupport} disabled={suggest}>Support</Checkbox>
                            )}
                        </div>
                    </div>
                )}
                {hazard && hazardOptions.length > 1 && (
                    <NodeField label="Which hazards? (optional)" options={hazardOptions} selected={hazardNodes} onToggle={toggleNode(setHazardNodes)} disabled={locked(s?.hazard_nodes)} />
                )}
                {support && supportOptions.length > 1 && (
                    <NodeField label="Which supports? (optional)" options={supportOptions} selected={supportNodes} onToggle={toggleNode(setSupportNodes)} disabled={locked(s?.support_nodes)} />
                )}
                {galaxyUnlocks.length > 0 && (
                    <div className={clsx(styles.field, { [styles.hidden]: !selectedBattle })}>
                        <span className={styles.label}>Unlocked</span>
                        <div className={styles.checkboxes}>
                            {galaxyUnlocks.map((u) => (
                                <Checkbox
                                    key={u.code}
                                    checked={unlocks.includes(u.code)}
                                    onChange={(checked) => setUnlocks((prev) => checked ? [...prev, u.code] : prev.filter((c) => c !== u.code))}
                                    disabled={locked(s?.unlocks)}
                                >
                                    {u.code} ({u.name})
                                </Checkbox>
                            ))}
                        </div>
                    </div>
                )}
                {galaxyPurchases.length > 0 && (
                    <details className={clsx(styles.purchases, { [styles.hidden]: !selectedBattle })}>
                        <summary className={styles.label}>Ship purchases &amp; patrols (optional)</summary>
                        <div className={styles.purchaseGrid}>
                            {galaxyPurchases.map((p) => (
                                <label key={p.id} className={styles.purchase}>
                                    <span>{p.name} <span className={styles.purchaseKind}>{p.kind === "buy" ? "buy" : "patrol"}</span></span>
                                    <select
                                        value={purchases[p.name] ?? ""}
                                        onChange={(e) => setPurchases((prev) => ({ ...prev, [p.name]: e.target.value }))}
                                        disabled={locked(s?.purchases?.[p.name])}
                                    >
                                        <option value="">–</option>
                                        <option value="none">None</option>
                                        {SHIPS_BY_CLASS[p.class].map((ship) => <option key={ship} value={ship}>{ship}</option>)}
                                    </select>
                                </label>
                            ))}
                        </div>
                    </details>
                )}
                {isBoss && (
                    <div className={styles.field}>
                        <span className={styles.label}>Boss</span>
                        <Checkbox checked={bossDefeated} onChange={setBossDefeated} disabled={locked(s?.boss_alive)}>Already defeated</Checkbox>
                    </div>
                )}
                {showBossResults && (
                    <>
                        <div className={styles.field}>
                            <span className={styles.label}>Shots (optional)</span>
                            <CombatStatInput value={shots} onChange={setShots} min={1} step={1} decimals={0} allowEmpty disabled={locked(s?.shots)} />
                        </div>
                        {multiShot && (
                            <div className={styles.field}>
                                <span className={styles.label}>FR Total (all shots)</span>
                                <CombatStatInput value={frTotal} onChange={setFrTotal} min={0} step={0.01} decimals={2} stepper={false} allowEmpty disabled={locked(s?.fr_total)} />
                            </div>
                        )}
                        <div className={styles.field}>
                            <span className={styles.label}>Boss Damage (optional)</span>
                            <CombatStatInput value={bossDamage} onChange={setBossDamage} min={0} step={0.01} decimals={2} stepper={false} allowEmpty disabled={locked(s?.boss_damage)} />
                        </div>
                        {frTotalTooLow && (
                            <span className={styles.error}>FR Total can't be lower than FR Used</span>
                        )}
                    </>
                )}
                <div className={clsx(styles.field, styles.vertical)}>
                    <span className={styles.label}>Notes</span>
                    <textarea
                        name="notes"
                        className={styles.notes}
                        placeholder="Oneshot, Better results with additional Cruiser, ..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>
                {s?.flagged && !suggest && (
                    <Checkbox checked={unflag} onChange={setUnflag}>Unflag solution</Checkbox>
                )}
                {s && !suggest && (
                    <Checkbox checked={verified} onChange={setVerified}>Verified</Checkbox>
                )}
                <Button disabled={
                    loading ||
                    !frUsed ||
                    frCommittedTooLow ||
                    frTotalTooLow ||
                    (!screenshot && !editing) ||
                    !!screenshotProblem ||
                    !selectedGalaxy ||
                    !selectedBattle ||
                    !combatStats ||
                    (suggest && !Object.keys(filledIn).length)
                } onClick={() => submit()}>
                    {suggest ? (loading ? "Submitting..." : "Submit changes") : editing ? (loading ? "Saving..." : "Save") : (loading ? "Submitting..." : "Submit")}
                </Button>
            </div>
        </BaseLayout>
    );
}

function NodeField({ label, options, selected, onToggle, disabled }: {
    label: string;
    options: ConditionNode[];
    selected: string[];
    onToggle: (id: string, checked: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <div className={styles.field}>
            <span className={styles.label}>{label}</span>
            <div className={clsx(styles.checkboxes, styles.nodeList)}>
                {options.map((o) => (
                    <Checkbox key={o.id} checked={selected.includes(o.id)} onChange={(checked) => onToggle(o.id, checked)} disabled={disabled}>
                        {o.label}
                    </Checkbox>
                ))}
            </div>
        </div>
    );
}
