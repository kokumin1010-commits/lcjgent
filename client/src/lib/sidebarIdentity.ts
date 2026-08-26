export type SidebarIdentityUser = {
  name?: string | null;
  email?: string | null;
};

export function getSidebarDisplayName(user?: SidebarIdentityUser | null): string {
  const name = user?.name?.trim();
  if (name) return name;

  const emailName = user?.email?.split("@")[0]?.trim();
  return emailName || "ユーザー";
}
