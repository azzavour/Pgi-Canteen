import type { ReactElement } from "react";
import BindTenant from "./pages/BindTenant";
import { BrowserRouter, Routes, Route } from "react-router";
import Dashboard from "./pages/Dashboard";
import Employee from "./pages/Employee";
import Transactions from "./pages/Transactions";
import Home from "./pages/Home";
import EmployeeEdit from "./pages/EmployeeEdit";
import EmployeeCreate from "./pages/EmployeeCreate";
import { Toaster } from "./components/ui/sonner";
import Tenant from "./pages/Tenant";
import TenantCreate from "./pages/TenantCreate";
import TenantEdit from "./pages/TenantEdit";
import TransactionCreate from "./pages/TransactionCreate";
import TransactionEdit from "./pages/TransactionEdit";
import TransactionExportPage from "./pages/TransactionExport";
import Monitor from "./pages/Monitor";
import { AdminGate } from "./components/AdminGate";

function App() {
  const adminRoutes: Array<{ path: string; element: ReactElement }> = [
    { path: "/dashboard", element: <Dashboard /> },
    { path: "/employee", element: <Employee /> },
    { path: "/employee/create", element: <EmployeeCreate /> },
    { path: "/employee/edit/:employeeId", element: <EmployeeEdit /> },
    { path: "/tenant", element: <Tenant /> },
    { path: "/tenant/create", element: <TenantCreate /> },
    { path: "/tenant/edit/:id", element: <TenantEdit /> },
    { path: "/transactions", element: <Transactions /> },
    { path: "/transactions/create", element: <TransactionCreate /> },
    { path: "/transactions/edit/:id", element: <TransactionEdit /> },
    { path: "/transactions/export", element: <TransactionExportPage /> },
    { path: "/bind-tenant", element: <BindTenant /> },
  ];

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        {adminRoutes.map(({ path, element }) => (
          <Route
            key={path}
            path={path}
            element={<AdminGate>{element}</AdminGate>}
          />
        ))}
        <Route path="/monitor" element={<Monitor />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}

export default App;
