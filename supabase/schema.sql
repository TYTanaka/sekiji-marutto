-- 結婚式データを保存
create table if not exists public.weddings (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    state jsonb not null,
    updated_at timestamptz not null default now()
);

create index if not exists weddings_owner_id_idx
    on public.weddings (owner_id);

-- 所有者だけが直接操作可能
alter table public.weddings enable row level security;

drop policy if exists weddings_owner_select on public.weddings;
create policy weddings_owner_select
    on public.weddings
    for select
    to authenticated
    using (auth.uid() = owner_id);

drop policy if exists weddings_owner_insert on public.weddings;
create policy weddings_owner_insert
    on public.weddings
    for insert
    to authenticated
    with check (auth.uid() = owner_id);

drop policy if exists weddings_owner_update on public.weddings;
create policy weddings_owner_update
    on public.weddings
    for update
    to authenticated
    using (auth.uid() = owner_id)
    with check (auth.uid() = owner_id);

drop policy if exists weddings_owner_delete on public.weddings;
create policy weddings_owner_delete
    on public.weddings
    for delete
    to authenticated
    using (auth.uid() = owner_id);

revoke all on public.weddings from anon;
grant select, insert, update, delete on public.weddings to authenticated;

-- 招待リンクの開封記録（最初の1回だけを保持）
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

-- 招待トークンに対応する公開情報だけを返す（開封も記録する）
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

-- 行をロックして回答を更新し、同時更新による上書きを防ぐ
create or replace function public.submit_rsvp(
    p_token text,
    p_rsvp text,
    p_companions integer,
    p_allergy text,
    p_memo text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_wedding_id uuid;
    v_state jsonb;
    v_guests jsonb;
    v_guest jsonb;
    v_guest_index integer;
    v_companions integer;
begin
    if p_rsvp is null or p_rsvp not in ('attending', 'declined') then
        raise exception '出欠は attending または declined を指定してください'
            using errcode = '22023';
    end if;

    v_companions := greatest(0, least(5, coalesce(p_companions, 0)));

    select w.id, w.state
    into v_wedding_id, v_state
    from public.weddings as w
    where exists (
        select 1
        from jsonb_array_elements(w.state -> 'guests') as g(guest)
        where g.guest ->> 'inviteToken' = p_token
    )
    limit 1
    for update of w;

    if not found then
        return false;
    end if;

    v_guests := v_state -> 'guests';

    select g.guest, (g.ordinality - 1)::integer
    into v_guest, v_guest_index
    from jsonb_array_elements(v_guests)
        with ordinality as g(guest, ordinality)
    where g.guest ->> 'inviteToken' = p_token
    order by g.ordinality
    limit 1;

    if not found then
        return false;
    end if;

    -- 他のゲスト項目を保持して回答項目だけを置換
    v_guest := jsonb_set(v_guest, '{rsvp}', to_jsonb(p_rsvp), true);
    v_guest := jsonb_set(v_guest, '{companions}', to_jsonb(v_companions), true);
    v_guest := jsonb_set(
        v_guest, '{allergy}', coalesce(to_jsonb(p_allergy), 'null'::jsonb), true
    );
    v_guest := jsonb_set(
        v_guest, '{memo}', coalesce(to_jsonb(p_memo), 'null'::jsonb), true
    );

    v_guests := jsonb_set(
        v_guests,
        array[v_guest_index::text],
        v_guest,
        false
    );

    update public.weddings
    set state = jsonb_set(v_state, '{guests}', v_guests, false),
        updated_at = now()
    where id = v_wedding_id;

    return true;
end;
$$;

-- 招待者は専用関数を通じてアクセス
revoke all on function public.get_invitation(text) from public;
revoke all on function public.submit_rsvp(text, text, integer, text, text) from public;

grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, integer, text, text)
    to anon, authenticated;

-- Realtime 登録済みの場合はスキップ
do $$
begin
    alter publication supabase_realtime add table public.weddings;
exception
    when duplicate_object then
        null;
end;
$$;

do $$
begin
    alter publication supabase_realtime add table public.invitation_opens;
exception
    when duplicate_object then
        null;
end;
$$;
