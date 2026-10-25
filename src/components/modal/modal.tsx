import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import styles from "./modal.module.scss";

export interface ModalTarget {
    title: string;
    onSelect: () => void;
}

const select = (target: ModalTarget | null | undefined, panel: HTMLDivElement | null) => {
    if (!target) return;
    target.onSelect();
    panel?.scrollTo(0, 0);
};

interface ModalProps {
    open: boolean;
    onClose: () => void;
    nav?: { prev: ModalTarget | null; next: ModalTarget | null };
    children: React.ReactNode;
}

export function Modal({ open, onClose, nav, children }: ModalProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const pressedBackdrop = useRef(false);
    const lastChildren = useRef(children);
    const navRef = useRef(nav);
    const [visible, setVisible] = useState(open);
    const navigable = !!nav;

    useLayoutEffect(() => {
        if (open) lastChildren.current = children;
        navRef.current = nav;
    });

    useEffect(() => {
        if (!open || !navigable) return;

        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (e.altKey || e.ctrlKey || e.metaKey || target.closest("input, textarea, select, [contenteditable]")) return;
            if (e.key === "ArrowLeft") select(navRef.current?.prev, panel.current);
            else if (e.key === "ArrowRight") select(navRef.current?.next, panel.current);
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open, navigable]);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;

        if (open) {
            dialog.classList.remove(styles.closing);
            if (!dialog.open) dialog.showModal();
            setVisible(true);
            return;
        }

        if (!dialog.open) return;

        const finish = () => {
            dialog.close();
            dialog.classList.remove(styles.closing);
            setVisible(false);
        };

        dialog.classList.add(styles.closing);
        if (!panel.current || getComputedStyle(panel.current).animationName === "none") {
            finish();
            return;
        }

        const onEnd = (e: AnimationEvent) => {
            if (e.target === panel.current) finish();
        };

        dialog.addEventListener("animationend", onEnd);
        dialog.addEventListener("animationcancel", onEnd);

        return () => {
            dialog.removeEventListener("animationend", onEnd);
            dialog.removeEventListener("animationcancel", onEnd);
        };
    }, [open]);

    const arrow = (target: ModalTarget | null, direction: "prev" | "next") => (
        <button
            className={clsx(styles.arrow, styles[direction])}
            onClick={() => select(target, panel.current)}
            disabled={!target}
            title={target?.title}
            aria-label={direction === "prev" ? "Previous battle" : "Next battle"}
        >
            {direction === "prev" ? "‹" : "›"}
        </button>
    );

    return (
        <dialog
            ref={ref}
            className={clsx(styles.modal, navigable && styles.navigable)}
            onCancel={(e) => {
                e.preventDefault();
                onClose();
            }}
            onClose={() => {
                setVisible(false);
                if (open) onClose();
            }}
            onMouseDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
            onClick={(e) => {
                if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
            }}
        >
            {(open || visible) && (
                <>
                    <div ref={panel} className={styles.panel}>
                        <div className={styles.content}>
                            <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
                            {open ? children : lastChildren.current}
                        </div>
                    </div>
                    {nav && arrow(nav.prev, "prev")}
                    {nav && arrow(nav.next, "next")}
                </>
            )}
        </dialog>
    );
}
