import {
  appendAdminCredentials,
  requireAdminCredentials,
} from "../lib/adminAuth";

export type CanteenMode = "OPEN" | "CLOSE" | "NORMAL";

type CanteenStatusResponse = {
    mode?: string;
    updated_at?: string;
    updatedAt?: string;
    updated_by?: string;
    updatedBy?: string;
    is_open?: boolean;
    isOpen?: boolean;
};

type UpdateResponse = {
    mode?: string;
    ok?: boolean;
};

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function resolveMode(raw?: string): CanteenMode {
    if (raw && ["OPEN", "CLOSE", "NORMAL"].includes(raw)) {
        return raw as CanteenMode;
    }
    return "NORMAL";
}

export async function fetchCanteenStatus(): Promise<{
    mode: CanteenMode;
    updatedAt?: string | null;
    updatedBy?: string | null;
    isOpen?: boolean | null;
}> {
    const credentials = requireAdminCredentials();
    const response = await fetch(
        appendAdminCredentials(`${BASE_URL}/admin/canteen-status`, credentials),
    );
    if (!response.ok) {
        throw new Error("Failed to fetch canteen status");
    }
    const payload: CanteenStatusResponse = await response.json();
    return {
        mode: resolveMode(payload.mode),
        updatedAt: payload.updated_at ?? payload.updatedAt ?? null,
        updatedBy: payload.updated_by ?? payload.updatedBy ?? null,
        isOpen: payload.is_open ?? payload.isOpen ?? null,
    };
}

export async function updateCanteenStatus(mode: CanteenMode): Promise<void> {
    const credentials = requireAdminCredentials();
    const response = await fetch(
        appendAdminCredentials(`${BASE_URL}/admin/canteen-status`, credentials),
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ mode }),
        },
    );
    if (!response.ok) {
        throw new Error("Failed to update canteen status");
    }
    await response.json().catch(() => ({} as UpdateResponse));
}
