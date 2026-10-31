-- 追加マイグレーション（2026-10-31・統合版）: 開封トラッキング＋招待状へのお席表示
-- 既存プロジェクトの SQL Editor に貼って1回だけ実行する。何度実行しても安全（冪等）。
-- ※ migration_20261031_open_tracking.sql の内容を含むため、そちらが未実行でもこのファイルだけでよい。

-- 開封記録（最初の1回だけを保持）
create table if not exists public.invitation_opens (
    wedding_id uuid not null references public.weddings(id) on delete cascade,
    token text not null,
    guest_id text,
    opened_at timestamptz not null default now(),
    primary key (wedding_id, token)
);

alter table public.invitation_opens enable row level security;

drop policy if exists invitation_opens_owner_select on public.invitation_opens;
create policy invitation_opens_owner_select
    on public.invitation_opens
    for select
    to authenticated
    using (
        exists (
            select 1 from public.weddings as w
            where w.id = wedding_id and w.owner_id = auth.uid()
        )
    );

revoke all on public.invitation_opens from anon, authenticated;
grant select on public.invitation_opens to authenticated;

-- 招待取得時に開封を記録し、決まっていればお席も返す
create or replace function public.get_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_wedding_id uuid;
    v_state jsonb;
    v_guest jsonb;
    v_assignment jsonb;
    v_table_name text;
begin
    select w.id, w.state, g.guest
    into v_wedding_id, v_state, v_guest
    from public.weddings as w
    cross join lateral jsonb_array_elements(w.state -> 'guests') as g(guest)
    where g.guest ->> 'inviteToken' = p_token
    limit 1;

    if not found then
        return null;
    end if;

    insert into public.invitation_opens (wedding_id, token, guest_id)
    values (v_wedding_id, p_token, v_guest ->> 'id')
    on conflict (wedding_id, token) do nothing;

    v_assignment := v_state -> 'assignments' -> (v_guest ->> 'id');
    if v_assignment is not null then
        select t.tbl ->> 'name'
        into v_table_name
        from jsonb_array_elements(v_state -> 'tables') as t(tbl)
        where t.tbl ->> 'id' = v_assignment ->> 'tableId'
        limit 1;
    end if;

    return jsonb_build_object(
        'info', v_state -> 'info',
        'guest', jsonb_build_object(
            'id', v_guest -> 'id',
            'name', v_guest -> 'name',
            'title', v_guest -> 'title',
            'rsvp', v_guest -> 'rsvp',
            'companions', v_guest -> 'companions',
            'allergy', v_guest -> 'allergy',
            'memo', v_guest -> 'memo'
        ),
        'seat', case
            when v_assignment is null or v_table_name is null then null
            else jsonb_build_object(
                'tableName', v_table_name,
                'seatIndex', (v_assignment ->> 'seatIndex')::int
            )
        end
    );
end;
$$;

revoke all on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;

do $$
begin
    alter publication supabase_realtime add table public.invitation_opens;
exception
    when duplicate_object then
        null;
end;
$$;
