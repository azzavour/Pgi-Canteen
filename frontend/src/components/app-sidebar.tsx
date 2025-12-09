"use client";

import * as React from "react";
import { FileDown, IdCardIcon, LayoutDashboard } from "lucide-react";

import { NavMain } from "../components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "../components/ui/sidebar";
import { Link } from "react-router";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: true,
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
        },
      ],
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: FileDown,
      isActive: true,
      items: [
        {
          title: "Transaction List",
          url: "/transactions",
        },
        {
          title: "Create Transaction",
          url: "/transactions/create",
        },
        {
          title: "Export",
          url: "/transactions/export",
        },
      ],
    },
    {
      title: "Employee",
      url: "/employee",
      icon: IdCardIcon,
      isActive: true,
      items: [
        {
          title: "Employee List",
          url: "/employee",
        },
        {
          title: "Register",
          url: "/employee/create",
        },
      ],
    },
    {
      title: "Tenant",
      url: "/tenant",
      icon: IdCardIcon,
      isActive: true,
      items: [
        {
          title: "Tenant List",
          url: "/tenant",
        },
        {
          title: "Register",
          url: "/tenant/create",
        },
      ],
    },
    {
      title: "Device",
      url: "/bind-tenant",
      icon: IdCardIcon,
      isActive: true,
      items: [
        {
          title: "Bind Tenant",
          url: "/bind-tenant",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img src="/favicon.ico" className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Cawang Canteen</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
