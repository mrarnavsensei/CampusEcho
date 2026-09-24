INSERT OR IGNORE INTO `campuses` (`id`, `name`, `slug`, `status`, `created_at`, `updated_at`) VALUES
  ('campus_sites_test', 'CampusCrate Development College', 'development-college', 'active', 1789891200000, 1789891200000),
  ('campus_ims', 'IMS Engineering College', 'ims-engineering-college', 'active', 1789891200000, 1789891200000);
INSERT OR IGNORE INTO `college_domains` (`id`, `campus_id`, `domain`, `verified`, `created_at`) VALUES
  ('domain_sites_test', 'campus_sites_test', 'sites.test', 1, 1789891200000),
  ('domain_ims', 'campus_ims', 'imsec.ac.in', 1, 1789891200000);
