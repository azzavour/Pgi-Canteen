import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, PlusCircle } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Calendar } from "../components/ui/calendar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import type { DateRange } from "react-day-picker";
import { AppSidebar } from "../components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "../components/ui/breadcrumb";
import { useNavigate } from "react-router";
import {
  appendAdminCredentials,
  requireAdminCredentials,
} from "../lib/adminAuth";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

interface Transaction {
  id: number;
  cardNumber: string;
  employeeId: string;
  employeeName: string;
  employeeGroup: string;
  tenantId: number;
  tenantName: string;
  transactionDate: string;
}

interface TransactionResponse {
  id: number;
  card_number: string;
  employee_id: string;
  employee_name: string;
  employee_group: string;
  tenant_id: number;
  tenant_name: string;
  transaction_date: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface PaginationResponse {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export default function TransactionPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState<DateRange | undefined>(undefined);

  const [filters, setFilters] = useState({
    search: "",
    employee: "",
    tenant: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      start_date: date?.from ? format(date.from, "yyyy-MM-dd") : "",
      end_date: date?.to ? format(date.to, "yyyy-MM-dd") : "",
    }));
  }, [date]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prevFilters) => ({
      ...prevFilters,
      [name]: value,
    }));
  };

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: pagination.pageSize.toString(),
        });

        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            params.append(key, value);
          }
        });

        const credentials = requireAdminCredentials();
        const response = await fetch(
          appendAdminCredentials(
            `${API_BASE_URL}/transaction/report?${params.toString()}`,
            credentials
          )
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data: {
          data: TransactionResponse[];
          pagination: PaginationResponse;
        } = await response.json();
        const mappedData = data.data.map((item) => ({
          id: item.id,
          cardNumber: item.card_number,
          employeeId: item.employee_id,
          employeeName: item.employee_name,
          employeeGroup: item.employee_group,
          tenantId: item.tenant_id,
          tenantName: item.tenant_name,
          transactionDate: item.transaction_date,
        }));
        setTransactions(mappedData);
        setPagination({
          page: data.pagination.page,
          pageSize: data.pagination.page_size,
          totalItems: data.pagination.total_items,
          totalPages: data.pagination.total_pages,
        });
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
    },
    [filters, pagination.pageSize]
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      fetchData(newPage);
    }
  };

  // const handleDelete = async (id: number) => {
  //   if (window.confirm("Are you sure you want to delete this transaction?")) {
  //     try {
  //       const response = await fetch(
  //         `${import.meta.env.VITE_API_URL}/transaction/${id}/delete`,
  //         {
  //           method: "DELETE",
  //         }
  //       );
  //       if (!response.ok) {
  //         throw new Error("Failed to delete transaction.");
  //       }
  //       toast.success("Transaction deleted successfully!");
  //       fetchData(pagination.page);
  //     } catch (err) {
  //       toast.error(
  //         err instanceof Error ? err.message : "An unknown error occurred."
  //       );
  //     }
  //   }
  // };

  if (error) {
    return <div className="p-8">Error: {error}</div>;
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
                  <BreadcrumbLink to="/transactions">
                    Transactions
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Button onClick={() => navigate("/transactions/create")}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Create Transaction
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/transactions/export")}
                >
                  Export to XLSX
                </Button>
              </div>
              <form
                onSubmit={handleFilterSubmit}
                className="mb-6 flex flex-col gap-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <Input
                      id="search"
                      name="search"
                      placeholder="Search by employee, tenant, or card number..."
                      value={filters.search}
                      onChange={handleFilterChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee">Employee</Label>
                    <Input
                      id="employee"
                      name="employee"
                      placeholder="Filter by employee name..."
                      value={filters.employee}
                      onChange={handleFilterChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tenant">Tenant</Label>
                    <Input
                      id="tenant"
                      name="tenant"
                      placeholder="Filter by tenant name..."
                      value={filters.tenant}
                      onChange={handleFilterChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date-range">Transaction Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date-range"
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date?.from ? (
                            date.to ? (
                              <>
                                {format(date.from, "dd LLL y")} -{" "}
                                {format(date.to, "dd LLL y")}
                              </>
                            ) : (
                              format(date.from, "dd LLL y")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={date?.from}
                          selected={date}
                          onSelect={setDate}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Apply Filters</Button>
                </div>
              </form>

              {loading ? (
                <div className="text-center">Loading transactions...</div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-full table-auto text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            No
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Card Number
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Employee Name
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Tenant Name
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Transaction Date
                          </th>
                          {/* <th className="px-4 py-3 text-left font-medium text-gray-600">
                            Actions
                          </th> */}
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {transactions.map((transaction, index) => (
                          <tr key={transaction.id} className="border-t">
                            <td className="px-4 py-3">
                              {pagination.pageSize * (pagination.page - 1) +
                                index +
                                1}
                            </td>
                            <td className="px-4 py-3">
                              {transaction.cardNumber}
                            </td>
                            <td className="px-4 py-3">
                              {transaction.employeeName}
                            </td>
                            <td className="px-4 py-3">
                              {transaction.tenantName}
                            </td>
                            <td className="px-4 py-3">
                              {format(
                                new Date(transaction.transactionDate),
                                "dd LLL y"
                              )}
                            </td>
                            {/* <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    navigate(
                                      `/transactions/edit/${transaction.id}`
                                    )
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(transaction.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td> */}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-gray-600">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
