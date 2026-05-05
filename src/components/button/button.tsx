import styles from './button.module.css';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export function Button(props: ButtonProps) {
  return (
    <button onClick={props.onClick} className={styles.button}>{props.children}</button>
  );
}
