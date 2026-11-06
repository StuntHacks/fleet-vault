import { Unlock } from '../../lib/battles';
import styles from './unlockSelect.module.scss';

interface UnlockSelectProps {
    unlocks: Unlock[];
    selected: string[];
    onChange: (node: string, checked: boolean) => void;
}

export function UnlockSelect({ unlocks, selected, onChange }: UnlockSelectProps) {
    const options = unlocks.filter((u) => u.advisorNode);
    if (options.length === 0) return null;

    return (
        <div className={styles.wrapper}>
            <div className={styles.label}>Unlocks</div>
            <div className={styles.options}>
                {options.map((u) => (
                    <label key={u.advisorNode} className={styles.option}>
                        <input
                            type="checkbox"
                            checked={selected.includes(u.advisorNode!)}
                            onChange={(e) => onChange(u.advisorNode!, e.target.checked)}
                        />
                        <span>{u.name}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}
