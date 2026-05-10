import { clsx } from "clsx";
import styles from "./combatStatInput.module.scss";

interface CombatStatInputProps {
    className?: string;
    value: string;
    onChange: (value: string) => void;
    min: number;
    max?: number;
    step: number;
    decimals?: number;
    stepper?: boolean;
    allowEmpty?: boolean;
    disabled?: boolean;
}

export function CombatStatInput({ className, value, onChange, min, max, step, decimals = 3, stepper = true, allowEmpty = false, disabled }: CombatStatInputProps) {
    const handleChange = (raw: string) => {
        if (raw === "" || raw === "-") { onChange(raw); return; }
        onChange(raw);
    };

    const validate = () => {
        if (allowEmpty && value === "") return;
        let v = parseFloat(value);
        if (isNaN(v)) v = min;
        if (v < min) v = min;
        if (max !== undefined && v > max) v = max;
        onChange(v.toFixed(decimals));
    };

    const step_ = (dir: number) => {
        let v = parseFloat(value) || min;
        v = parseFloat((v + dir * step).toFixed(decimals));
        if (v < min) v = min;
        if (max !== undefined && v > max) v = max;
        onChange(v.toFixed(decimals));
    };

    return (
        <div className={clsx(styles.statControl, className)}>
            <button className={clsx(styles.stepBtn, { [styles.hidden]: !stepper })} onClick={() => step_(-1)} disabled={disabled || !stepper}>
                −
            </button>
            <input
                className={styles.statInput}
                type="number"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={validate}
                disabled={disabled}
                step={step}
                min={min}
                max={max}
            />
            <button className={clsx(styles.stepBtn, { [styles.hidden]: !stepper })} onClick={() => step_(1)} disabled={disabled || !stepper}>
                +
            </button>
        </div>
    );
}
