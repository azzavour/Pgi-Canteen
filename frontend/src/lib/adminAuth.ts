export type AdminCredentials = {
  empId: string;
  portalToken: string;
};

export type AdminCheckResponse = {
  ok: boolean;
  emp_id?: string;
  is_admin?: boolean;
  reason?: string;
};

const ADMIN_EMP_ID_KEY = "dashboard_admin_emp_id";
const ADMIN_TOKEN_KEY = "dashboard_admin_portal_token";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function readAdminCredentialsFromStorage(): AdminCredentials | null {
  if (!isBrowser()) {
    return null;
  }
  const empId = sessionStorage.getItem(ADMIN_EMP_ID_KEY);
  const portalToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (empId && portalToken) {
    return { empId, portalToken };
  }
  return null;
}

export function persistAdminCredentials(credentials: AdminCredentials): void {
  if (!isBrowser()) {
    return;
  }
  sessionStorage.setItem(ADMIN_EMP_ID_KEY, credentials.empId);
  sessionStorage.setItem(ADMIN_TOKEN_KEY, credentials.portalToken);
}

export function clearAdminCredentials(): void {
  if (!isBrowser()) {
    return;
  }
  sessionStorage.removeItem(ADMIN_EMP_ID_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function extractCredentialsFromSearch(
  search: string | null | undefined,
): AdminCredentials | null {
  if (!search) {
    return null;
  }
  const normalized = search.startsWith("?") ? search : `?${search}`;
  const params = new URLSearchParams(normalized);
  const empId = params.get("emp_id");
  const portalToken = params.get("portal_token") ?? params.get("token");
  if (empId && portalToken) {
    return { empId, portalToken };
  }
  return null;
}

export function hasCredentialParams(search: string | null | undefined): boolean {
  if (!search) {
    return false;
  }
  const normalized = search.startsWith("?") ? search : `?${search}`;
  const params = new URLSearchParams(normalized);
  return params.has("emp_id") || params.has("portal_token") || params.has("token");
}

function buildQueryString(credentials: AdminCredentials): string {
  const params = new URLSearchParams();
  params.set("emp_id", credentials.empId);
  params.set("portal_token", credentials.portalToken);
  return params.toString();
}

export function appendAdminCredentials(
  url: string,
  credentials: AdminCredentials | null | undefined,
): string {
  if (!credentials) {
    return url;
  }
  try {
    const base =
      typeof window !== "undefined" && window.location
        ? window.location.origin
        : "http://localhost";
    const parsed = new URL(url, base);
    parsed.searchParams.set("emp_id", credentials.empId);
    parsed.searchParams.set("portal_token", credentials.portalToken);
    if (!parsed.host && !url.startsWith("http")) {
      return `${parsed.pathname}${parsed.search}`;
    }
    if (!url.startsWith("http")) {
      return `${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${buildQueryString(credentials)}`;
  }
}

export async function verifyAdminCredentials(
  apiBaseUrl: string,
  credentials: AdminCredentials,
): Promise<AdminCheckResponse> {
  const normalizedBase = (apiBaseUrl || "").replace(/\/$/, "");
  const targetUrl = normalizedBase
    ? `${normalizedBase}/admin/check`
    : "/admin/check";
  const urlWithParams = appendAdminCredentials(targetUrl, credentials);
  const response = await fetch(urlWithParams);
  const payload = (await response.json().catch(() => ({}))) as AdminCheckResponse;
  if (!response.ok && typeof payload.ok === "undefined") {
    return {
      ok: false,
      emp_id: credentials.empId,
      is_admin: false,
      reason: payload.reason || response.statusText || "Unauthorized",
    };
  }
  return {
    ok: Boolean(payload.ok),
    emp_id: payload.emp_id ?? credentials.empId,
    is_admin: payload.is_admin,
    reason: payload.reason,
  };
}

export function ensureCredentialsInUrl(
  pathname: string,
  search: string,
  credentials: AdminCredentials,
): string {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  params.set("emp_id", credentials.empId);
  params.set("portal_token", credentials.portalToken);
  const queryString = params.toString();
  return `${pathname}?${queryString}`;
}

export function getActiveAdminCredentials(): AdminCredentials | null {
  if (typeof window === "undefined") {
    return readAdminCredentialsFromStorage();
  }
  return (
    extractCredentialsFromSearch(window.location.search) ||
    readAdminCredentialsFromStorage()
  );
}

export function requireAdminCredentials(): AdminCredentials {
  const credentials = getActiveAdminCredentials();
  if (!credentials) {
    throw new Error("Admin credentials are not available.");
  }
  return credentials;
}
