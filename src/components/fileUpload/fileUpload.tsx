import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import styles from "./fileUpload.module.scss";

interface FileUploadProps {
    onFileSelected: (file: File) => void;
    accept?: string;
    className?: string;
    dragText?: string;
    idleText?: string;
    preview?: boolean;
    file?: File;
}

export function FileUpload(props: FileUploadProps) {
    const {
        onFileSelected,
        accept,
        className,
        dragText = "Drop file here",
        idleText = "Click or drag a file to upload",
        preview = false,
        file,
    } = props;

    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!preview) return;
        if (!file) {
            setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return undefined; });
            return;
        }
        if (file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
        }
    }, [file, preview]);

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFileSelected(file);
    };

    const onClick = () => {
        inputRef.current?.click();
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onFileSelected(file);
        e.target.value = "";
    };

    return (
        <div
            className={clsx(styles.dropzone, { [styles.dragging]: isDragging }, className)}
            onClick={onClick}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onClick()}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className={styles.hiddenInput}
                onChange={onInputChange}
                name="screenshot"
            />
            {preview && previewUrl ? (
                <img src={previewUrl} alt="Preview" className={styles.preview} />
            ) : (
                <span className={styles.text}>
                    {isDragging ? dragText : idleText}
                </span>
            )}
        </div>
    );
}
