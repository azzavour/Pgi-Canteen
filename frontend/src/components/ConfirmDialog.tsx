import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui/button";

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
};

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = "Batal",
    onConfirm,
    onCancel,
    loading = false,
}: ConfirmDialogProps) {
    useEffect(() => {
        if (!open) {
            return;
        }
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                <div className="mt-2 text-sm text-slate-600">{description}</div>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" disabled={loading} onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    <Button onClick={onConfirm} disabled={loading}>
                        {loading ? "Menyimpan..." : confirmLabel}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
