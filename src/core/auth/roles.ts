export const ORGANIZATION_ROLES = ["admin", "staff"] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export function isOrganizationRole(value: string): value is OrganizationRole {
  return ORGANIZATION_ROLES.includes(value as OrganizationRole);
}
