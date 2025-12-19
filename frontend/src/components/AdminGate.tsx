import { useEffect, useState } from "react";

const TICKET_TTL_MS = 10 * 60 * 1000;

type AdminGateProps = {
  children: React.ReactNode;
};

export function AdminGate({ children }: AdminGateProps) {
  const [status, setStatus] = useState<"checking" | "allowed">("checking");
  const basePath = import.meta.env.BASE_URL || "/";
  const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const monitorUrl = `${normalizedBasePath}monitor`;
  const portalPath =
    normalizedBasePath === "/" ? "/" : normalizedBasePath.slice(0, -1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const empId = params.get("emp_id");
    const portalToken = params.get("portal_token");
    const allowEmpId = sessionStorage.getItem("dashboard_allow_emp_id");
    const allowTs = sessionStorage.getItem("dashboard_allow_ts");

    const redirectToPortal = () => {
      if (empId && portalToken) {
        const target = `${portalPath}?emp_id=${encodeURIComponent(
          empId
        )}&portal_token=${encodeURIComponent(portalToken)}`;
        window.location.replace(target);
      } else {
        window.location.replace(monitorUrl);
      }
    };

    if (!empId || !allowEmpId || empId !== allowEmpId || !allowTs) {
      redirectToPortal();
      return;
    }

    const employeeId = empId;

    const ticketAge = Date.now() - Number(allowTs);
    if (Number.isNaN(ticketAge) || ticketAge > TICKET_TTL_MS) {
      sessionStorage.removeItem("dashboard_allow_emp_id");
      sessionStorage.removeItem("dashboard_allow_ts");
      redirectToPortal();
      return;
    }

    let cancelled = false;
    async function verifyAdmin() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/admin/check?employeeId=${encodeURIComponent(
            employeeId
          )}`
        );
        if (!response.ok) {
          throw new Error("admin check failed");
        }
        const payload: { isAdmin?: boolean } = await response.json();
        if (!payload?.isAdmin) {
          redirectToPortal();
          return;
        }
        sessionStorage.setItem("dashboard_allow_ts", Date.now().toString());
        if (!cancelled) {
          setStatus("allowed");
        }
      } catch (error) {
        console.error("[AdminGate] verification failed:", error);
        redirectToPortal();
      }
    }

    void verifyAdmin();

    return () => {
      cancelled = true;
    };
  }, [monitorUrl, portalPath]);

  if (status !== "allowed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
