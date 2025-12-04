import { useEffect, useState } from "react";
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

export default function Home() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchData = async () => {
      try {
        const overviewResponse = await fetch(
          `${import.meta.env.VITE_API_URL}/dashboard/overview`,
          { signal }
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
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, []);

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
    <div className="min-h-screen relative bg-stone-200">
      <div className="relative z-10">
        <div className="bg-blue-700  px-8 py-8 mb-8 flex justify-between">
          <h1 className="text-5xl font-bold text-white">Cawang Canteen</h1>
          <h1 className="text-5xl font-bold text-white">{time}</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mx-8">
          {vendors.map((vendor, index) => (
            <Card
              key={vendor.deviceCode}
              className="shadow-md border-blue-700 border-4 bg-white gap-4"
            >
              <CardHeader className="">
                <div
                  className={cn(
                    "border-b p-1 pb-4 text-2xl",
                    index == 0 ? "" : "hidden"
                  )}
                >
                  Pre Order Via WA: 085880259653
                </div>
                <div
                  className={cn(
                    "border-b p-1 pb-4 text-2xl",
                    index == 1 ? "" : "hidden"
                  )}
                >
                  Pre Order Via WA: 085718899709
                </div>

                <div className="flex justify-center">
                  <CardTitle className="text-6xl">
                    {vendor.tenantName}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center text-4xl">
                  Available:
                  <div className="text-[15rem] font-bold text-slate-700 -mt-8">
                    {vendor.quota - vendor.used}
                  </div>
                  <div className=" ">
                    Ordered:{" "}
                    <span className={cn(vendor.color, "text-6xl")}>
                      {vendor.used}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <ul className="flex flex-col justify-center text-3xl mt-2 items-center w-full space-y-2 gap-2 pb-4">
                  {vendor.menu.map((item, id) => (
                    <li key={id} className="flex items-center">
                      <span
                        className={cn("w-6 h-6 mr-2 rounded-full", {
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
              <div className="mx-4 border-t border-black p-2 pt-5 flex flex-col justify-center items-center gap-2">
                <h1 className="text-3xl font-medium ">Last Order</h1>
                <h2
                  className={cn(
                    "text-4xl px-10 py-4 rounded-xl font-bold",
                    vendor.lastOrder !== ""
                      ? "text-white bg-blue-500"
                      : "text-black border-3"
                  )}
                >
                  {vendor.lastOrder !== ""
                    ? vendor.lastOrder
                    : "Be The First to Order"}
                </h2>
              </div>
            </Card>
          ))}
        </div>
        <div className="text-center mt-12 border-y-8 bg-white px-8 py-6 pb-3">
          <div className="relative h-16 overflow-hidden">
            <p className="absolute top-0 left-0 w-full text-center text-5xl text-blue-800 opacity-0 message-item">
              Jika Kartu belum terdaftar, silahkan registrasi di GA
            </p>
            <p className="absolute top-0 left-0 w-full text-center text-5xl text-blue-800 opacity-0 message-item">
              Silahkan tap untuk melakukan order
            </p>
            <p className="absolute top-0 left-0 w-full text-center text-5xl text-blue-800 opacity-0 message-item">
              Satu orang hanya bisa order satu kali
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
