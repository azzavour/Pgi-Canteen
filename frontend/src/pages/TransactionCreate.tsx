import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
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
import type { Employee, EmployeeResource, Tenant } from "..";

export default function TransactionCreate() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [employeeId, setEmployeeId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch(
          import.meta.env.VITE_API_URL + "/employee"
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
        const response = await fetch(import.meta.env.VITE_API_URL + "/tenant");
        if (!response.ok) {
          throw new Error("Failed to fetch tenants");
        }
        const data = await response.json();
        setTenants(data);
      } catch (error) {
        toast.error("Could not fetch tenants.");
      }
    };

    fetchEmployees();
    fetchTenants();
  }, []);

  const handleSave = async () => {
    const payload = {
      employeeId,
      tenantId,
      transactionDate,
    };

    try {
      const response = await fetch(
        import.meta.env.VITE_API_URL + "/transaction",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save transaction.");
      }

      toast.success("Transaction created successfully!");
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
                  <BreadcrumbLink to={"/transactions/create"}>
                    Create
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
              <CardTitle className="text-2xl mb-4">
                Create Transaction
              </CardTitle>
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
