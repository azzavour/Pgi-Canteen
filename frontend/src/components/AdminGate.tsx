import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import type { AdminCredentials } from "../lib/adminAuth";
import {
  clearAdminCredentials,
  ensureCredentialsInUrl,
  extractCredentialsFromSearch,
  hasCredentialParams,
  persistAdminCredentials,
  readAdminCredentialsFromStorage,
  verifyAdminCredentials,
} from "../lib/adminAuth";

type AdminGateProps = {
  children: React.ReactNode;
};

type GateStatus = "checking" | "allowed";

export function AdminGate({ children }: AdminGateProps) {
  const [status, setStatus] = useState<GateStatus>("checking");
  const [credentials, setCredentials] = useState<AdminCredentials | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = import.meta.env.BASE_URL || "/";
  const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const monitorUrl = `${normalizedBasePath}monitor`;
  const apiBaseUrl = import.meta.env.VITE_API_URL || "";

  const redirectToMonitor = useCallback(() => {
    clearAdminCredentials();
    setCredentials(null);
    window.location.replace(monitorUrl);
  }, [monitorUrl]);

  useEffect(() => {
    const queryCredentials = extractCredentialsFromSearch(location.search);
    if (queryCredentials) {
      persistAdminCredentials(queryCredentials);
      setCredentials(queryCredentials);
      return;
    }

    if (hasCredentialParams(location.search)) {
      redirectToMonitor();
      return;
    }

    const storedCredentials = readAdminCredentialsFromStorage();
    if (storedCredentials) {
      setCredentials(storedCredentials);
      const targetUrl = ensureCredentialsInUrl(
        location.pathname,
        location.search,
        storedCredentials,
      );
      navigate(targetUrl, { replace: true });
      return;
    }

    redirectToMonitor();
  }, [location.pathname, location.search, navigate, redirectToMonitor]);

  useEffect(() => {
    if (!credentials) {
      return;
    }
    let cancelled = false;
    const activeCredentials = credentials;
    async function runValidation() {
      setStatus("checking");
      try {
        const result = await verifyAdminCredentials(apiBaseUrl, activeCredentials);
        if (!result.ok || result.is_admin === false) {
          throw new Error(result.reason || "Unauthorized");
        }
        if (!cancelled) {
          persistAdminCredentials(activeCredentials);
          setStatus("allowed");
        }
      } catch (error) {
        console.error("[AdminGate] verification failed:", error);
        if (!cancelled) {
          redirectToMonitor();
        }
      }
    }
    void runValidation();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, credentials, redirectToMonitor]);

  if (status !== "allowed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700">
        Memverifikasi akses admin...
      </div>
    );
  }

  return <>{children}</>;
}
