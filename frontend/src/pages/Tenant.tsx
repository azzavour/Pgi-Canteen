import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";

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

interface Tenant {
  id: number;
  name: string;
  quota: number;
  isLimited: boolean;
  menu: string[];
}

interface TenantResponse {
  id: number;
  name: string;
  quota: number;
  is_limited: boolean;
  menu: string[];
}

export default function Tenant() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(import.meta.env.VITE_API_URL + "/tenant");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data: TenantResponse[] = await response.json();
        const mappedData = data.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          quota: tenant.quota,
          isLimited: tenant.is_limited,
          menu: tenant.menu,
        }));
        setTenants(mappedData);
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
                  <BreadcrumbLink to="/tenant">Tenant</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Tenant List</h2>
            <Button
              onClick={() => navigate("/tenant/create")}
              variant="outline"
              className="mb-4"
            >
              <PlusCircle /> Register Tenant
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    No
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    ID
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Name
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Quota
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Is Limited
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant, index) => (
                  <tr className="odd:bg-white even:bg-gray-50" key={index}>
                    <td className="px-6 py-3 border-b">{index + 1}</td>
                    <td className="px-6 py-3 border-b">{tenant.id}</td>
                    <td className="px-6 py-3 border-b">{tenant.name}</td>
                    <td className="px-6 py-3 border-b">{tenant.quota}</td>
                    <td className="px-6 py-3 border-b">
                      {tenant.isLimited ? "Yes" : "No"}
                    </td>
                    <td className="px-6 py-3 border-b">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => navigate(`/tenant/edit/${tenant.id}`)}
                          variant="outline"
                          size="sm"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {
                            if (
                              window.confirm(
                                "Are you sure you want to delete this tenant?"
                              )
                            ) {
                              fetch(
                                `${import.meta.env.VITE_API_URL}/tenant/${
                                  tenant.id
                                }`,
                                {
                                  method: "DELETE",
                                }
                              ).then(() => {
                                setTenants(
                                  tenants.filter((t) => t.id !== tenant.id)
                                );
                              });
                            }
                          }}
                          variant="outline"
                          size="sm"
                          color="destructive"
                        >
                          Delete
                        </Button>
                      </div>
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
