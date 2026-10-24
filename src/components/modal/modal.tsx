import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./modal.module.scss";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const pressedBackdrop = useRef(false);
    const lastChildren = useRef(children);
    const [visible, setVisible] = useState(open);

    useLayoutEffect(() => {
        if (open) lastChildren.current = children;
    });

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
        if (getComputedStyle(dialog).animationName === "none") {
            finish();
            return;
        }

        const onEnd = (e: AnimationEvent) => {
            if (e.target === dialog && !e.pseudoElement) finish();
        };

        dialog.addEventListener("animationend", onEnd);
        dialog.addEventListener("animationcancel", onEnd);

        return () => {
            dialog.removeEventListener("animationend", onEnd);
            dialog.removeEventListener("animationcancel", onEnd);
        };
    }, [open]);

    return (
        <dialog
            ref={ref}
            className={styles.modal}
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
                <div className={styles.content}>
                    <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
                    {open ? children : lastChildren.current}
                </div>
            )}
        </dialog>
    );
}
