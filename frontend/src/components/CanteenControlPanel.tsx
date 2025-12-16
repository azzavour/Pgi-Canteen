import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchCanteenStatus, updateCanteenStatus } from "../api/canteenStatus";
import type { CanteenMode } from "../api/canteenStatus";
import { ConfirmDialog } from "./ConfirmDialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

const STATUS_CONFIG: Record<CanteenMode, { badge: string; badgeColor: string; description: string }> = {
    OPEN: {
        badge: "🟢 OPEN",
        badgeColor: "bg-emerald-100 text-emerald-800",
        description: "Kantin dibuka secara manual oleh admin.",
    },
    CLOSE: {
        badge: "🔴 CLOSED",
        badgeColor: "bg-red-100 text-red-800",
        description: "Kantin ditutup sementara (maintenance).",
    },
    NORMAL: {
        badge: "🔵 NORMAL (08.00-11.00)",
        badgeColor: "bg-blue-100 text-blue-800",
        description: "Kantin mengikuti jam operasional normal (08.00-11.00).",
    },
};

const ACTIONS: Array<{ mode: CanteenMode; label: string; variant: "default" | "destructive" | "secondary" }> = [
    { mode: "OPEN", label: "BUKA KANTIN", variant: "default" },
    { mode: "CLOSE", label: "TUTUP KANTIN", variant: "destructive" },
    { mode: "NORMAL", label: "KEMBALIKAN KE MODE NORMAL", variant: "secondary" },
];

const DIALOG_COPY: Record<CanteenMode, { title: string; lines: string[]; confirmLabel: string }> = {
    OPEN: {
        title: "Konfirmasi Buka Kantin",
        lines: [
            "Anda akan MEMBUKA kantin secara manual.",
            "Mode ini mengabaikan jam operasional sampai admin menggantinya.",
        ],
        confirmLabel: "Ya, Buka Kantin",
    },
    CLOSE: {
        title: "Konfirmasi Tutup Kantin",
        lines: [
            "Anda akan MENUTUP kantin (maintenance).",
            "User tidak dapat melakukan preorder / tap saat mode ini aktif.",
        ],
        confirmLabel: "Ya, Tutup Kantin",
    },
    NORMAL: {
        title: "Kembalikan ke Mode Normal",
        lines: ["Kantin akan mengikuti jam operasional 08.00-11.00."],
        confirmLabel: "Ya, Mode Normal",
    },
};

function formatUpdatedAt(raw?: string | null): string | null {
    if (!raw) {
        return null;
    }
    const candidate = raw.includes("T") ? raw : raw.replace(" ", "T");
    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) {
        return raw;
    }
    return parsed.toLocaleString("id-ID", { hour12: false });
}

export function CanteenControlPanel() {
    const [statusMode, setStatusMode] = useState<CanteenMode>("NORMAL");
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(true);
    const [dialogMode, setDialogMode] = useState<CanteenMode | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const currentConfig = STATUS_CONFIG[statusMode];

    const loadStatus = useCallback(async () => {
        setIsFetching(true);
        try {
            const { mode, updatedAt: updated, isOpen } = await fetchCanteenStatus();
            console.info("[ADMIN] fetched canteen mode:", mode, "is_open=", isOpen, "updated=", updated ?? "");
            setStatusMode(mode);
            setUpdatedAt(updated ?? null);
        } catch (err) {
            console.error("[ADMIN] fetch failed:", err);
            toast.error("Tidak dapat memuat status kantin. Coba refresh.");
        } finally {
            setIsFetching(false);
        }
    }, []);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    const openDialog = useCallback(
        (mode: CanteenMode) => {
            if (mode === statusMode) {
                return;
            }
            console.info("[ADMIN] update canteen mode ->", mode);
            setDialogMode(mode);
        },
        [statusMode]
    );

    const closeDialog = useCallback(() => {
        setDialogMode(null);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!dialogMode) {
            return;
        }
        setIsSaving(true);
        try {
            await updateCanteenStatus(dialogMode);
            console.info("[ADMIN] update success");
            toast.success("✅ Status kantin berhasil diperbarui.");
            closeDialog();
            await loadStatus();
        } catch (err) {
            console.error("[ADMIN] update failed:", err);
            toast.error("❌ Gagal memperbarui status kantin. Coba lagi.");
            closeDialog();
        } finally {
            setIsSaving(false);
        }
    }, [closeDialog, dialogMode, loadStatus]);

    const dialogCopy = dialogMode ? DIALOG_COPY[dialogMode] : null;
    const updatedText = formatUpdatedAt(updatedAt);

    return (
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:min-w-[360px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Kontrol Operasional Kantin
            </p>
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Status Saat Ini</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Badge className={`${currentConfig.badgeColor} px-3 py-1.5 text-sm`}>
                        {currentConfig.badge}
                    </Badge>
                    {isFetching && <span className="text-xs text-slate-500">Memuat...</span>}
                </div>
                <p className="mt-2 text-sm text-slate-700">{currentConfig.description}</p>
                {updatedText && (
                    <p className="mt-2 text-xs text-slate-500">Terakhir diperbarui {updatedText}</p>
                )}
            </div>
            <Separator className="my-5" />
            <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Ubah Mode Operasional</p>
                <div className="mt-3 flex flex-col gap-2">
                    {ACTIONS.map(({ mode, label, variant }) => {
                        const isActive = mode === statusMode;
                        return (
                            <Button
                                key={mode}
                                variant={variant}
                                disabled={isFetching || isSaving || isActive}
                                onClick={() => openDialog(mode)}
                                className="items-center justify-between text-left"
                            >
                                <div>
                                    <span className="block font-medium leading-tight">{label}</span>
                                    {isActive && (
                                        <span className="text-[11px] uppercase tracking-wide opacity-80">
                                            Sedang aktif
                                        </span>
                                    )}
                                </div>
                            </Button>
                        );
                    })}
                </div>
            </div>
            <ConfirmDialog
                open={dialogMode !== null}
                title={dialogCopy?.title ?? ""}
                description={
                    <div className="space-y-2 text-left">
                        {dialogCopy?.lines.map((line) => (
                            <p key={line}>{line}</p>
                        ))}
                    </div>
                }
                confirmLabel={dialogCopy?.confirmLabel ?? "Simpan"}
                onCancel={closeDialog}
                onConfirm={handleConfirm}
                loading={isSaving}
            />
        </div>
    );
}
