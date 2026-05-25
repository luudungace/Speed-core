alter table crawl_jobs
  add column if not exists name text,
  add column if not exists max_urls integer not null default 500 check (max_urls between 10 and 2000),
  add column if not exists exclude_domains text[] not null default '{}';
