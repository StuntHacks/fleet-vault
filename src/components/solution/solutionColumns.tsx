import styles from "./solution.module.scss";

export function SolutionColumns({ ref, children }: { ref?: React.Ref<HTMLDivElement>, children: React.ReactNode }) {
    return <div className={styles.battles} ref={ref}>{children}</div>;
}

export interface ColumnMove {
    earlier: (() => void) | null;
    later: (() => void) | null;
}

export function SolutionColumn({ id, title, boss, count, move, children }: { id?: string, title: string, boss?: boolean, count: number, move?: ColumnMove, children: React.ReactNode }) {
    return (
        <div className={styles.battle} id={id}>
            <div className={styles.battleName}>
                {title}
                {boss && <span className={styles.hasBoss}>Boss</span>}
                <span className={styles.count}>
                    {count}
                </span>
                {move && (
                    <span className={styles.move}>
                        <button onClick={move.earlier ?? undefined} disabled={!move.earlier} title={`Move ${title} to the left`}>‹</button>
                        <button onClick={move.later ?? undefined} disabled={!move.later} title={`Move ${title} to the right`}>›</button>
                    </span>
                )}
            </div>
            <div className={styles.entries}>{children}</div>
        </div>
    );
}
