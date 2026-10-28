import { clsx } from "clsx";
import styles from "./checkbox.module.scss";

interface CheckboxProps {
    className?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    children: React.ReactNode;
    name?: string;
    disabled?: boolean;
}

export function Checkbox({ className, checked, onChange, children, name, disabled }: CheckboxProps) {
    return (
        <label className={clsx(styles.checkbox, className, { [styles.disabled]: disabled })}>
            <input
                type="checkbox"
                name={name}
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
            />
            {children}
        </label>
    );
}
