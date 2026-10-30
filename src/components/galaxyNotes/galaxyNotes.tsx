import { clsx } from "clsx";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { updateGalaxyNotes } from "../../lib/api";
import { useGalaxy } from "../../lib/hooks";
import { Button } from "../button/button";
import styles from "./galaxyNotes.module.scss";

const NotesMarkdown = lazy(() => import("./notesMarkdown"));

export function GalaxyNotes({ galaxyId, isAdmin }: { galaxyId: number, isAdmin: boolean }) {
    const { galaxy, reload } = useGalaxy(galaxyId);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);
    const viewport = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const notes = galaxy?.id === galaxyId ? galaxy.notes : null;

    useEffect(() => {
        setEditing(false);
        setExpanded(false);
    }, [galaxyId]);

    useEffect(() => {
        const outer = viewport.current;
        const inner = content.current;
        if (expanded || !outer || !inner) return;
        const check = () => {
            const first = inner.firstElementChild;
            setOverflowing(inner.offsetHeight > outer.clientHeight + 1 || (!!first && first.scrollWidth > first.clientWidth + 1));
        };
        const observer = new ResizeObserver(check);
        observer.observe(outer);
        observer.observe(inner);
        return () => observer.disconnect();
    }, [notes, editing, expanded]);

    const startEditing = () => {
        setDraft(notes ?? '');
        setError(false);
        setEditing(true);
    };

    const save = async (value: string) => {
        setSaving(true);
        setError(false);
        try {
            await updateGalaxyNotes(galaxyId, value.trim() || null);
            await reload();
            setEditing(false);
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };

    const remove = () => {
        if (window.confirm(`Remove the notes for galaxy ${galaxyId}?`)) save('');
    };

    if (editing) {
        return (
            <div className={styles.galaxyNotes}>
                <textarea
                    name="galaxyNotes"
                    placeholder="Galaxy notes (supports markdown: **bold**, *italic*, - lists, [links](https://...))"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
                        e.preventDefault();
                        if (!saving) save(draft);
                    }}
                    autoFocus
                />
                {draft.trim() && (
                    <>
                        <span className={styles.previewLabel}>Preview</span>
                        <div className={clsx(styles.content, styles.preview)}>
                            <Suspense fallback={draft}>
                                <NotesMarkdown>{draft}</NotesMarkdown>
                            </Suspense>
                        </div>
                    </>
                )}
                {error && <span className={styles.error}>Saving failed, please try again</span>}
                <div className={styles.actions}>
                    <Button onClick={() => save(draft)} disabled={saving}>Save</Button>
                    <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                    {notes && <Button variant="flag" onClick={remove} disabled={saving}>Remove</Button>}
                </div>
            </div>
        );
    }

    if (!notes && !isAdmin) return null;

    const canToggle = !!notes && (expanded || overflowing);

    const toggleFromBox = (e: React.MouseEvent) => {
        if (!canToggle || (e.target as HTMLElement).closest('a, button') || !window.getSelection()?.isCollapsed) return;
        setExpanded(!expanded);
    };

    return (
        <div className={clsx(styles.galaxyNotes, styles.display, canToggle && styles.toggleable)} onClick={toggleFromBox}>
            {notes && (
                <div ref={viewport} className={clsx(styles.viewport, expanded ? styles.expanded : overflowing && styles.clipped)}>
                    <div ref={content} className={styles.content}>
                        <Suspense fallback={notes}>
                            <NotesMarkdown>{notes}</NotesMarkdown>
                        </Suspense>
                    </div>
                </div>
            )}
            {(canToggle || isAdmin) && (
                <div className={clsx(styles.actions, expanded && styles.expanded)}>
                    {canToggle && (
                        <button className={styles.toggle} onClick={() => setExpanded(!expanded)}>
                            <span className={styles.toggleLabel}>{expanded ? 'Show less ' : 'Show more '}</span>
                            {expanded ? '▴' : '▾'}
                        </button>
                    )}
                    {isAdmin && <Button variant="secondary" onClick={startEditing}>{notes ? 'Edit' : 'Add galaxy notes'}</Button>}
                </div>
            )}
        </div>
    );
}
