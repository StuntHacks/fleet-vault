import { clsx } from 'clsx';
import styles from './button.module.scss';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button(props: ButtonProps) {
  return (
    <button
      onClick={props.onClick}
      className={clsx(styles.button, { [styles.secondary]: props.variant === 'secondary' })}
    >
      {props.children}
    </button>
  );
}
