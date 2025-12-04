export type EmployeeResource = {
  employee_id: string;
  name: string;
  card_number: string;
  employee_group: string;
};

export type TenantResource = {
  id: number;
  name: string;
  quota: number;
  is_limited: boolean;
  menu: string[];
};

interface Employee {
  employeeId: string;
  employeeGroup: string;
  name: string;
  cardNumber: string;
}

interface Tenant {
  id: number;
  name: string;
  quota: number;
  is_limited: boolean;
  menu: string[];
}
