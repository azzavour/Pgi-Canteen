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
import { Textarea } from "../components/ui/textarea";

export default function TenantCreate() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [quota, setQuota] = useState(0);
  const [menu, setMenu] = useState("");
  const [isLimited, setIsLimited] = useState(false);

  const handleSave = async () => {
    const payload = {
      name: name,
      quota: quota,
      menu: menu.split("\n").map((item) => item.trim()),
      isLimited: isLimited,
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save changes.");
      }

      toast.success("Tenant registered successfully!");
      setName("");
      setQuota(0);
      setMenu("");
      setIsLimited(false);
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
                  <BreadcrumbLink to="/tenant">Tenant</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink to={"/tenant/create"}>Create</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="p-4">
          <Button
            onClick={() => navigate("/tenant")}
            variant="outline"
            className="mb-4"
          >
            <ArrowLeft /> List Tenant
          </Button>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl mb-4">
                Form Register Tenant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tenantName" className="text-lg">
                  Tenant Name
                </Label>
                <Input
                  id="tenantName"
                  className="text-lg p-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quota" className="text-lg">
                  Quota
                </Label>
                <Input
                  id="quota"
                  type="number"
                  className="text-lg p-2"
                  value={quota}
                  onChange={(e) => setQuota(parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="menu" className="text-lg">
                  Menu (one item per line)
                </Label>
                <Textarea
                  id="menu"
                  className="text-lg p-2"
                  value={menu}
                  onChange={(e) => setMenu(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Input
                  id="isLimited"
                  type="checkbox"
                  className="h-5 w-5"
                  checked={isLimited}
                  onChange={(e) => setIsLimited(e.target.checked)}
                />
                <Label htmlFor="isLimited" className="text-lg">
                  Is Limited
                </Label>
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