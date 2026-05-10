import { useState, useEffect } from "react";
import { BaseLayout } from "../components/baselayout/baselayout";
import { FileUpload } from "../components/fileUpload/fileUpload";
import GalaxySelect from "../components/galaxySelect/galaxySelect";
import { CombatStatInput } from "../components/combatStatInput/combatStatInput";
import { Checkbox } from "../components/checkbox/checkbox";
import { submitSolution } from "../lib/api";
import { Battle } from "../lib/advisor";
import styles from "./submit.module.scss";
import clsx from "clsx";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import galaxyData from "../data.json";
import { Button } from "../components/button/button";

export default function SubmitView() {
    const navigate = useNavigate();
    const { galaxy } = useParams();
    let id = undefined;
    if (galaxy) {
        id = Math.min(Math.max(parseInt(galaxy || "1", 10), 1), galaxyData.galaxies.length);
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
    const [support, setSupport] = useState(false);
    const [notes, setNotes] = useState<string>("");

    const battleData = (selectedGalaxy && selectedBattle
        ? galaxyData.galaxies[selectedGalaxy - 1]?.battles[selectedBattle - 1]
        : undefined) as Battle | undefined;
    const battleHazards = battleData?.hazard ?? [];
    const hasBattleHazard = battleHazards.some((h) => !h.node.startsWith("F"));
    const hasBattleSupport = battleHazards.some((h) => h.node.startsWith("F"));
    const showHazardField = hasBattleHazard || hasBattleSupport;
    const [loading, setLoading] = useState(false);

    const submit = () => {
        setLoading(true);
        submitSolution({
            galaxyId: selectedGalaxy!,
            battleId: selectedBattle!,
            combatStats: parseFloat(combatStats.replace(",", ".")),
            frUsed: parseFloat(frUsed.replace(",", ".")),
            frCommitted: parseFloat(frCommitted.replace(",", ".")),
            notes: notes,
            screenshot: screenshot || undefined,
            advancedSolution: undefined,
            hazards: hazard,
            support: support,
            submittedBy: "Anonymous",
        }).then(() => {
            // navigate(`/g/${selectedGalaxy}/b/${selectedBattle}`);
            navigate(`/g/${selectedGalaxy}`);
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
                            ? galaxyData.galaxies[selectedGalaxy - 1]?.battles.map((b, i) => ({ label: b.name, value: i + 1 }))
                            : []}
                        callback={(battleId) => { setSelectedBattle(battleId); setHazard(false); setSupport(false); }}
                    />
                </div>
                <div className={clsx(styles.field, { [styles.hidden]: !selectedGalaxy })}>
                    <span className={styles.label}>Combat Stats</span>
                    <CombatStatInput
                        value={combatStats}
                        onChange={setCombatStats}
                        min={selectedGalaxy ? galaxyData.galaxies[selectedGalaxy - 1].minStats : 1}
                        max={selectedGalaxy ? galaxyData.galaxies[selectedGalaxy - 1].maxStats : 1}
                        step={selectedGalaxy ? galaxyData.galaxies[selectedGalaxy - 1].step : 0.025}
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
                {showHazardField && (
                    <div className={clsx(styles.field, { [styles.hidden]: !selectedBattle })}>
                        <span className={styles.label}>Active</span>
                        <div className={styles.checkboxes}>
                            {hasBattleHazard && (
                                <Checkbox checked={hazard} onChange={setHazard}>Hazard</Checkbox>
                            )}
                            {hasBattleSupport && (
                                <Checkbox checked={support} onChange={setSupport}>Support</Checkbox>
                            )}
                        </div>
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
