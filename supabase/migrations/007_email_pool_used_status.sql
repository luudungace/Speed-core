do $$
begin
  if not exists (select 1 from pg_type where typname = 'resource_pool_status') then
    create type resource_pool_status as enum ('available', 'locked', 'invalid', 'disabled', 'used');
  else
    alter type resource_pool_status add value if not exists 'used';
  end if;
end $$;

comment on type resource_pool_status is
  'Shared pool lifecycle: available = can be used, locked = reserved by a running job, invalid = bad credential/resource, disabled = manually disabled, used = consumed by a completed registration.';
