import { useCallback, useEffect, useRef, useState } from "react";
import { VendorCards } from "../components/VendorCards";
import type {
  VendorCardData,
  VendorLastOrder,
} from "../components/VendorCards";

type OverviewResponseItem = {
  device_code: string;
  tenantId?: number;
  tenantName?: string;
  quota?: number | null;
  available?: number;
  ordered?: number;
  lastOrder?: VendorLastOrder | null;
  tenantVerificationCode?: string;
  tenant: {
    id: number;
    name: string;
    menu: string[];
    quota: number | null;
    available?: number;
    ordered?: number;
    lastOrder?: VendorLastOrder | null;
    verificationCode?: string;
  };
};

type MonitorSsePayload = {
  id?: string | number;
  tenant_id?: number;
  tenantId?: number;
  name?: string;
  employee_id?: string;
  employeeId?: string;
  tap_id?: string;
  tapId?: string;
  server_commit_ts?: number;
  serverCommitTs?: number;
};

declare global {
  interface Window {
    monitorSoundPlayer?: () => void;
    monitorSoundLogger?: (info: { tapId?: string; tSoundPlayed: number }) => void;
  }
}

const REFRESH_INTERVAL_MS = 10_000;
const SSE_OVERVIEW_DEBOUNCE_MS = 800;

export default function Monitor() {
  const [vendors, setVendors] = useState<VendorCardData[]>([]);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const initialLoadRef = useRef(true);
  const sseRefreshTimerRef = useRef<number | null>(null);
  const transactionAudioRef = useRef<HTMLAudioElement | null>(null);
  const basePath = import.meta.env.BASE_URL || "/";
  const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const dashboardUrl = `${normalizedBasePath}dashboard`;

  useEffect(() => {
    const audio = new Audio("/sounds/transaction.mp3");
    audio.preload = "auto";
    audio.load();
    transactionAudioRef.current = audio;
  }, []);

  const logMonitorSound = useCallback((tapId?: string): number => {
    const tSoundPlayed = Date.now();
    console.log("[MONITOR] sound played", tSoundPlayed, { tapId });
    const audio = transactionAudioRef.current;
    if (audio) {
      try {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch((err) =>
            console.error("Monitor audio playback blocked:", err)
          );
        }
      } catch (err) {
        console.error("Monitor audio playback error:", err);
      }
    }
    if (typeof window.monitorSoundPlayer === "function") {
      try {
        window.monitorSoundPlayer();
      } catch (err) {
        console.error("monitorSoundPlayer failed:", err);
      }
    }
    if (typeof window.monitorSoundLogger === "function") {
      try {
        window.monitorSoundLogger({ tapId, tSoundPlayed });
      } catch (err) {
        console.error("monitorSoundLogger failed:", err);
      }
    }
    return tSoundPlayed;
  }, []);

  const updateVendorsFromSse = useCallback((payload: MonitorSsePayload | null) => {
    if (!payload) {
      return;
    }
    const rawTenantId =
      payload.tenantId ?? payload.tenant_id ?? payload.id ?? null;
    const tenantId =
      typeof rawTenantId === "string" ? Number(rawTenantId) : rawTenantId;
    if (!tenantId || Number.isNaN(tenantId)) {
      return;
    }
    const employeeName = payload.name;
    const employeeId = payload.employeeId ?? payload.employee_id;
    setVendors((prev) => {
      if (!prev.length) {
        return prev;
      }
      let didUpdate = false;
      const nextVendors = prev.map((vendor) => {
        if (vendor.tenantId !== tenantId) {
          return vendor;
        }
        didUpdate = true;
        const nextUsed = vendor.used + 1;
        let nextColor = vendor.color;
        if (vendor.quota > 0) {
          if (nextUsed >= vendor.quota) {
            nextColor = "text-red-500";
          } else if (nextUsed > (vendor.quota * 2) / 3) {
            nextColor = "text-yellow-500";
          } else {
            nextColor = "text-green-500";
          }
        }
        const nextAvailable =
          vendor.quota > 0
            ? Math.max(vendor.quota - nextUsed, 0)
            : vendor.available;
        const nextLastOrder: VendorLastOrder = {
          queueNumber:
            typeof vendor.lastOrder?.queueNumber === "number"
              ? vendor.lastOrder.queueNumber + 1
              : nextUsed,
          menuLabel: vendor.lastOrder?.menuLabel ?? "",
          employeeName: employeeName ?? vendor.lastOrder?.employeeName ?? "",
          employeeId: employeeId ?? vendor.lastOrder?.employeeId ?? "",
        };
        return {
          ...vendor,
          used: nextUsed,
          available: nextAvailable,
          color: nextColor,
          lastOrder: nextLastOrder,
        };
      });
      return didUpdate ? nextVendors : prev;
    });
  }, []);

  const loadOverview = useCallback(async () => {
    if (initialLoadRef.current) {
      setIsLoading(true);
    }
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/dashboard/overview`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch overview (${response.status})`);
      }
      const overviewData: OverviewResponseItem[] = await response.json();
      const mappedVendors = overviewData
        .filter((device) => device?.tenant?.id)
        .map((device) => {
          let color = "text-green-500";
          const rawAvailable = Number(
            device.available ?? device.tenant?.available ?? 0
          );
          const used = Number(device.ordered ?? device.tenant?.ordered ?? 0);
          const quotaValue = device.tenant?.quota ?? null;
          const quota = typeof quotaValue === "number" ? quotaValue : 0;
          if (quota > 0 && used >= quota) {
            color = "text-red-500";
          } else if (quota > 0 && used > (quota * 2) / 3) {
            color = "text-yellow-500";
          }
          const available =
            typeof quotaValue === "number" ? quota - used : rawAvailable;

          return {
            deviceCode: device.device_code,
            tenantId: device.tenant.id,
            tenantName: device.tenant.name,
            quota: quotaValue ?? 0,
            menu: device.tenant.menu,
            available,
            used,
            lastOrder: device.lastOrder ?? device.tenant?.lastOrder ?? null,
            color,
          };
        });

      setVendors(mappedVendors);
    } catch (err) {
      console.error("Failed to load overview:", err);
    } finally {
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    const intervalId = window.setInterval(() => {
      void loadOverview();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadOverview]);

  useEffect(() => {
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/sse`
    );

    eventSource.onmessage = (event) => {
      let payloadData: MonitorSsePayload | null = null;
      if (event?.data) {
        try {
          payloadData = JSON.parse(event.data);
        } catch (err) {
          console.error("Monitor SSE parse error:", err);
        }
      }
      const tSseReceived = Date.now();
      const tapId = payloadData?.tap_id ?? payloadData?.tapId;
      const serverCommitTs =
        payloadData?.server_commit_ts ?? payloadData?.serverCommitTs;
      const deltaMs =
        typeof serverCommitTs === "number" ? tSseReceived - serverCommitTs : null;
      const tSoundPlayed = logMonitorSound(tapId);
      updateVendorsFromSse(payloadData);
      const soundLatency = tSoundPlayed - tSseReceived;
      console.info(
        `[monitor_trace] tapId=${tapId ?? "N/A"} t_sse_received=${tSseReceived}${
          serverCommitTs ? ` server_commit_ts=${serverCommitTs} delta_ms=${deltaMs}` : ""
        } t_sound_played=${tSoundPlayed} sound_latency_ms=${soundLatency}`
      );
      console.log("[MONITOR] SSE received", tSseReceived, { tapId });

      if (sseRefreshTimerRef.current) {
        window.clearTimeout(sseRefreshTimerRef.current);
      }
      sseRefreshTimerRef.current = window.setTimeout(() => {
        void loadOverview();
      }, SSE_OVERVIEW_DEBOUNCE_MS);
    };

    eventSource.onerror = (err) => {
      console.error("Monitor SSE error:", err);
      eventSource.close();
    };

    return () => {
      if (sseRefreshTimerRef.current) {
        window.clearTimeout(sseRefreshTimerRef.current);
        sseRefreshTimerRef.current = null;
      }
      eventSource.close();
    };
  }, [loadOverview, logMonitorSound, updateVendorsFromSse]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1_000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const effectiveEmployeeId =
      params.get("emp_id") ||
      params.get("employeeId") ||
      params.get("employeeIdd") ||
      "";
    console.log("[admin] effectiveEmployeeId=", effectiveEmployeeId);
    if (!effectiveEmployeeId) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    async function checkAdminStatus(employeeId: string) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/admin/check?employeeId=${encodeURIComponent(
            employeeId
          )}`
        );
        if (!response.ok) {
          throw new Error(`admin-check failed: ${response.status}`);
        }
        const payload: { employeeId: string; isAdmin: boolean } = await response.json();
        console.log("[admin] response=", payload);
        if (!cancelled) {
          setIsAdmin(Boolean(payload?.isAdmin));
        }
      } catch (error) {
        console.error("Failed to verify admin access:", error);
        if (!cancelled) {
          setIsAdmin(false);
        }
      }
    }
    void checkAdminStatus(effectiveEmployeeId);
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700">
        Memuat monitor Cawang Canteen...
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <header className="bg-blue-600 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="leading-tight">
            <div className="text-lg font-semibold sm:text-2xl">
              Cawang Canteen
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="text-base font-semibold sm:text-2xl">{time}</div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = dashboardUrl;
                }}
                className="rounded-full bg-white/10 px-4 py-1 text-xs font-semibold tracking-wide text-white transition hover:bg-white/20"
              >
                Dashboard Admin
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="bg-gray-100 min-h-screen">
        <div className="mx-auto max-w-5xl px-3 pb-6 pt-4 sm:px-6 sm:pt-6">
          <VendorCards vendors={vendors} mode="monitor" />
          <div className="text-center mt-8 rounded-2xl bg-white px-6 py-5 shadow-sm">
            <div className="relative h-20 overflow-hidden">
              <p className="absolute top-0 left-0 w-full text-center text-xl text-blue-800 opacity-0 message-item">
                Jika Kartu belum terdaftar, silahkan registrasi di GA
              </p>
              <p className="absolute top-0 left-0 w-full text-center text-xl text-blue-800 opacity-0 message-item">
                Silahkan tap untuk melakukan order
              </p>
              <p className="absolute top-0 left-0 w-full text-center text-xl text-blue-800 opacity-0 message-item">
                Satu orang hanya bisa order satu kali
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
