import { useState } from "react";
import { BaseLayout } from "../components/baselayout/baselayout";
import { FileUpload } from "../components/fileUpload/fileUpload";
import GalaxySelect from "../components/galaxySelect/galaxySelect";
import { submitSolution } from "../lib/api";
import styles from "./submit.module.scss";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import galaxyData from "../data.json";

export default function SubmitView() {
    // const submit = () => submitSolution({
    //     galaxyId: null,
    //     battleId: null,
    //     combatStats: null,
    //     frUsed: null,
    //     notes: null,
    //     submittedBy: null,
    //     screenshot?: null,
    //     advancedSolution?: null,
    //     hazards: null,
    //     support: null,
    // });
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

    return (
        <BaseLayout>
            <div className={styles.form}>
                <FileUpload
                    accept="image/*"
                    preview
                    className={styles.fileUpload}
                    onFileSelected={(file) => setScreenshot(file)}
                    idleText={screenshot ? screenshot.name : "Click or drag a screenshot to upload"}
                />
                <div className={styles.field}>
                    <span className={styles.label}>Galaxy</span>
                    <GalaxySelect isSelect selected={selectedGalaxy} className={styles.galaxySelect} callback={(galaxyId) => setSelectedGalaxy(galaxyId)} />
                </div>
                <div className={clsx(styles.field, {[styles.hidden]: !selectedGalaxy})}>
                    <span className={styles.label}>Battle</span>
                    <GalaxySelect isSelect selected={selectedBattle} className={styles.galaxySelect} callback={(battleId) => setSelectedBattle(battleId)} />
                </div>
            </div>
        </BaseLayout>
    );
}
