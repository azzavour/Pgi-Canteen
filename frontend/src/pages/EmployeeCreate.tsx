import { useState } from "react";
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
import { Select } from "../components/ui/select";
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

export default function EmployeeCreate() {
  const navigate = useNavigate();

  const [cardNumber, setCardNumber] = useState("");
  const [empId, setEmpId] = useState("");
  const [empGroup, setEmpGroup] = useState("PGI");
  const [name, setName] = useState("");

  const handleSave = async () => {
    const payload = {
      cardNumber: cardNumber,
      employeeId: empId,
      employeeGroup: empGroup,
      name: name,
    };

    try {
      const response = await fetch(import.meta.env.VITE_API_URL + "/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save changes.");
      }

      toast.success("Employee registered successfully!");
      setCardNumber("");
      setEmpId("");
      setEmpGroup("PGI");
      setName("");
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
                  <BreadcrumbLink to="/employee">Employee</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink to={"/employee/create"}>
                    Create
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="p-4">
          <Button
            onClick={() => navigate("/employee")}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft /> List Employee
          </Button>
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
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
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
