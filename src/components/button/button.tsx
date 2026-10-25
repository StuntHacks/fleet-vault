import { clsx } from 'clsx';
import styles from './button.module.scss';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'flag';
  disabled?: boolean;
}

export function Button(props: ButtonProps) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={clsx(styles.button, { [styles.secondary]: props.variant === 'secondary' || props.variant === 'flag', [styles.flag]: props.variant === 'flag' })}
    >
      {props.children}
    </button>
  );
}
