import * as React from "react";
import { ChevronRight, GaugeIcon, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "../components/ui/sidebar";
import { Link } from "react-router";
import {
  appendAdminCredentials,
  getActiveAdminCredentials,
} from "../lib/adminAuth";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  const adminCredentials = React.useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return getActiveAdminCredentials();
  }, []);

  const buildUrl = React.useCallback(
    (url: string) => {
      return appendAdminCredentials(url, adminCredentials);
    },
    [adminCredentials]
  );

  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem key="Dashboard">
          <SidebarMenuButton asChild>
            <Link to={buildUrl("/dashboard")}>
              <GaugeIcon />
              Dashboard
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarGroupLabel>CRUD</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild>
                        <Link to={buildUrl(subItem.url)}>
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
