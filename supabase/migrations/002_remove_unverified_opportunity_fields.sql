drop index if exists idx_crawl_results_site_type;
drop index if exists idx_crawl_results_can_profile_link;
drop index if exists idx_crawl_results_can_post;
drop index if exists idx_crawl_results_can_register;

alter table crawl_results
  drop column if exists site_type,
  drop column if exists can_register,
  drop column if exists can_post,
  drop column if exists can_profile_link,
  drop column if exists opportunity_confidence,
  drop column if exists opportunity_reasons;
