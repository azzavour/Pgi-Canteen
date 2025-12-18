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
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/dashboard"
          element={
            <AdminGate>
              <Dashboard />
            </AdminGate>
          }
        />
        <Route
          path="/employee"
          element={
            <AdminGate>
              <Employee />
            </AdminGate>
          }
        />
        <Route
          path="/employee/create"
          element={
            <AdminGate>
              <EmployeeCreate />
            </AdminGate>
          }
        />
        <Route
          path="/employee/edit/:employeeId"
          element={
            <AdminGate>
              <EmployeeEdit />
            </AdminGate>
          }
        />
        <Route
          path="/tenant"
          element={
            <AdminGate>
              <Tenant />
            </AdminGate>
          }
        />
        <Route
          path="/tenant/create"
          element={
            <AdminGate>
              <TenantCreate />
            </AdminGate>
          }
        />
        <Route
          path="/tenant/edit/:id"
          element={
            <AdminGate>
              <TenantEdit />
            </AdminGate>
          }
        />
        <Route
          path="/transactions"
          element={
            <AdminGate>
              <Transactions />
            </AdminGate>
          }
        />
        <Route
          path="/transactions/create"
          element={
            <AdminGate>
              <TransactionCreate />
            </AdminGate>
          }
        />
        <Route
          path="/transactions/edit/:id"
          element={
            <AdminGate>
              <TransactionEdit />
            </AdminGate>
          }
        />
        <Route
          path="/transactions/export"
          element={
            <AdminGate>
              <TransactionExportPage />
            </AdminGate>
          }
        />
        <Route
          path="/bind-tenant"
          element={
            <AdminGate>
              <BindTenant />
            </AdminGate>
          }
        />
        <Route path="/monitor" element={<Monitor />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}

export default App;
