import { useState } from "react";
import { format } from "date-fns";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AppSidebar } from "../components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "../components/ui/breadcrumb";
import { toast } from "sonner";
import { Checkbox } from "../components/ui/checkbox";

const EMPLOYEE_GROUPS = [
  { id: "PGI", label: "PGI" },
  { id: "DKM", label: "DKM" },
  { id: "GDN", label: "GDN" },
];

export default function TransactionExportPage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [employeeGroup, setEmployeeGroup] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ⭐ New unified change handler
  const handleGroupChange = (groupId: string, isChecked: boolean) => {
    if (isChecked) {
      // Add the ID to the array if it's not already there
      if (!employeeGroup.includes(groupId)) {
        setEmployeeGroup([...employeeGroup, groupId]);
      }
    } else {
      // Remove the ID from the array
      setEmployeeGroup(employeeGroup.filter((id) => id !== groupId));
    }
  };

  const handleExport = async () => {
    setLoading(true);
    // ... (rest of handleExport logic is unchanged)
    try {
      const params = new URLSearchParams({
        date: date, employee_group: employeeGroup.join(' ')
      });
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/transaction/export?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Transactions exported successfully!");
    } catch (error) {
      let message: string;
      if (error instanceof Error) {
        message = error.message;
      } else {
        message = String(error);
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportMonthly = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: date, employee_group: employeeGroup.join(' ') });
      // FIX: The query separator should be '?' not '?/monthly' (assuming '/monthly' is part of the path)
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/transaction/export/monthly?${params.toString()}` // Corrected endpoint URL
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Transactions exported successfully!");
    } catch (error) {
      let message: string;
      if (error instanceof Error) {
        message = error.message;
      } else {
        message = String(error);
      }
      toast.error(message);
    } finally {
      setLoading(false);
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

                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink to="/transactions/export">
                    Export
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Export Transactions</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeGroup">Employee Group</Label>
                  <div className="flex gap-2 items-center">
                    {EMPLOYEE_GROUPS.map((group) => (
                      <div className="flex gap-2 items-center" key={group.id}>
                        <Checkbox
                          id={group.id}
                          checked={employeeGroup.includes(group.id)}
                          onCheckedChange={(isChecked: boolean) =>
                            handleGroupChange(group.id, isChecked)
                          }
                        />
                        <Label htmlFor={group.id}>{group.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-4 gap-4">
                <Button onClick={handleExport} disabled={loading}>
                  {loading ? "Exporting..." : "Export to XLSX"}
                </Button>
                <Button onClick={handleExportMonthly} disabled={loading}>
                  {loading ? "Exporting..." : "Export to XLSX Monthly"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}