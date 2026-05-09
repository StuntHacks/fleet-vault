import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdvisorList } from "../components/advisorList/advisorList";
import { BaseLayout } from "../components/baselayout/baselayout";
import { Button } from "../components/button/button";
import { FleetGrid } from "../components/fleetGrid/fleetGrid";
import { HazardSelect } from "../components/hazardSelect/hazardSelect";
import { useAdminSession } from "../lib/hooks";
import { fetchAdvisors, fetchWikiGalaxies, ParsedAdvisor, WikiGalaxy } from "../lib/wiki";
import styles from "./advisor.module.scss";

export default function AdvisorView() {
    const session = useAdminSession();
    const navigate = useNavigate();

    const [galaxies, setGalaxies] = useState<WikiGalaxy[] | null>(null);
    const [selectedGalaxyId, setSelectedGalaxyId] = useState("");
    const [selectedBattleId, setSelectedBattleId] = useState("");
    const [statValue, setStatValue] = useState("");
    const [hazardIds, setHazardIds] = useState<string[]>([]);
    const [bossActive, setBossActive] = useState(false);
    const [advisors, setAdvisors] = useState<ParsedAdvisor[]>([]);
    const [selectedAdvisorIndex, setSelectedAdvisorIndex] = useState(-1);
    const [loading, setLoading] = useState(false);
    const [noResults, setNoResults] = useState(false);
    const lastHashRef = useRef("");

    useEffect(() => {
        if (session === null) navigate('/');
    }, [session, navigate]);

    useEffect(() => {
        fetchWikiGalaxies().then(setGalaxies);
    }, []);

    const findAdvisors = useCallback(async () => {
        const stat = parseFloat(statValue).toFixed(3);
        const hash = `${selectedBattleId}_${stat}_${bossActive}_${hazardIds.join("")}`;
        if (hash === lastHashRef.current) return;
        lastHashRef.current = hash;

        setLoading(true);
        setNoResults(false);
        setAdvisors([]);
        setSelectedAdvisorIndex(-1);

        try {
            const parsed = await fetchAdvisors({
                battleId: selectedBattleId,
                combatStat: parseFloat(stat),
                hasBoss: bossActive,
                hazardIds,
            });
            setAdvisors(parsed);
            if (parsed.length === 0) setNoResults(true);
        } catch {
            setNoResults(true);
        } finally {
            setLoading(false);
        }
    }, [selectedBattleId, statValue, bossActive, hazardIds]);

    if (session === undefined || session === null) return null;

    const galaxy = galaxies?.find((g) => g.id === selectedGalaxyId);
    const battleData = galaxy?.battles.find((b) => b.id === selectedBattleId);

    const resetResults = () => {
        setAdvisors([]);
        setSelectedAdvisorIndex(-1);
        setNoResults(false);
        lastHashRef.current = "";
    };

    const handleGalaxyChange = (id: string) => {
        const g = galaxies?.find((gx) => gx.id === id);
        setSelectedGalaxyId(id);
        setSelectedBattleId(g?.battles[0]?.id ?? "");
        setStatValue(g?.minStats?.toString() ?? "");
        setHazardIds([]);
        setBossActive(false);
        resetResults();
    };

    const handleBattleChange = (id: string) => {
        setSelectedBattleId(id);
        setHazardIds([]);
        setBossActive(false);
        resetResults();
    };

    const handleStatChange = (raw: string) => {
        if (raw === "" || raw === "-") { setStatValue(raw); return; }
        setStatValue(raw);
    };

    const validateStat = () => {
        if (!galaxy) return;
        let v = parseFloat(statValue);
        if (isNaN(v)) v = galaxy.minStats;
        if (v < galaxy.minStats) v = galaxy.minStats;
        if (v > galaxy.maxStats) v = galaxy.maxStats;
        setStatValue(v.toFixed(3));
    };

    const stepStat = (dir: number) => {
        if (!galaxy) return;
        let v = parseFloat(statValue) || galaxy.minStats;
        v = parseFloat((v + dir * galaxy.step).toFixed(3));
        if (v < galaxy.minStats) v = galaxy.minStats;
        if (v > galaxy.maxStats) v = galaxy.maxStats;
        setStatValue(v.toFixed(3));
    };

    const handleHazardChange = (id: string, checked: boolean) => {
        setHazardIds((prev) => checked ? [...prev, id] : prev.filter((h) => h !== id));
    };

    const canSearch = !!selectedGalaxyId && !!selectedBattleId && !!statValue;
    const selectedAdvisor = selectedAdvisorIndex >= 0 ? advisors[selectedAdvisorIndex] : null;

    const gridLabel = selectedAdvisor && galaxy && battleData
        ? `${galaxy.name} ${battleData.name} (${selectedAdvisor.fr_used.toFixed(2)} used)`
        : null;

    return (
        <BaseLayout>
            <div className={styles.root}>
                <p className={styles.description}>
                    Searches for available advisors for the given galaxy &amp; battle.
                    Select the galaxy and battle, input your combat stats, and available
                    advisors will show up below for you to inspect.
                </p>

                <div className={styles.controls}>
                    <div className={styles.controlRow}>
                        <select
                            className={`${styles.select} ${styles.galaxySelect}`}
                            value={selectedGalaxyId}
                            onChange={(e) => handleGalaxyChange(e.target.value)}
                            disabled={!galaxies}
                        >
                            <option value="" disabled hidden>Select galaxy</option>
                            {galaxies?.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>

                        <div className={styles.statControl}>
                            <button
                                className={styles.stepBtn}
                                onClick={() => stepStat(-1)}
                                disabled={!selectedGalaxyId}
                            >
                                −
                            </button>
                            <input
                                className={styles.statInput}
                                type="number"
                                value={statValue}
                                onChange={(e) => handleStatChange(e.target.value)}
                                onBlur={validateStat}
                                disabled={!selectedGalaxyId}
                                step={galaxy?.step}
                                min={galaxy?.minStats}
                                max={galaxy?.maxStats}
                            />
                            <button
                                className={styles.stepBtn}
                                onClick={() => stepStat(1)}
                                disabled={!selectedGalaxyId}
                            >
                                +
                            </button>
                        </div>

                        <select
                            className={`${styles.select} ${styles.battleSelect}`}
                            value={selectedBattleId}
                            onChange={(e) => handleBattleChange(e.target.value)}
                            disabled={!selectedGalaxyId}
                        >
                            {galaxy?.battles.map((b) => (
                                <option key={b.id} value={b.id} className={`opt-${b.color}`}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {battleData && (
                        <HazardSelect
                            battleData={battleData}
                            hazardIds={hazardIds}
                            bossActive={bossActive}
                            onHazardChange={handleHazardChange}
                            onBossChange={setBossActive}
                        />
                    )}

                    <Button onClick={findAdvisors} disabled={!canSearch || loading}>
                        {loading ? "Searching…" : "Find Advisors"}
                    </Button>
                </div>

                {noResults && (
                    <div className={styles.noResults}>
                        No advisors found for the selected battle &amp; stat combination
                    </div>
                )}

                <AdvisorList
                    advisors={advisors}
                    selectedIndex={selectedAdvisorIndex}
                    onSelect={setSelectedAdvisorIndex}
                />

                <FleetGrid
                    ships={selectedAdvisor?.ships ?? []}
                    label={gridLabel}
                />
            </div>
        </BaseLayout>
    );
}
