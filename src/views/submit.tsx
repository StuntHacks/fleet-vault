import { useState, useEffect } from "react";
import { BaseLayout } from "../components/baselayout/baselayout";
import { FileUpload } from "../components/fileUpload/fileUpload";
import GalaxySelect from "../components/galaxySelect/galaxySelect";
import { CombatStatInput } from "../components/combatStatInput/combatStatInput";
import { Checkbox } from "../components/checkbox/checkbox";
import { submitSolution } from "../lib/api";
import { ConditionNode, galaxies, getConditionNodes, isBossBattle } from "../lib/battles";
import styles from "./submit.module.scss";
import clsx from "clsx";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/button/button";

function selectedNodes(active: boolean, options: ConditionNode[], chosen: string[]): string[] {
    if (!active) return [];
    if (options.length === 1) return [options[0].id];
    return chosen.filter((id) => options.some((o) => o.id === id));
}

export default function SubmitView() {
    const navigate = useNavigate();
    const { galaxy } = useParams();
    let id = undefined;
    if (galaxy) {
        id = Math.min(Math.max(parseInt(galaxy || "1", 10), 1), galaxies.length);
        if (isNaN(id)) {
            id = undefined;
        }
    }

    const [selectedGalaxy, setSelectedGalaxy] = useState<number | undefined>(id);
    const [selectedBattle, setSelectedBattle] = useState<number | undefined>(undefined);
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
        const handler = (e: Event) => setScreenshot((e as CustomEvent<File>).detail);
        window.addEventListener('fv:paste-image', handler);
        return () => window.removeEventListener('fv:paste-image', handler);
    }, []);
    const [combatStats, setCombatStats] = useState<string>("1");
    const [frUsed, setFrUsed] = useState<string>("");
    const [frCommitted, setFrCommitted] = useState<string>("");
    const [hazard, setHazard] = useState(false);
    const [hazardNodes, setHazardNodes] = useState<string[]>([]);
    const [support, setSupport] = useState(false);
    const [supportNodes, setSupportNodes] = useState<string[]>([]);
    const [bossDefeated, setBossDefeated] = useState(false);
    const [notes, setNotes] = useState<string>("");

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

    const toggleNode = (setter: (update: (prev: string[]) => string[]) => void) => (nodeId: string, checked: boolean) =>
        setter((prev) => checked ? [...prev, nodeId] : prev.filter((n) => n !== nodeId));

    const submit = () => {
        if (!battleData) return;
        setLoading(true);
        submitSolution({
            galaxyId: selectedGalaxy!,
            battleId: battleData.id,
            combatStats: parseFloat(combatStats.replace(",", ".")),
            frUsed: frUsedValue,
            frCommitted: frCommittedValue,
            notes: notes,
            screenshot: screenshot || undefined,
            advancedSolution: undefined,
            hazards: hazard,
            hazardNodes: selectedNodes(hazard, hazardOptions, hazardNodes),
            support: support,
            supportNodes: selectedNodes(support, supportOptions, supportNodes),
            bossAlive: isBoss ? !bossDefeated : null,
            submittedBy: "Anonymous",
        }).then(() => {
            navigate(`/g/${selectedGalaxy}/b/${battleData.id}`);
        }).catch((e) => {
            alert("Failed to submit solution: " + e.message);
            console.error(e);
            setLoading(false);
        });
    };

    return (
        <BaseLayout>
            <div className={styles.form}>
                <FileUpload
                    accept="image/*"
                    preview
                    file={screenshot}
                    className={styles.fileUpload}
                    onFileSelected={(file) => setScreenshot(file)}
                    idleText={screenshot ? screenshot.name : "Click or drag a screenshot to upload"}
                />
                <div className={styles.field}>
                    <span className={styles.label}>Galaxy</span>
                    <GalaxySelect isSelect selected={selectedGalaxy} className={styles.galaxySelect} callback={(galaxyId) => { setSelectedGalaxy(galaxyId); setSelectedBattle(undefined); setCombatStats("1"); }} />
                </div>
                <div className={clsx(styles.field, {[styles.hidden]: !selectedGalaxy})}>
                    <span className={styles.label}>Battle</span>
                    <GalaxySelect
                        isSelect
                        selected={selectedBattle}
                        className={styles.galaxySelect}
                        placeholder="Select Battle"
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
                        disabled={!selectedGalaxy}
                    />
                </div>
                <div className={clsx(styles.field, { [styles.hidden]: !selectedGalaxy })}>
                    <span className={styles.label}>FR Used</span>
                    <CombatStatInput
                        value={frUsed}
                        onChange={setFrUsed}
                        min={0}
                        step={0.01}
                        decimals={2}
                        stepper={false}
                        allowEmpty
                        disabled={!selectedGalaxy}
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
                        disabled={!selectedGalaxy}
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
                                <Checkbox checked={hazard} onChange={setHazard}>Hazard</Checkbox>
                            )}
                            {supportOptions.length > 0 && (
                                <Checkbox checked={support} onChange={setSupport}>Support</Checkbox>
                            )}
                        </div>
                    </div>
                )}
                {hazard && hazardOptions.length > 1 && (
                    <NodeField label="Which hazards? (optional)" options={hazardOptions} selected={hazardNodes} onToggle={toggleNode(setHazardNodes)} />
                )}
                {support && supportOptions.length > 1 && (
                    <NodeField label="Which supports? (optional)" options={supportOptions} selected={supportNodes} onToggle={toggleNode(setSupportNodes)} />
                )}
                {isBoss && (
                    <div className={styles.field}>
                        <span className={styles.label}>Boss</span>
                        <Checkbox checked={bossDefeated} onChange={setBossDefeated}>Already defeated</Checkbox>
                    </div>
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
                <Button disabled={
                    loading ||
                    !frUsed ||
                    frCommittedTooLow ||
                    !screenshot ||
                    !selectedGalaxy ||
                    !selectedBattle ||
                    !combatStats
                } onClick={() => submit()}>
                    {loading ? "Submitting..." : "Submit"}
                </Button>
            </div>
        </BaseLayout>
    );
}

function NodeField({ label, options, selected, onToggle }: {
    label: string;
    options: ConditionNode[];
    selected: string[];
    onToggle: (id: string, checked: boolean) => void;
}) {
    return (
        <div className={styles.field}>
            <span className={styles.label}>{label}</span>
            <div className={clsx(styles.checkboxes, styles.nodeList)}>
                {options.map((o) => (
                    <Checkbox key={o.id} checked={selected.includes(o.id)} onChange={(checked) => onToggle(o.id, checked)}>
                        {o.label}
                    </Checkbox>
                ))}
            </div>
        </div>
    );
}
