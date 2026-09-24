const ACCESS: Record<string, string[]> = {
  users: ['super_admin', 'moderator', 'support_admin'],
  moderation: ['super_admin', 'moderator', 'support_admin'],
  safety: ['super_admin', 'moderator', 'support_admin'],
  'voice-spaces': ['super_admin', 'moderator'],
  events: ['super_admin', 'event_manager'],
  chess: ['super_admin', 'event_manager', 'moderator'],
  administrators: ['super_admin'],
  'audit-logs': ['super_admin'],
  settings: ['super_admin'],
};
export function canVisitAdminPath(role: string, path: string) {
  const section = path.split('/')[2];
  return !ACCESS[section] || ACCESS[section].includes(role);
}
export const adminLinks = [
  ['Dashboard', '/admin/dashboard'], ['Users', '/admin/users'], ['Moderation', '/admin/moderation'],
  ['Voice spaces', '/admin/voice-spaces'], ['Safety', '/admin/safety'], ['Events', '/admin/events'],
  ['Chess', '/admin/chess'], ['Colleges', '/admin/colleges'], ['Analytics', '/admin/analytics'],
  ['Administrators', '/admin/administrators'], ['Audit logs', '/admin/audit-logs'], ['Settings', '/admin/settings'],
];
