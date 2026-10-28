import styles from "./solution.module.scss";

export function SolutionColumns({ ref, children }: { ref?: React.Ref<HTMLDivElement>, children: React.ReactNode }) {
    return <div className={styles.battles} ref={ref}>{children}</div>;
}

export function SolutionColumn({ id, title, boss, count, children }: { id?: string, title: string, boss?: boolean, count: number, children: React.ReactNode }) {
    return (
        <div className={styles.battle} id={id}>
            <div className={styles.battleName}>
                {title}
                {boss && <span className={styles.hasBoss}>Boss</span>}
                <span className={styles.count}>
                    {count}
                </span>
            </div>
            {children}
        </div>
    );
}
