import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";

export interface VendorLastOrder {
  queueNumber: number;
  menuLabel: string;
  employeeName: string;
  employeeId: string;
}

export interface VendorCardData {
  deviceCode: string;
  tenantId: number;
  tenantName: string;
  quota: number;
  menu: string[];
  available: number;
  used: number;
  lastOrder: VendorLastOrder | null;
  color: string;
}

type VendorCardsProps = {
  vendors: VendorCardData[];
  mode: "portal" | "monitor";
  onVendorSelect?: (vendor: VendorCardData) => void;
};

const MENU_COLOR_CLASSES = [
  "bg-blue-500",
  "bg-orange-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
];

function getTenantPrefix(tenantName: string): string {
  const lowerName = tenantName.toLowerCase();
  if (lowerName.includes("yanti")) {
    return "A";
  }
  if (lowerName.includes("rima")) {
    return "B";
  }
  return "";
}

export function VendorCards({ vendors, mode, onVendorSelect }: VendorCardsProps) {
  const isPortal = mode === "portal";
  const handleCardClick = (vendor: VendorCardData) => {
    if (!isPortal || !onVendorSelect) {
      return;
    }
    onVendorSelect(vendor);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {vendors.map((vendor, index) => {
        const slotLetter = getTenantPrefix(vendor.tenantName);
        return (
          <Card
            key={vendor.deviceCode || `vendor-${index}`}
            className={cn(
              "rounded-3xl border-4 border-blue-500 bg-white p-4 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6",
              {
                "cursor-pointer": isPortal,
                "cursor-default": !isPortal,
              }
            )}
            data-slot-letter={slotLetter || undefined}
            onClick={
              isPortal
                ? () => {
                    handleCardClick(vendor);
                  }
                : undefined
            }
          >
          <CardHeader className="pb-3">
            {isPortal && (
              <p className="text-xs text-gray-500 mb-1">Klik untuk order</p>
            )}
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
                <div className="flex items-center justify-center gap-4">
                  <span>
                    {Number(vendor.quota - vendor.used).toLocaleString("id-ID")}
                  </span>
                </div>
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
                      [MENU_COLOR_CLASSES[0]]: id % 5 === 0,
                      [MENU_COLOR_CLASSES[1]]: id % 5 === 1,
                      [MENU_COLOR_CLASSES[2]]: id % 5 === 2,
                      [MENU_COLOR_CLASSES[3]]: id % 5 === 3,
                      [MENU_COLOR_CLASSES[4]]: id % 5 === 4,
                    })}
                  ></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardFooter>
          <div className="mt-4 border-t border-gray-200 pt-4 text-center">
            <p className="text-sm font-medium text-gray-600 mb-2">Last Order</p>
            <p className="text-sm font-semibold text-gray-800 rounded-full border border-gray-300 px-4 py-2">
              {vendor.lastOrder
                ? `${vendor.lastOrder.employeeName ?? ""} (${
                    vendor.lastOrder.employeeId ?? ""
                  })`
                : "Be The First to Order"}
            </p>
          </div>
          </Card>
        );
      })}
    </div>
  );
}
