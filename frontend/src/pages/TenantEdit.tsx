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
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";

export default function TenantEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [quota, setQuota] = useState(0);
  const [menu, setMenu] = useState("");
  const [isLimited, setIsLimited] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/tenant/${id}/detail`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();

        const mappedData = {
          name: data.name,
          quota: data.quota,
          menu: data.menu.join("\n"),
          isLimited: data.is_limited,
          verificationCode: data.verification_code || "",
        };

        setName(mappedData.name);
        setQuota(mappedData.quota);
        setMenu(mappedData.menu);
        setIsLimited(mappedData.isLimited);
        setVerificationCode(mappedData.verificationCode);
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
  }, [id]);

  const handleGenerateCode = async () => {
    if (!id) {
      return;
    }
    setRegenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/tenant/${id}/generate-code`,
        {
          method: "POST",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to regenerate tenant code.");
      }
      const data = await response.json();
      setVerificationCode(data.verificationCode || "");
      toast.success("Tenant code updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to regenerate code.";
      toast.error(message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    const payload = {
      name: name,
      quota: quota,
      menu: menu.split("\n").map((item) => item.trim()),
      isLimited: isLimited,
    };

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/tenant/${id}/update`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save changes.");
      }

      toast.success("Tenant updated successfully!");
      navigate("/tenant");
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
                  <BreadcrumbLink to="/tenant">Tenant</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink to={"/tenant/edit/" + id}>
                    Edit
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="p-4 mb-4">
          <h2 className="text-2xl font-semibold">Edit Tenant</h2>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl mb-4">Form Edit Tenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-lg">
                  Tenant Code (read-only)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    className="text-lg p-2 font-mono"
                    value={verificationCode || "-"}
                    readOnly
                    disabled
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateCode}
                    disabled={regenerating}
                  >
                    {regenerating ? "Generating..." : "Generate Code"}
                  </Button>
                </div>
              </div>

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
