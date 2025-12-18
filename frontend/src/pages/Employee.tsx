import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";

import { AppSidebar } from "../components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "../components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";

import { Button } from "../components/ui/button";
import type { EmployeeResource } from "..";

interface Employee {
  employeeId: string;
  employeeGroup: string;
  cardNumber: string;
  name: string;
}

export default function Employee() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          import.meta.env.VITE_API_URL + "/employee"
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        const mappedData = data.map((employee: EmployeeResource) => ({
          employeeId: employee.employee_id,
          employeeGroup: employee.employee_group,
          name: employee.name,
          cardNumber: employee.card_number,
        }));
        setEmployees(mappedData);
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
  }, []);

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
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Employee List</h2>
            <Button
              onClick={() => navigate("/employee/create")}
              variant="outline"
              className="mb-4"
            >
              <PlusCircle /> Register Card
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    No
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Card Number
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Employee ID
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Employee Name
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Employee Group
                  </th>
                  <th className="px-6 py-3 border-b text-left font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee, index) => (
                  <tr className="odd:bg-white even:bg-gray-50" key={index}>
                    <td className="px-6 py-3 border-b">{index + 1}</td>
                    <td className="px-6 py-3 border-b">
                      {employee.cardNumber}
                    </td>
                    <td className="px-6 py-3 border-b">
                      {employee.employeeId}
                    </td>
                    <td className="px-6 py-3 border-b">{employee.name}</td>
                    <td className="px-6 py-3 border-b">
                      {employee.employeeGroup}
                    </td>
                    <td className="px-6 py-3 border-b">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() =>
                            navigate(`/employee/edit/${employee.employeeId}`)
                          }
                          variant="outline"
                          size="sm"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {
                            if (
                              window.confirm(
                                "Are you sure you want to delete this employee?"
                              )
                            ) {
                              fetch(
                                `${import.meta.env.VITE_API_URL}/employee/${
                                  employee.employeeId
                                }/delete`,
                                {
                                  method: "DELETE",
                                }
                              ).then(() => {
                                setEmployees(
                                  employees.filter(
                                    (emp) =>
                                      emp.employeeId !== employee.employeeId
                                  )
                                );
                              });
                            }
                          }}
                          variant="outline"
                          size="sm"
                          color="destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
