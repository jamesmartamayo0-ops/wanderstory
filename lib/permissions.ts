export type AdminRole = "SUPER_ADMIN" | "EDITOR";

export const PERMISSIONS = {
  "journey:create": ["SUPER_ADMIN", "EDITOR"],
  "journey:update": ["SUPER_ADMIN", "EDITOR"],
  "journey:autosave": ["SUPER_ADMIN", "EDITOR"],
  "journey:delete": ["SUPER_ADMIN"],
  "journey:publish": ["SUPER_ADMIN"],
  "journey:archive": ["SUPER_ADMIN"],
  "journey:visibility": ["SUPER_ADMIN"],
  "journey:feature": ["SUPER_ADMIN"],
  "consent:update": ["SUPER_ADMIN"],

  "chapter:create": ["SUPER_ADMIN", "EDITOR"],
  "chapter:update": ["SUPER_ADMIN", "EDITOR"],
  "chapter:delete": ["SUPER_ADMIN"],

  "media:upload": ["SUPER_ADMIN", "EDITOR"],
  "media:update": ["SUPER_ADMIN", "EDITOR"],
  "media:delete": ["SUPER_ADMIN"],
  "media:alt-text": ["SUPER_ADMIN", "EDITOR"],
  "media:detach": ["SUPER_ADMIN", "EDITOR"],
  "media:reorder": ["SUPER_ADMIN", "EDITOR"],

  "timeline:create": ["SUPER_ADMIN", "EDITOR"],
  "timeline:update": ["SUPER_ADMIN", "EDITOR"],
  "timeline:delete": ["SUPER_ADMIN"],
  "timeline:reorder": ["SUPER_ADMIN", "EDITOR"],

  "client:create": ["SUPER_ADMIN", "EDITOR"],
  "client:update": ["SUPER_ADMIN", "EDITOR"],
  "client:delete": ["SUPER_ADMIN"],

  "category:create": ["SUPER_ADMIN", "EDITOR"],
  "category:update": ["SUPER_ADMIN", "EDITOR"],
  "category:delete": ["SUPER_ADMIN"],

  "destination:create": ["SUPER_ADMIN", "EDITOR"],
  "destination:update": ["SUPER_ADMIN", "EDITOR"],
  "destination:delete": ["SUPER_ADMIN"],
  "destination:publish": ["SUPER_ADMIN"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type PermissionKey = keyof typeof PERMISSIONS;

export function rolesFor(key: PermissionKey): readonly AdminRole[] {
  return PERMISSIONS[key];
}

export function canAccess(role: AdminRole, key: PermissionKey): boolean {
  return (PERMISSIONS[key] as readonly AdminRole[]).includes(role);
}
