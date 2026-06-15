-- Migration to add exclude_domains column to dork_projects table
alter table dork_projects add column if not exists exclude_domains text[] not null default '{}';
