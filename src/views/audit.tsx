import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import { BaseLayout } from "../components/baselayout/baselayout";
import { Button } from "../components/button/button";
import { Checkbox } from "../components/checkbox/checkbox";
import { useAdminSession, useAuditLog } from "../lib/hooks";
import { AuditFilter, AuditType, getExistingSolutionIds, getSolution, undoAuditEntry } from "../lib/api";
import { findBattle } from "../lib/battles";
import { AuditEntry } from "../lib/types";
import galaxyStyles from "./galaxy.module.scss";
import styles from "./audit.module.scss";

const TABLES = { solutions: "Solution", galaxies: "Galaxy", solution_flags: "Flag", solution_updates: "Update" };
const OPERATIONS = { INSERT: "created", UPDATE: "edited", DELETE: "deleted" };
const FILTERS: Record<AuditType, string> = { flags: "Flags", changes: "Solution changes", updates: "Updates", submissions: "Submissions" };

function format(value: unknown): string {
    if (value == null) return "";

    if (Array.isArray(value)) return value.map((v) => typeof v === "object" && v ? `(${format(v)})` : String(v)).join(", ");

    if (typeof value === "object") return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(", ");

    return String(value);
}

function display(key: string, value: unknown, labels: Record<string, string>): string {
    if (typeof value === "string" && key.endsWith("_at")) return new Date(value).toLocaleString();

    if (typeof value === "string" && key.endsWith("_by")) return labels[value] ?? value;

    if (key === "battle_order" && Array.isArray(value)) return value.map((id) => findBattle(parseInt(id.slice(1), 10), id)?.name ?? id).join(", ");

    return format(value);
}

function changes(entry: AuditEntry, labels: Record<string, string>) {
    const before = entry.old_data ?? {};
    const after = entry.new_data ?? {};

    return Object.keys({ ...before, ...after })
        .filter((key) => key !== "id" && format(before[key]) !== format(after[key]))
        .map((key) => ({ key, before: display(key, before[key], labels), after: display(key, after[key], labels) }));
}

function Target({ entry }: { entry: AuditEntry }) {
    const row = (entry.new_data ?? entry.old_data ?? {}) as Record<string, any>;
    if (entry.table_name === "galaxies") {
        return <Link className={styles.target} to={`/g/${entry.record_id}`}>Galaxy {entry.record_id}</Link>;
    }

    if (entry.table_name === "solution_flags") {
        return <span className={styles.target}>Flag on solution #{row.solution_id}</span>;
    }

    if (entry.table_name === "solution_updates") {
        return <span className={styles.target}>Update on solution #{row.solution_id}</span>;
    }

    const battle = findBattle(row.galaxy_id, row.battle_id)?.name ?? row.battle_id;

    return (
        <Link className={styles.target} to={`/g/${row.galaxy_id}?solution=${entry.record_id}`}>
            Solution #{entry.record_id} · Galaxy {row.galaxy_id} {battle}
        </Link>
    );
}

function Value({ value }: { value: string }) {
    if (value.startsWith("https://")) return <a href={value} target="_blank" rel="noreferrer">{value}</a>;

    return <>{value}</>;
}

function solutionIdOf(entry: AuditEntry): number | null {
    if (entry.table_name === "solutions") return entry.record_id;
    if (entry.table_name === "solution_flags" || entry.table_name === "solution_updates") return Number((entry.new_data ?? entry.old_data)?.solution_id);

    return null;
}

function verification(entry: AuditEntry): "verified" | "unverified" | null {
    if (entry.table_name !== "solutions" || entry.operation !== "UPDATE") return null;

    const was = entry.old_data?.verified_at != null;
    const is = entry.new_data?.verified_at != null;

    if (was === is) return null;

    return is ? "verified" : "unverified";
}

const isFlagEdit = (e: AuditEntry) => e.table_name === "solution_flags" && e.operation === "UPDATE";

function isFlaggedOnly(entry: AuditEntry): boolean {
    return entry.table_name === "solutions" && entry.operation === "UPDATE" && changes(entry, {}).every((c) => c.key === "flagged");
}

function isFlagSync(entry: AuditEntry, entries: AuditEntry[]): boolean {
    if (!isFlaggedOnly(entry)) return false;

    return entries.some((e) => e.table_name === "solution_flags" && e.changed_at === entry.changed_at
        && (e.new_data ?? e.old_data)?.solution_id === entry.record_id);
}

function badge(entry: AuditEntry, diff: { key: string }[]): [label: string, color: string] {
    const verified = verification(entry);

    if (verified) {
        const label = diff.every((c) => c.key.startsWith("verified_")) ? `Solution ${verified}` : `Solution edited & ${verified}`;
        return [label, verified === "verified" ? "verified" : "UPDATE"];
    }

    if (isFlagEdit(entry) && (entry.old_data?.resolved_at == null) !== (entry.new_data?.resolved_at == null)) {
        return entry.new_data?.resolved_at == null ? ["Flag reopened", "DELETE"] : ["Flag resolved", "UPDATE"];
    }

    if (entry.table_name === "solution_flags" && entry.operation === "INSERT") return ["Flag added", "DELETE"];

    if (entry.table_name === "solution_updates" && entry.operation === "INSERT") return ["Update suggested", "INSERT"];

    if (entry.table_name === "solution_updates" && entry.operation === "UPDATE" && entry.new_data?.resolved_at != null) {
        return entry.new_data?.applied ? ["Update applied", "verified"] : ["Update rejected", "DELETE"];
    }

    return [`${TABLES[entry.table_name] ?? entry.table_name} ${OPERATIONS[entry.operation]}`, entry.operation];
}

function flagReasons(entry: AuditEntry, entries: AuditEntry[]): (string | null)[] {
    if (isFlagEdit(entry)) return [entry.new_data?.reason as string | null];
    if (entry.table_name !== "solutions" || entry.old_data?.flagged !== true || entry.new_data?.flagged !== false) return [];

    return entries
        .filter((e) => isFlagEdit(e) && e.changed_at === entry.changed_at && e.new_data?.solution_id === entry.record_id)
        .map((e) => e.new_data?.reason as string | null);
}

function AuditItem({ entry, labels, reasons, solutionExists, onUndone }: { entry: AuditEntry; labels: Record<string, string>; reasons: (string | null)[]; solutionExists: boolean; onUndone: () => void }) {
    const navigate = useNavigate();
    const diff = changes(entry, labels);
    const [label, color] = badge(entry, diff);

    const goToSolution = async () => {
        const solution = await getSolution(solutionIdOf(entry)!).catch(() => null);
        if (!solution) return alert("This solution no longer exists");
        navigate(`/g/${solution.galaxy_id}?solution=${solution.id}`);
    };

    const undo = () => {
        if (!window.confirm(`Set ${diff.map((c) => c.key).join(", ")} back to the previous values?`)) return;
        undoAuditEntry(entry, diff.map((c) => c.key))
            .then(onUndone)
            .catch((e) => alert(`Undo failed: ${e.message}`));
    };

    return (
        <div className={styles.entry}>
            <div className={styles.summary}>
                <span className={clsx(styles.operation, styles[color])}>
                    {label}
                </span>
                <Target entry={entry} />
                <div className={styles.side}>
                    <span className={styles.meta}>
                        {entry.admin_label ?? "Anonymous"} · {new Date(entry.changed_at).toLocaleString()}
                    </span>
                    {solutionExists && <Button variant="secondary" onClick={goToSolution}>Go to solution</Button>}
                    {entry.operation === "UPDATE" && <Button variant="secondary" onClick={undo}>Undo</Button>}
                </div>
            </div>
            <table className={styles.changes}>
                <tbody>
                    {diff.map((c) => (
                        <tr key={c.key}>
                            <th>{c.key}</th>
                            {entry.operation !== "INSERT" && <td className={styles.before}><div><Value value={c.before} /></div></td>}
                            {entry.operation !== "DELETE" && <td className={styles.after}><div><Value value={c.after} /></div></td>}
                        </tr>
                    ))}
                    {reasons.map((reason, i) => (
                        <tr key={`reason-${i}`}>
                            <th>flag reason</th>
                            <td colSpan={2}><div>{reason ?? <i>No reason given</i>}</div></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function AuditView() {
    const session = useAdminSession();
    const navigate = useNavigate();
    const [filter, setFilter] = useState<AuditFilter>({ flags: true, changes: true, updates: true, submissions: false });
    const log = useAuditLog(filter);
    const [existing, setExisting] = useState<number[]>([]);
    const labels = Object.fromEntries(log.entries.filter((e) => e.actor_id && e.admin_label).map((e) => [e.actor_id, e.admin_label]));

    useEffect(() => {
        const ids = [...new Set(log.entries.map(solutionIdOf).filter((id): id is number => !!id))];
        if (ids.length) getExistingSolutionIds(ids).then(setExisting).catch(() => {});
    }, [log.entries]);

    useEffect(() => {
        if (session === null) navigate('/');
    }, [session, navigate]);

    if (!session) return <BaseLayout />;

    return (
        <BaseLayout>
            <div className={styles.root}>
                <div className={styles.toolbar}>
                    {(Object.keys(FILTERS) as AuditType[]).map((type) => (
                        <Checkbox key={type} name={type} checked={filter[type]} onChange={(v) => setFilter({ ...filter, [type]: v })}>
                            {FILTERS[type]}
                        </Checkbox>
                    ))}
                </div>
                {log.error && <p className={galaxyStyles.error}>Error loading audit log</p>}
                {log.entries.filter((e) => filter.flags ? !isFlagSync(e, log.entries) : !isFlaggedOnly(e)).map((e) => <AuditItem entry={e} key={e.id} labels={labels} reasons={flagReasons(e, log.entries)} solutionExists={existing.includes(solutionIdOf(e)!)} onUndone={log.reload} />)}
                {log.loading && <p className={galaxyStyles.info}>Loading...</p>}
                {!log.loading && !log.error && !log.entries.length && <p className={galaxyStyles.info}>No entries</p>}
                {log.hasMore && !log.loading && (
                    <div className={styles.more}>
                        <Button onClick={log.loadMore}>Load more</Button>
                    </div>
                )}
            </div>
        </BaseLayout>
    );
}
