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

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/employee" element={<Employee />} />
        <Route path="/employee/create" element={<EmployeeCreate />} />
        <Route path="/employee/edit/:employeeId" element={<EmployeeEdit />} />
        <Route path="/tenant" element={<Tenant />} />
        <Route path="/tenant/create" element={<TenantCreate />} />
        <Route path="/tenant/edit/:id" element={<TenantEdit />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transactions/create" element={<TransactionCreate />} />
        <Route path="/transactions/edit/:id" element={<TransactionEdit />} />
        <Route path="/transactions/export" element={<TransactionExportPage />} />
        <Route path="/bind-tenant" element={<BindTenant />} />
        <Route path="/monitor" element={<Monitor />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}

export default App;
