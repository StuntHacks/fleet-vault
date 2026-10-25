import { useState } from "react";
import { enableGalaxy } from "../../lib/api";
import { refreshHiddenGalaxies } from "../../lib/hooks";
import { Button } from "../button/button";
import styles from "./hiddenGalaxy.module.scss";

export function HiddenGalaxy({ galaxyId }: { galaxyId: number }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);

    const enable = async () => {
        if (!window.confirm(`Publish galaxy ${galaxyId} for everyone? This can't be undone.`)) return;
        setBusy(true);
        setError(false);
        try {
            await enableGalaxy(galaxyId);
            refreshHiddenGalaxies();
        } catch {
            setError(true);
            setBusy(false);
        }
    };

    return (
        <div className={styles.hiddenGalaxy}>
            <span>This galaxy is hidden and only visible to curators.</span>
            {error && <span className={styles.error}>Publishing failed, please try again</span>}
            <Button onClick={enable} disabled={busy}>Publish galaxy</Button>
        </div>
    );
}
