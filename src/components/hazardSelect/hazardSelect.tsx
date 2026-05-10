import { Battle } from '../../lib/advisor';
import styles from './hazardSelect.module.scss';

interface HazardSelectProps {
    battleData: Battle;
    hazardIds: string[];
    bossActive: boolean;
    onHazardChange: (id: string, checked: boolean) => void;
    onBossChange: (active: boolean) => void;
}

export function HazardSelect({ battleData, hazardIds, bossActive, onHazardChange, onBossChange }: HazardSelectProps) {
    const hasHazards = battleData.hazard && battleData.hazard.length > 0;
    const hasBoss = !!battleData.boss;

    if (!hasHazards && !hasBoss) return null;

    return (
        <div className={styles.wrapper}>
            <div className={styles.label}>Hazards & Supports</div>
            <div className={styles.options}>
                {hasHazards && battleData.hazard!.map((hazard) => {
                    const id = `hazard-${hazard.id}-${hazard.type.replaceAll(" ", "_")}`;
                    return (
                        <label key={id} className={styles.option}>
                            <span className={styles.hazardNode}>
                                <input
                                    type="checkbox"
                                    id={id}
                                    value={hazard.id}
                                    checked={hazardIds.includes(hazard.id)}
                                    onChange={(e) => onHazardChange(hazard.id, e.target.checked)}
                                />
                                {hazard.node}
                            </span>
                            <span className={styles.hazardType}>({hazard.type})</span>
                        </label>
                    );
                })}
                {hasBoss && (
                    <label className={`${styles.option} ${styles.bossOption}`}>
                        <input
                            type="checkbox"
                            checked={bossActive}
                            onChange={(e) => onBossChange(e.target.checked)}
                        />
                        <span>Boss active</span>
                    </label>
                )}
            </div>
        </div>
    );
}
