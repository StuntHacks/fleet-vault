import { useState } from 'react';
import { clsx } from 'clsx';
import { ParsedAdvisor, shipImage, shipNameToClass } from '../../lib/wiki';
import { Button } from '../button/button';
import styles from './advisorList.module.scss';

interface AdvisorCardProps {
    advisor: ParsedAdvisor;
    selected: boolean;
    onClick: () => void;
}

function AdvisorCard({ advisor, selected, onClick }: AdvisorCardProps) {
    const leftover = (advisor.fr_committed - advisor.fr_used).toFixed(2);
    const renderedShipNames: string[] = [];

    return (
        <div className={clsx(styles.card, { [styles.selected]: selected })} onClick={onClick}>
            <span className={styles.frMain}>
                {leftover}/{advisor.fr_committed} FR
            </span>
            <span className={styles.frSecondary}>({advisor.fr_used.toFixed(2)} used)</span>
            {!!advisor.boss_damage && !isNaN(advisor.boss_damage) && (
                <span className={styles.frSecondary}>
                    {advisor.boss_damage.toFixed(2)} dmg to boss
                </span>
            )}
            <div className={styles.shipIcons}>
                {advisor.ships.map((ship) => {
                    if (renderedShipNames.includes(ship.name)) return null;
                    renderedShipNames.push(ship.name);
                    const cls = shipNameToClass(ship.name);
                    const src = cls ? shipImage(cls) : null;
                    if (!src) return null;
                    return (
                        <img
                            key={ship.name}
                            src={src}
                            alt={cls}
                            className={clsx(styles.shipIcon, cls === "fighters" && styles.shipIconNarrow)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

interface AdvisorListProps {
    advisors: ParsedAdvisor[];
    selectedIndex: number;
    onSelect: (index: number) => void;
}

export function AdvisorList({ advisors, selectedIndex, onSelect }: AdvisorListProps) {
    const [expanded, setExpanded] = useState(false);

    if (advisors.length === 0) return null;

    const visible = advisors.slice(0, 5);
    const hidden = advisors.slice(5);

    return (
        <div className={styles.wrapper}>
            <div className={styles.label}>Found the following advisors:</div>
            <div className={styles.list}>
                {visible.map((adv, i) => (
                    <AdvisorCard
                        key={i}
                        advisor={adv}
                        selected={selectedIndex === i}
                        onClick={() => onSelect(i)}
                    />
                ))}
                {hidden.length > 0 && (
                    <div className={styles.collapsibleSection}>
                        <div className={styles.buttonWrapper}>
                            <Button variant="secondary" onClick={() => setExpanded((e) => !e)}>
                                {expanded
                                    ? `▲ Collapse to hide ${hidden.length} more`
                                    : `▼ Expand to show ${hidden.length} more`}
                            </Button>
                        </div>
                        {expanded && hidden.map((adv, i) => (
                            <AdvisorCard
                                key={i + 5}
                                advisor={adv}
                                selected={selectedIndex === i + 5}
                                onClick={() => onSelect(i + 5)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
