import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { AppSidebar } from "../components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";

import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "@radix-ui/react-label";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { toast } from "sonner";
import {
  appendAdminCredentials,
  requireAdminCredentials,
} from "../lib/adminAuth";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function EmployeeEdit() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const [cardNumber, setCardNumber] = useState("");
  const [empGroup, setEmpGroup] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const credentials = requireAdminCredentials();
        const response = await fetch(
          appendAdminCredentials(
            `${API_BASE_URL}/employee/${employeeId}/detail`,
            credentials
          )
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();

        const mappedData = {
          employeeId: data.employee_id,
          employeeGroup: data.employee_group,
          name: data.name,
          cardNumber: data.card_number,
        };

        setCardNumber(mappedData.cardNumber);
        setEmpGroup(mappedData.employeeGroup);
        setName(mappedData.name);
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
  }, [employeeId]);

  const handleSave = async () => {
    const payload = {
      cardNumber: cardNumber,
      employeeGroup: empGroup,
      name: name,
    };

    try {
      const credentials = requireAdminCredentials();
      const response = await fetch(
        appendAdminCredentials(
          `${API_BASE_URL}/employee/${employeeId}/update`,
          credentials
        ),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save changes.");
      }

      toast.success("Employee updated successfully!");
      navigate("/employee");
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
                  <BreadcrumbLink to="/employee">Employee</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink to={"/employee/edit/" + employeeId}>
                    Edit
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="p-4 mb-4">
          <h2 className="text-2xl font-semibold">Edit Employee</h2>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl mb-4">
                Form Register Employee Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cardNumber" className="text-lg">
                  Card Number
                </Label>
                <Input
                  id="cardNumber"
                  className="text-lg p-2"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-lg">
                  Employee ID (NIK)
                </Label>
                <Input
                  id="employeeId"
                  className="text-lg p-2"
                  value={employeeId}
                  readOnly
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-lg">
                  Employee Name
                </Label>
                <Input
                  id="employeeName"
                  className="text-lg p-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeGroup" className="text-lg">
                  Employee group
                </Label>
                <Select
                  id="employeeGroup"
                  options={["PGI", "GDN", "GI", "DKM", "GDSK", "OTHER"].map(
                    (v) => ({ value: v, label: v })
                  )}
                  value={empGroup}
                  onChange={(e) => setEmpGroup(e.target.value)}
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
