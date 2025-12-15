import { useCallback, useEffect, useRef, useState } from "react";
import { VendorCards } from "../components/VendorCards";
import type {
  VendorCardData,
  VendorLastOrder,
} from "../components/VendorCards";

const DAY_NAMES = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

type CanteenStatus = {
  is_open: boolean;
  reason: string;
  message: string;
  open_time: string;
  close_time: string;
};

interface Vendor extends VendorCardData {
  verificationCode?: string;
}

interface OrderResult {
  orderCode: string;
  orderHash?: string;
  employeeId: string;
  employeeName: string;
  tenantId: number;
  tenantName: string;
  menuLabel: string;
  orderDate: string;
  queueNumber: number;
  queueCode?: string;
  transactionNumber?: string;
  tenantVerificationCode?: string;
  orderDateTimeText?: string;
}

function getWhatsAppNumberForTenant(tenantName: string): string | null {
  if (tenantName.includes("Yanti")) return "6285880259653";
  if (tenantName.includes("Rima")) return "6285718899709";
  return null;
}

function formatDayTime(raw: string | null | undefined) {
  if (!raw) {
    return { dayLine: "", timeLine: "" };
  }
  const text = raw.trim();
  if (!text) {
    return { dayLine: "", timeLine: "" };
  }

  const lowerText = text.toLowerCase();
  const matchedDay = DAY_NAMES.find((name) =>
    lowerText.startsWith(name.toLowerCase())
  );

  let dayLabel = "";
  let remainder = text;
  if (matchedDay) {
    dayLabel = matchedDay;
    remainder = remainder.slice(matchedDay.length).trim();
    if (remainder.startsWith(",")) {
      remainder = remainder.slice(1).trim();
    }
  }

  const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4})/;
  const timeRegex = /(\d{1,2}[:.]\d{2})/;
  const dateMatch = remainder.match(dateRegex);
  const timeMatch = remainder.match(timeRegex);
  const dateText = dateMatch ? dateMatch[1] : "";
  const timeText = timeMatch ? timeMatch[1].replace(":", ".") : "";

  if (!dayLabel && dateText) {
    // Text was something like "12/12/2025, 08.00"
    const isoCandidate = dateText.split("/").reverse().join("-");
    const localizedDate = new Date(isoCandidate);
    if (!Number.isNaN(localizedDate.getTime())) {
      const localized = localizedDate.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const [weekdayName, datePortion] = localized
        .split(",")
        .map((s) => s.trim());
      dayLabel = `${weekdayName}, ${datePortion}`;
    } else {
      dayLabel = dateText;
    }
  } else if (dayLabel && dateText) {
    dayLabel = `${dayLabel}, ${dateText}`;
  } else if (!dayLabel) {
    dayLabel = text;
  }

  return { dayLine: dayLabel, timeLine: timeText };
}

export default function Home() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedMenuLabel, setSelectedMenuLabel] = useState<string>("");
  const [isPreorderOpen, setIsPreorderOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    employee_id: string;
    name?: string;
    email?: string;
  } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
const [preorderError, setPreorderError] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
const [showTicket, setShowTicket] = useState(false);
const [orderDateTimeText, setOrderDateTimeText] = useState("");
const [isTicketQrLoading, setIsTicketQrLoading] = useState(false);
  const [canteenStatus, setCanteenStatus] = useState<CanteenStatus | null>(null);
const [isStatusLoading, setIsStatusLoading] = useState<boolean>(true);
const [statusError, setStatusError] = useState<string | null>(null);
const transactionNumberDisplay =
  orderResult?.transactionNumber || orderResult?.orderCode || "";
const ticketDisplayCode =
  orderResult && transactionNumberDisplay
    ? orderResult.tenantVerificationCode
      ? `${orderResult.tenantVerificationCode}-${transactionNumberDisplay}`
      : transactionNumberDisplay
    : "";
const queueCodeDisplay = orderResult?.queueCode || "";
const whatsappMessage =
  orderResult && (ticketDisplayCode || orderResult.orderCode)
    ? (() => {
        const { dayLine, timeLine } = formatDayTime(
          orderDateTimeText || orderResult.orderDate
        );
        const combinedCode = ticketDisplayCode || orderResult.orderCode;
        const queueCode = queueCodeDisplay || "-";
        return (
          `#${combinedCode}\n\n` +
          `Halo Bu, saya ${orderResult.employeeName} (${orderResult.employeeId}) sudah memesan ${orderResult.menuLabel} di ${orderResult.tenantName} dengan detail pesanan :\n\n` +
          `Hari/tanggal : ${dayLine || "-"}\n` +
          `Waktu : ${timeLine || "-"}\n` +
          `Nomor pesanan : ${queueCode}`
        );
      })()
    : "";
  const sseRefreshTimer = useRef<number | null>(null);

  function handleOpenPreorder(vendor: Vendor) {
    setSelectedVendor(vendor);
    setSelectedMenuLabel("");
    setOrderResult(null);
    setPreorderError(null);
    setIsPreorderOpen(true);
    setOrderDateTimeText("");
  }

  function handleClosePreorder() {
    setIsPreorderOpen(false);
    setIsSubmitting(false);
  }

  const loadDashboard = useCallback(
    async (abortSignal?: AbortSignal) => {
      try {
        const options: RequestInit = {};
        if (abortSignal) {
          options.signal = abortSignal;
        }
        const overviewResponse = await fetch(
          `${import.meta.env.VITE_API_URL}/dashboard/overview`,
          options
        );
        if (!overviewResponse.ok) {
          throw new Error("Failed to fetch overview");
        }
        const overviewData: {
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
        }[] = await overviewResponse.json();

        setVendors(
          overviewData.map((device) => {
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
              available: available,
              used: used,
              lastOrder: device.lastOrder ?? null,
              color: color,
              verificationCode:
                device.tenant?.verificationCode ??
                device.tenantVerificationCode ??
                "",
            };
          })
        );
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    async function authenticateFromPortal() {
      const params = new URLSearchParams(window.location.search);
      const employeeIdParam =
        params.get("emp_id") ?? params.get("employee_id");
      const portalTokenParam =
        params.get("portal_token") ?? params.get("token");

      if (!employeeIdParam || !portalTokenParam) {
        if (isMounted) {
          setAuthError("Akses harus melalui portal. Parameter URL tidak lengkap.");
          setCurrentUser(null);
          setAuthLoading(false);
        }
        return;
      }

      try {
        const resp = await fetch(`${import.meta.env.VITE_API_URL}/auth/portal-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: employeeIdParam,
            portalToken: portalTokenParam,
          }),
        });

        if (!resp.ok) {
          throw new Error("Portal session invalid");
        }

        const data = await resp.json();
        if (isMounted) {
          setCurrentUser(data);
          setAuthError(null);
        }
      } catch (error) {
        console.error("Failed to authenticate via portal:", error);
        if (isMounted) {
          setAuthError(
            "Sesi portal tidak valid. Silakan kembali ke portal dan klik ulang menu Canteen."
          );
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    authenticateFromPortal();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const baseUrl = import.meta.env.VITE_API_URL;
    const normalizedBaseUrl =
      typeof baseUrl === "string" ? baseUrl.replace(/\/$/, "") : "";
    const statusEndpoint = normalizedBaseUrl
      ? `${normalizedBaseUrl}/canteen/status`
      : "/canteen/status";

    async function fetchCanteenStatus(showLoading = true) {
      try {
        if (showLoading) {
          setIsStatusLoading(true);
        }
        setStatusError(null);
        const res = await fetch(statusEndpoint);
        if (!res.ok) {
          throw new Error(`Failed to load canteen status: ${res.status}`);
        }
        const data: CanteenStatus = await res.json();
        if (isMounted) {
          setCanteenStatus(data);
        }
      } catch (err) {
        console.error("Error fetching canteen status:", err);
        if (isMounted) {
          setStatusError(
            "Gagal memuat status Cawang Canteen. Silakan refresh halaman."
          );
          setCanteenStatus(null);
        }
      } finally {
        if (isMounted && showLoading) {
          setIsStatusLoading(false);
        }
      }
    }

    fetchCanteenStatus(true);
    const intervalId = window.setInterval(() => {
      fetchCanteenStatus(false);
    }, 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function handlePreorderSubmit() {
    if (!selectedVendor) {
      return;
    }

    if (!selectedMenuLabel) {
      setPreorderError("Silakan pilih menu terlebih dahulu.");
      return;
    }

    if (!currentUser) {
      setPreorderError(
        "Sesi portal tidak valid. Silakan kembali ke portal dan buka ulang halaman ini."
      );
      return;
    }

    setPreorderError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/preorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: currentUser.employee_id,
          tenantId: selectedVendor.tenantId,
          menuLabel: selectedMenuLabel,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setOrderResult(null);
        setPreorderError(
          (data && (data.detail || data.message)) ||
            "Gagal membuat pre-order."
        );
        setIsSubmitting(false);
        return;
      }

      const ticketData = {
        orderCode: data.orderCode,
        orderHash: data.orderHash,
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        tenantId: data.tenantId,
        tenantName: data.tenantName,
        tenantVerificationCode: data.tenantVerificationCode,
        menuLabel: data.menuLabel,
        orderDate: data.orderDate,
        orderDateTimeText: data.orderDateTimeText,
        queueNumber: data.queueNumber,
        queueCode: data.queueCode,
        transactionNumber: data.transactionNumber,
      };
      setOrderResult(ticketData);
      const fallbackDateText = new Date().toLocaleString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setOrderDateTimeText(data.orderDateTimeText || fallbackDateText);
      const hasWaDestination = Boolean(
        getWhatsAppNumberForTenant(ticketData.tenantName)
      );
      setIsTicketQrLoading(hasWaDestination);
      setShowTicket(true);
      setIsPreorderOpen(false);
      try {
        await loadDashboard();
      } catch (dashboardError) {
        console.error("Failed to refresh dashboard:", dashboardError);
      }
    } catch (error) {
      setOrderResult(null);
      setPreorderError("Terjadi kesalahan jaringan, coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!currentUser || authError) {
      return;
    }
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadDashboard, currentUser, authError]);

  useEffect(() => {
    if (!currentUser || authError) {
      return;
    }

    let eventSource: EventSource | null = null;

    function initializeSSE() {
      eventSource = new EventSource(import.meta.env.VITE_API_URL + "/sse");

      eventSource.onmessage = () => {
        if (sseRefreshTimer.current) {
          window.clearTimeout(sseRefreshTimer.current);
        }
        sseRefreshTimer.current = window.setTimeout(() => {
          loadDashboard();
        }, 500);
      };

      eventSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        eventSource?.close();
      };
    }

    initializeSSE();

    return () => {
      if (sseRefreshTimer.current) {
        window.clearTimeout(sseRefreshTimer.current);
        sseRefreshTimer.current = null;
      }
      eventSource?.close();
    };
  }, [currentUser, authError, loadDashboard]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700">
        Memuat sesi portal...
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="max-w-md rounded-3xl bg-white p-6 text-center shadow-md border border-red-100">
          <p className="text-lg font-semibold text-red-600 mb-2">Akses tidak valid</p>
          <p className="text-sm text-gray-600">{authError}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  if (isStatusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6 canteen-status">
        <div className="max-w-md rounded-3xl bg-white p-6 text-center shadow-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Cawang Canteen
          </h2>
          <p className="text-sm text-gray-600">
            Memuat status Cawang Canteen...
          </p>
        </div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6 canteen-status error">
        <div className="max-w-md rounded-3xl bg-white p-6 text-center shadow-md border border-red-100">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Cawang Canteen Tutup
          </h2>
          <p className="text-sm text-gray-600">{statusError}</p>
        </div>
      </div>
    );
  }

  if (canteenStatus && !canteenStatus.is_open) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6 canteen-status closed">
        <div className="max-w-lg rounded-3xl bg-white p-6 text-center shadow-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Cawang Canteen Tutup
          </h2>
          <p className="text-sm text-gray-700 mb-2">{canteenStatus.message}</p>
          <p className="text-sm text-gray-600">
            Jam layanan pemesanan Pre-Order: {canteenStatus.open_time}–
            {canteenStatus.close_time} WIB
          </p>
        </div>
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
          <div className="text-right text-base font-semibold sm:text-2xl">
            {time}
          </div>
        </div>
      </header>
      <main className="bg-gray-100 min-h-screen">
        <div className="mx-auto max-w-5xl px-3 pb-6 pt-4 sm:px-6 sm:pt-6">
          <VendorCards
            vendors={vendors}
            mode="portal"
            onVendorSelect={handleOpenPreorder}
          />
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
      {isPreorderOpen && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-blue-100 overflow-hidden">
            <div className="flex items-start justify-between gap-3 bg-blue-600 px-6 py-4 text-white">
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
                  Pre-order untuk
                </p>
                <h2 className="text-xl font-bold leading-tight">
                  {selectedVendor.tenantName}
                </h2>
                {selectedMenuLabel && (
                  <p className="mt-1 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs">
                    {selectedMenuLabel}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClosePreorder}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-sm"
                aria-label="Tutup pre-order"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 text-sm text-gray-800">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Pilih Menu
                </label>
                <select
                  className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  value={selectedMenuLabel}
                  onChange={(event) => setSelectedMenuLabel(event.target.value)}
                >
                  <option value="">-- Pilih menu --</option>
                  {selectedVendor.menu
                    .filter((menuItem) => {
                      const parts = menuItem.split(":");
                      return parts.length > 1 && parts[1].trim().length > 0;
                    })
                    .map((menuItem) => (
                      <option key={menuItem} value={menuItem}>
                        {menuItem}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Employee ID
                </label>
                <input
                  className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  value={currentUser?.employee_id ?? ""}
                  readOnly
                />
              </div>

              {preorderError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-2xl px-3 py-2">
                  {preorderError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClosePreorder}
                  className="px-4 py-2 rounded-full border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batalkan
                </button>
                <button
                  type="button"
                  onClick={handlePreorderSubmit}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSubmitting ? "Mengirim..." : "Kirim Pesanan"}
                </button>
              </div>

              {orderResult && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">
                    Nota Pre-Order
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-1 text-xs text-gray-700">
                      <p>
                        <span className="font-medium">Kode Pesanan:</span>{" "}
                        <span className="font-mono">
                          {ticketDisplayCode || orderResult.orderCode}
                        </span>
                      </p>
                      <p>
                        <span className="font-medium">Nama:</span>{" "}
                        {orderResult.employeeName} ({orderResult.employeeId})
                      </p>
                      <p>
                        <span className="font-medium">Kantin:</span>{" "}
                        {orderResult.tenantName}
                      </p>
                      <p>
                        <span className="font-medium">Menu:</span>{" "}
                        {orderResult.menuLabel}
                      </p>
                      <p>
                        <span className="font-medium">Tanggal:</span>{" "}
                        {orderResult.orderDate}
                      </p>
                      <p>
                        <span className="font-medium">Kode Tenant:</span>{" "}
                        <span className="font-mono">
                          {orderResult.tenantVerificationCode || "-"}
                        </span>
                      </p>
                    </div>

                    {(() => {
                      const waNumber = getWhatsAppNumberForTenant(
                        orderResult.tenantName
                      );
                      if (!waNumber) return null;
                      const encodedMessage = encodeURIComponent(
                        whatsappMessage || ""
                      );
                      const waLink = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodedMessage}`;
                      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        waLink
                      )}`;

                      return (
                        <div className="flex flex-col items-center sm:items-end gap-3">
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-full bg-green-500 px-5 py-2 text-xs font-semibold text-white hover:bg-green-600"
                          >
                            Kirim ke WhatsApp
                          </a>
                          <div className="flex items-center gap-3">
                            <img
                              src={qrUrl}
                              alt="QR WhatsApp"
                              className="w-28 h-28 sm:w-32 sm:h-32 border border-gray-200 rounded-2xl shadow-sm"
                            />
                            <span className="text-[10px] sm:text-xs text-gray-500 max-w-[180px] leading-snug">
                              Scan QR ini untuk membuka WhatsApp dengan pesan
                              yang sama.
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showTicket && orderResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-4 pb-2 text-sm font-bold">
              <span>
                ORDER :{" "}
                <span className="font-mono tracking-wide">
                  {ticketDisplayCode || orderResult.orderCode}
                </span>
              </span>
              <span>{orderDateTimeText || orderResult.orderDate}</span>
            </div>
            <div className="mx-6 mt-2 border border-gray-700">
              <div className="grid md:grid-cols-2">
                      <div className="flex flex-col items-center justify-center border-b border-gray-700 px-6 py-6 text-center md:border-b-0 md:border-r">
                        <div className="text-lg font-semibold uppercase">
                          {orderResult.employeeName}
                        </div>
                  <div className="text-sm text-gray-700">
                    {orderResult.employeeId}
                  </div>
                      <div className="mt-4 text-7xl font-black leading-none flex items-center justify-center">
                        <span>{queueCodeDisplay || "-"}</span>
                      </div>
                  <div className="mt-4 text-sm font-semibold uppercase">
                    {orderResult.menuLabel}
                  </div>
                  <div className="text-xs text-gray-700">
                    {orderResult.tenantName}
                  </div>
                </div>
                <div className="flex flex-col items-center px-6 py-6">
                  <p className="mb-4 text-sm font-semibold tracking-wide text-center">
                    SCAN KONFIRMASI ORDER
                  </p>
                  {isTicketQrLoading && (
                    <p className="mb-3 rounded-full bg-blue-50 px-4 py-2 text-[11px] font-medium text-blue-700 text-center">
                      QR sedang diproses, mohon tunggu beberapa detik...
                    </p>
                  )}
                  {(() => {
                    const waNumber = getWhatsAppNumberForTenant(
                      orderResult.tenantName
                    );
                    if (!waNumber) {
                      return (
                        <div className="flex h-56 w-56 items-center justify-center bg-white text-xs text-gray-500">
                          QR tidak tersedia
                        </div>
                      );
                    }
                    const encodedMessage = encodeURIComponent(
                      whatsappMessage || ""
                    );
                    const waLink = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodedMessage}`;
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                      waLink
                    )}`;
                    return (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-56 w-56 items-center justify-center bg-white">
                          <img
                            src={qrUrl}
                            alt="QR WhatsApp"
                            className="h-48 w-48"
                            onLoad={() => setIsTicketQrLoading(false)}
                            onError={() => setIsTicketQrLoading(false)}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 text-center leading-snug">
                          Scan QR ini untuk membuka WhatsApp dengan format pesan
                          yang sama.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="mt-4 mb-6 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowTicket(false);
                  setIsTicketQrLoading(false);
                }}
                className="rounded-full border border-gray-400 px-8 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
