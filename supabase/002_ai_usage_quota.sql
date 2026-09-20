-- Artha v0.6: atomic daily AI quota
-- Run this AFTER ai_usage has been created.

create or replace function public.consume_ai_quota(p_limit integer default 30)
returns table (allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_limit < 1 then
    raise exception 'Quota limit must be positive.';
  end if;

  insert into public.ai_usage (user_id, usage_date, request_count)
  values (current_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update
    set request_count = public.ai_usage.request_count + 1,
        updated_at = now()
    where public.ai_usage.request_count < p_limit
  returning request_count into new_count;

  if new_count is null then
    return query select false, 0;
  else
    return query select true, greatest(0, p_limit - new_count);
  end if;
end;
$$;

revoke all on function public.consume_ai_quota(integer) from public;
grant execute on function public.consume_ai_quota(integer) to authenticated;
