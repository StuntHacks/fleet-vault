import { clsx } from 'clsx';
import icons from '../../assets/icons';
import { GRID_IMAGES, MOD_MAP, ParsedAdvisor, shipImage, shipNameToClass, shipNameToDisplayName } from '../../lib/advisor';
import styles from './fleetGrid.module.scss';

const GRID_COLUMNS = [
    { label: "C", x: 2 },
    { label: "B", x: 1 },
    { label: "A", x: 0 },
];

const GRID_ROWS = [0, 1, 2, 3, 4];

interface FleetGridProps {
    ships: ParsedAdvisor['ships'];
    label?: string | null;
}

export function FleetGrid({ ships, label }: FleetGridProps) {
    console.log("Rendering FleetGrid with ships:", ships);
    const slotMap: Record<string, string> = {};
    for (const ship of ships) {
        const key = `${ship.position.x};${ship.position.y}`;
        let cls = shipNameToClass(ship.name);
        if (cls === "cruiser" && ship.mods.includes("CruiserSingleArmorTank")) {
            cls = "single_cruiser";
        }
        if (cls) slotMap[key] = cls;
    }

    const uniqueShips: Array<{ name: string; mods: string[] }> = [];
    for (const ship of ships) {
        if (!uniqueShips.some((s) => s.name === ship.name)) {
            uniqueShips.push({ name: ship.name, mods: ship.mods });
        }
    }

    return (
        <div className={styles.wrapper}>
            <div className={styles.grid}>
                {GRID_COLUMNS.map(({ label: colLabel, x }) => (
                    <div key={x} className={styles.column}>
                        <div className={styles.colLabel}>{colLabel}</div>
                        {GRID_ROWS.map((y) => {
                            const cls = slotMap[`${x};${y}`] ?? "";
                            const bgImage = cls && GRID_IMAGES[cls] ? GRID_IMAGES[cls] : undefined;
                            return (
                                <div
                                    key={y}
                                    className={clsx(styles.slot, cls && styles[cls])}
                                    style={bgImage ? { backgroundImage: `url("${bgImage}")` } : undefined}
                                />
                            );
                        })}
                    </div>
                ))}

                <div className={styles.shipsColumn}>
                    {label && <div className={styles.shipsLabel}>{label}</div>}
                    {uniqueShips.map((ship) => {
                        const cls = shipNameToClass(ship.name);
                        const img = cls ? shipImage(cls) : null;
                        const mods = ship.mods.map((mod) => MOD_MAP[mod]).filter(Boolean);
                        return (
                            <div key={ship.name} className={styles.shipEntry}>
                                <span className={styles.shipTitle}>
                                    {shipNameToDisplayName(ship.name)}
                                    {img && (
                                        <img src={img} alt={cls} className={styles.shipTitleImg} />
                                    )}
                                </span>
                                {mods.length > 0 && (
                                    <ul className={styles.modList}>
                                        {mods.map((m) => (
                                            <li key={m.name}>
                                                {icons[m.icon] && (
                                                    <img src={icons[m.icon]} alt={m.icon} className={styles.modIcon} />
                                                )}
                                                {m.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
