import { clsx } from "clsx";
import styles from "./checkbox.module.scss";

interface CheckboxProps {
    className?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    children: React.ReactNode;
    name?: string;
}

export function Checkbox({ className, checked, onChange, children, name }: CheckboxProps) {
    return (
        <label className={clsx(styles.checkbox, className)}>
            <input
                type="checkbox"
                name={name}
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            {children}
        </label>
    );
}
