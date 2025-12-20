import { useEffect, useState } from "react";
import { AppSidebar } from "../components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "../components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { toast } from "sonner";
import {
  appendAdminCredentials,
  requireAdminCredentials,
} from "../lib/adminAuth";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface Device {
  deviceCode: string;
  tenant: {
    id: number;
    name: string;
  } | null;
}

interface Tenant {
  id: number;
  name: string;
}

interface DeviceResponse {
  device_code: string;
  tenant: {
    id: number;
    name: string;
  } | null;
}

interface TenantResponse {
  id: number;
  name: string;
}

export default function BindTenant() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const credentials = requireAdminCredentials();
        const [devicesResponse, tenantsResponse] = await Promise.all([
          fetch(
            appendAdminCredentials(`${API_BASE_URL}/device`, credentials),
          ),
          fetch(
            appendAdminCredentials(`${API_BASE_URL}/tenant`, credentials),
          ),
        ]);

        if (!devicesResponse.ok || !tenantsResponse.ok) {
          throw new Error("Network response was not ok");
        }

        const devicesData: DeviceResponse[] = await devicesResponse.json();
        const tenantsData: TenantResponse[] = await tenantsResponse.json();

        const mappedDevices = devicesData.map((device) => ({
          deviceCode: device.device_code,
          tenant: device.tenant
            ? {
                id: device.tenant.id,
                name: device.tenant.name,
              }
            : null,
        }));

        const mappedTenants = tenantsData.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
        }));

        setDevices(mappedDevices);
        setTenants(mappedTenants);
      } catch (error) {
        let message: string;
        if (error instanceof Error) {
          message = error.message;
        } else {
          message = String(error);
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleTenantChange = (deviceCode: string, tenantId: string) => {
    setDevices((prevDevices) =>
      prevDevices.map((device) =>
        device.deviceCode === deviceCode
          ? {
              ...device,
              tenant: tenants.find((t) => t.id === parseInt(tenantId)) || null,
            }
          : device
      )
    );
  };

  const handleSave = async (deviceCode: string, tenantId: number | null) => {
    try {
      const credentials = requireAdminCredentials();
      const response = await fetch(
        appendAdminCredentials(
          `${API_BASE_URL}/device/${deviceCode}`,
          credentials,
        ),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save changes.");
      }

      toast.success("Tenant bound successfully!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink to="/bind-tenant">Bind Tenant</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="p-4">
          <h2 className="text-2xl font-semibold mb-4">Bind Tenant to Device</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Device Code
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Tenant
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr
                    className="odd:bg-white even:bg-gray-50"
                    key={device.deviceCode}
                  >
                    <td className="px-6 py-3 border-b">{device.deviceCode}</td>
                    <td className="px-6 py-3 border-b">
                      <Select
                        value={device.tenant?.id.toString() || ""}
                        onChange={(e) =>
                          handleTenantChange(device.deviceCode, e.target.value)
                        }
                        options={[
                          { value: "", label: "Unassigned" },
                          ...tenants.map((tenant) => ({
                            value: tenant.id.toString(),
                            label: tenant.name,
                          })),
                        ]}
                      />
                    </td>
                    <td className="px-6 py-3 border-b">
                      <Button
                        onClick={() =>
                          handleSave(
                            device.deviceCode,
                            device.tenant?.id || null
                          )
                        }
                        variant="outline"
                        size="sm"
                      >
                        Save
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
