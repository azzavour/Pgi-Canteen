import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../components/ui/sidebar";
import { AppSidebar } from "../components/app-sidebar";
import { Separator } from "@radix-ui/react-separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Select } from "../components/ui/select";
import type { Employee, EmployeeResource, Tenant, TenantResource } from "..";
import {
  appendAdminCredentials,
  requireAdminCredentials,
} from "../lib/adminAuth";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function TransactionEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [employeeId, setEmployeeId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const credentials = requireAdminCredentials();
        const response = await fetch(
          appendAdminCredentials(
            `${API_BASE_URL}/transaction/${id}/detail`,
            credentials
          )
        );
        if (!response.ok) {
          throw new Error("Failed to fetch transaction");
        }
        const data = await response.json();
        setEmployeeId(data.employee_id);
        setTenantId(data.tenant_id.toString());
        setTransactionDate(data.transaction_date.split("T")[0]);
      } catch (error) {
        console.log(error);

        toast.error("Could not fetch transaction details.");
      }
    };

    const fetchEmployees = async () => {
      try {
        const credentials = requireAdminCredentials();
        const response = await fetch(
          appendAdminCredentials(`${API_BASE_URL}/employee`, credentials)
        );
        if (!response.ok) {
          throw new Error("Failed to fetch employees");
        }
        const data = await response.json();
        const mappedData = data.map((employee: EmployeeResource) => ({
          employeeId: employee.employee_id,
          employeeGroup: employee.employee_group,
          name: employee.name,
          cardNumber: employee.card_number,
        }));
        setEmployees(mappedData);
      } catch (error) {
        toast.error("Could not fetch employees.");
      }
    };

    const fetchTenants = async () => {
      try {
        const credentials = requireAdminCredentials();
        const response = await fetch(
          appendAdminCredentials(`${API_BASE_URL}/tenant`, credentials)
        );
        if (!response.ok) {
          throw new Error("Failed to fetch tenants");
        }
        const data = await response.json();
        const mappedData = data.map((tenant: TenantResource) => ({
          id: tenant.id,
          name: tenant.name,
          quota: tenant.quota,
          isLimited: tenant.is_limited,
          menu: tenant.menu,
        }));
        setTenants(mappedData);
      } catch (error) {
        toast.error("Could not fetch tenants.");
      }
    };
    fetchTransaction();
    fetchEmployees();
    fetchTenants();
  }, [id]);

  const handleSave = async () => {
    const payload = {
      employeeId,
      tenantId: parseInt(tenantId),
      transactionDate,
    };

    try {
      const credentials = requireAdminCredentials();
      const response = await fetch(
        appendAdminCredentials(
          `${API_BASE_URL}/transaction/${id}/update`,
          credentials
        ),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save transaction.");
      }

      toast.success("Transaction updated successfully!");
      navigate("/transactions");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
    }
  };

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
                  <BreadcrumbLink to="/transactions">
                    Transactions
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink to={`/transactions/edit/${id}`}>
                    Edit
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="p-4">
          <Button
            onClick={() => navigate("/transactions")}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft /> List Transactions
          </Button>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl mb-4">Edit Transaction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-lg">
                  Employee
                </Label>
                <Select
                  id="employeeId"
                  options={employees.map((e) => ({
                    value: e.employeeId,
                    label: e.name,
                  }))}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantId" className="text-lg">
                  Tenant
                </Label>
                <Select
                  id="tenantId"
                  options={tenants.map((t) => ({
                    value: t.id.toString(),
                    label: t.name,
                  }))}
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transactionDate" className="text-lg">
                  Transaction Date
                </Label>
                <Input
                  id="transactionDate"
                  type="date"
                  className="text-lg p-2"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                onClick={handleSave}
                className="w-full text-xl p-6 mt-8 mb-4"
              >
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
