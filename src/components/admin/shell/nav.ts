import type { Permission } from "@/lib/permissions";

export type AdminNavItem = {
  label: string;
  href: string;
  /** Key into the icon map in sidebar-nav.tsx */
  icon: string;
  permission: Permission;
  group: string;
};

/**
 * The single source of truth for the admin sidebar. Remove an entry here to hide a section.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { group: "Overview", label: "Dashboard", href: "/admin", icon: "dashboard", permission: "admin.access" },

  { group: "Catalog", label: "Products", href: "/admin/products", icon: "products", permission: "products.manage" },
  { group: "Catalog", label: "Categories", href: "/admin/categories", icon: "categories", permission: "products.manage" },
  { group: "Catalog", label: "Instructors", href: "/admin/instructors", icon: "instructors", permission: "products.manage" },

  { group: "People", label: "Students", href: "/admin/students", icon: "students", permission: "students.view" },
  { group: "People", label: "Access", href: "/admin/enrollments", icon: "access", permission: "enrollments.manage" },
  { group: "People", label: "Team", href: "/admin/team", icon: "team", permission: "team.manage" },

  { group: "Content", label: "Announcements", href: "/admin/announcements", icon: "announcements", permission: "announcements.manage" },
  { group: "Content", label: "Pages", href: "/admin/pages", icon: "pages", permission: "pages.manage" },

  { group: "System", label: "Settings", href: "/admin/settings", icon: "settings", permission: "settings.manage" },
  { group: "System", label: "Integrations", href: "/admin/integrations", icon: "integrations", permission: "integrations.manage" },
];
