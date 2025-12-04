import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { cn } from "../lib/utils";

interface Vendor {
  deviceCode: string;
  tenantId: number;
  tenantName: string;
  quota: number;
  menu: string[];
  used: number;
  lastOrder: string;
  color: string;
}

function getWhatsAppNumberForTenant(tenantName: string): string | null {
  if (tenantName.includes("Yanti")) return "6285880259653";
  if (tenantName.includes("Rima")) return "6285718899709";
  return null;
}

export default function Home() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedMenuLabel, setSelectedMenuLabel] = useState<string>("");
  const [isPreorderOpen, setIsPreorderOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [token, setToken] = useState("");
  const [orderResult, setOrderResult] = useState<{
    orderCode: string;
    employeeId: string;
    employeeName: string;
    tenantId: number;
    tenantName: string;
    menuLabel: string;
    orderDate: string;
    queueNumber: number;
  } | null>(null);
  const [preorderError, setPreorderError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [orderDateTimeText, setOrderDateTimeText] = useState("");

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
          tenant: {
            id: number;
            name: string;
            menu: string[];
            quota: number;
            transaction_count: number;
            latest_employee_name: string | null;
          };
        }[] = await overviewResponse.json();

        setVendors(
          overviewData.map((device) => {
            let color = "text-green-500";
            if (device.tenant.transaction_count === device.tenant.quota) {
              color = "text-red-500";
            } else if (
              device.tenant.transaction_count >
              (device.tenant.quota * 2) / 3
            ) {
              color = "text-yellow-500";
            }

            return {
              deviceCode: device.device_code,
              tenantId: device.tenant.id,
              tenantName: device.tenant.name,
              quota: device.tenant.quota,
              menu: device.tenant.menu,
              used: device.tenant.transaction_count,
              lastOrder: device.tenant.latest_employee_name ?? "",
              color: color,
            };
          })
        );
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    },
    []
  );

  async function handlePreorderSubmit() {
    if (!selectedVendor) {
      return;
    }

    if (!selectedMenuLabel) {
      setPreorderError("Silakan pilih menu terlebih dahulu.");
      return;
    }

    if (!employeeId) {
      setPreorderError("Employee ID wajib diisi.");
      return;
    }

    setPreorderError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/preorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          token,
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

      setOrderResult(data);
      const formattedDate = new Date().toLocaleString("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setOrderDateTimeText(formattedDate);
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
    const params = new URLSearchParams(window.location.search);
    const empIdParam = params.get("emp_id");
    const tokenParam = params.get("token");

    if (empIdParam) {
      setEmployeeId(empIdParam);
    }
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadDashboard]);

  useEffect(() => {
    let eventSource: EventSource;
    function initializeSSE() {
      eventSource = new EventSource(import.meta.env.VITE_API_URL + "/sse");

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setVendors((prevVendors) => {
          return prevVendors.map((vendor) => {
            console.log(vendor.tenantId === Number(data.id));

            if (vendor.tenantId === Number(data.id)) {
              const newUsed = vendor.used + 1;
              let newColor = "text-green-500"; // Reset to default
              if (newUsed === vendor.quota) {
                newColor = "text-red-500";
              } else if (newUsed > (vendor.quota * 2) / 3) {
                newColor = "text-yellow-500";
              }

              return {
                ...vendor,
                used: newUsed,
                lastOrder: data.name,
                color: newColor,
              };
            }
            return vendor;
          });
        });
      };

      eventSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        eventSource.close();
      };
    }
    initializeSSE();

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {vendors.map((vendor, index) => (
              <Card
                key={vendor.deviceCode || `vendor-${index}`}
                className="cursor-pointer rounded-3xl border-4 border-blue-500 bg-white p-4 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6"
                onClick={() => handleOpenPreorder(vendor)}
              >
                <CardHeader className="pb-3">
                  <p className="text-xs text-gray-500 mb-1">Klik untuk order</p>
                  <div className="text-center">
                    <CardTitle className="text-3xl font-bold text-gray-900">
                      {vendor.tenantName}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-center text-xl text-gray-700">
                    Available:
                    <div className="text-7xl font-black text-slate-800 my-3">
                      {Math.max(vendor.quota - vendor.used, 0)}
                    </div>
                    <div className="text-lg text-gray-600">
                      Ordered:{" "}
                      <span className={cn(vendor.color, "font-bold")}>
                        {vendor.used}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4">
                  <ul className="space-y-2 text-base text-gray-700">
                    {vendor.menu.map((item, id) => (
                      <li key={id} className="flex items-start">
                        <span
                          className={cn("mt-1 h-3 w-3 rounded-full mr-2", {
                            "bg-blue-500": id % 5 === 0,
                            "bg-orange-500": id % 5 === 1,
                            "bg-green-500": id % 5 === 2,
                            "bg-yellow-500": id % 5 === 3,
                            "bg-purple-500": id % 5 === 4,
                          })}
                        ></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardFooter>
                <div className="mt-4 border-t border-gray-200 pt-4 text-center">
                  <p className="text-sm font-medium text-gray-600 mb-2">Last Order</p>
                  <p className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800">
                    {vendor.lastOrder !== "" ? vendor.lastOrder : "Be The First to Order"}
                  </p>
                </div>
              </Card>
            ))}
          </div>
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
                  value={employeeId}
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
                          {orderResult.orderCode}
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
                    </div>

                    {(() => {
                      const waNumber = getWhatsAppNumberForTenant(
                        orderResult.tenantName
                      );
                      if (!waNumber) return null;

                      const message = `Halo Bu, saya ${orderResult.employeeName} (ID: ${orderResult.employeeId}) sudah memesan ${orderResult.menuLabel} di ${orderResult.tenantName} pada ${orderResult.orderDate}. Kode pesanan: ${orderResult.orderCode}.`;
                      const encodedMessage = encodeURIComponent(message);
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
                  {orderResult.orderCode}
                </span>
              </span>
              <span>{orderDateTimeText || orderResult.orderDate}</span>
            </div>
            <div className="mx-6 mt-2 border border-gray-700">
              <div className="grid md:grid-cols-2">
                <div className="flex flex-col items-center border-b border-gray-700 px-6 py-6 md:border-b-0 md:border-r">
                  <p className="mb-4 text-sm font-semibold tracking-wide">
                    SCAN KONFIRMASI ORDER
                  </p>
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
                    const message = `Halo Bu, saya ${orderResult.employeeName} (ID: ${orderResult.employeeId}) sudah memesan ${orderResult.menuLabel} di ${orderResult.tenantName} pada ${orderResult.orderDate}. Kode pesanan: ${orderResult.orderCode}. Nomor pesanan: ${orderResult.queueNumber}.`;
                    const encodedMessage = encodeURIComponent(message);
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
                <div className="flex flex-col items-center justify-center px-6 py-6 text-center">
                  <div className="text-lg font-semibold uppercase">
                    {orderResult.employeeName}
                  </div>
                  <div className="text-sm text-gray-700">
                    {orderResult.employeeId}
                  </div>
                  <div className="mt-4 text-7xl font-black leading-none">
                    {orderResult.queueNumber}
                  </div>
                  <div className="mt-4 text-sm font-semibold uppercase">
                    {orderResult.menuLabel}
                  </div>
                  <div className="text-xs text-gray-700">
                    {orderResult.tenantName}
                  </div>
                </div>
              </div>
            </div>
            <p className="mx-6 mt-3 text-center text-xs font-semibold">
              Foto Bukti order ini untuk dilampirkan saat melakukan konfirmasi
            </p>
            <div className="mt-4 mb-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShowTicket(false)}
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
