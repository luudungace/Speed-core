-- Migration to add publish_date column to discovered_forums table
alter table discovered_forums add column if not exists publish_date text null;
