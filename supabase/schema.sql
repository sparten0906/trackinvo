-- InventoPro — Supabase Database Schema
-- Run this in the Supabase SQL editor to set up all tables, indexes, and policies.
-- Requires: Supabase project with auth.users table (created automatically).

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Settings (single row per org) ───────────────────────────────────────────
create table if not exists public.settings (
  id                  uuid primary key default uuid_generate_v4(),
  business_name       text not null default 'My Business',
  business_email      text,
  business_phone      text,
  business_address    text,
  business_city       text,
  business_country    text,
  tax_number          text,
  currency            text not null default 'USD',
  currency_symbol     text not null default '$',
  invoice_prefix      text not null default 'INV',
  purchase_prefix     text not null default 'PUR',
  tax_rate            numeric(5,2) not null default 0,
  low_stock_threshold integer not null default 10,
  invoice_footer      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Insert default settings row (idempotent)
insert into public.settings (business_name) values ('My Business')
on conflict do nothing;

-- ─── Categories ──────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  color       text,
  icon        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists categories_name_idx on public.categories(name);

-- ─── Suppliers ────────────────────────────────────────────────────────────────
create table if not exists public.suppliers (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  email        text,
  phone        text,
  address      text,
  city         text,
  country      text,
  gst_number   text,
  contact_name text,
  website      text,
  notes        text,
  status       text not null default 'active' check (status in ('active','inactive')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists suppliers_name_idx on public.suppliers(name);
create index if not exists suppliers_status_idx on public.suppliers(status);

-- ─── Customers ────────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  email        text,
  phone        text,
  address      text,
  city         text,
  country      text,
  gst_number   text,
  credit_limit numeric(12,2) not null default 0,
  status       text not null default 'active' check (status in ('active','inactive')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers(name);
create index if not exists customers_status_idx on public.customers(status);

-- ─── Products ─────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  sku            text not null unique,
  barcode        text,
  brand          text,
  description    text,
  category_id    uuid references public.categories(id) on delete set null,
  supplier_id    uuid references public.suppliers(id) on delete set null,
  unit           text not null default 'pcs',
  purchase_price numeric(12,2) not null default 0,
  selling_price  numeric(12,2) not null default 0,
  tax_percentage numeric(5,2) not null default 0,
  current_stock  integer not null default 0,
  minimum_stock  integer not null default 10,
  status         text not null default 'active' check (status in ('active','inactive')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists products_sku_idx      on public.products(sku);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_supplier_idx on public.products(supplier_id);
create index if not exists products_status_idx   on public.products(status);
create index if not exists products_stock_idx    on public.products(current_stock);

-- ─── Invoices ─────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id              uuid primary key default uuid_generate_v4(),
  invoice_number  text not null unique,
  customer_id     uuid references public.customers(id) on delete set null,
  customer_name   text,
  invoice_date    date not null default current_date,
  due_date        date,
  subtotal        numeric(12,2) not null default 0,
  discount_type   text not null default 'fixed' check (discount_type in ('fixed','percent')),
  discount_value  numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_total       numeric(12,2) not null default 0,
  grand_total     numeric(12,2) not null default 0,
  payment_method  text not null default 'cash' check (payment_method in ('cash','card','upi','bank_transfer','cheque','other')),
  payment_status  text not null default 'paid' check (payment_status in ('paid','partial','unpaid')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists invoices_number_idx        on public.invoices(invoice_number);
create index if not exists invoices_customer_idx      on public.invoices(customer_id);
create index if not exists invoices_date_idx          on public.invoices(invoice_date);
create index if not exists invoices_payment_status_idx on public.invoices(payment_status);

-- ─── Invoice Items ────────────────────────────────────────────────────────────
create table if not exists public.invoice_items (
  id             uuid primary key default uuid_generate_v4(),
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  product_name   text not null,
  sku            text,
  quantity       integer not null check (quantity > 0),
  unit_price     numeric(12,2) not null,
  tax_percentage numeric(5,2) not null default 0,
  tax_amount     numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  total          numeric(12,2) not null,
  created_at     timestamptz not null default now()
);

create index if not exists invoice_items_invoice_idx  on public.invoice_items(invoice_id);
create index if not exists invoice_items_product_idx  on public.invoice_items(product_id);

-- ─── Purchases ────────────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id              uuid primary key default uuid_generate_v4(),
  purchase_number text not null unique,
  supplier_id     uuid references public.suppliers(id) on delete set null,
  supplier_name   text,
  purchase_date   date not null default current_date,
  expected_date   date,
  subtotal        numeric(12,2) not null default 0,
  tax_total       numeric(12,2) not null default 0,
  grand_total     numeric(12,2) not null default 0,
  payment_status  text not null default 'paid' check (payment_status in ('paid','partial','unpaid')),
  status          text not null default 'received' check (status in ('received','pending','cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists purchases_number_idx       on public.purchases(purchase_number);
create index if not exists purchases_supplier_idx     on public.purchases(supplier_id);
create index if not exists purchases_date_idx         on public.purchases(purchase_date);
create index if not exists purchases_payment_status_idx on public.purchases(payment_status);

-- ─── Purchase Items ───────────────────────────────────────────────────────────
create table if not exists public.purchase_items (
  id             uuid primary key default uuid_generate_v4(),
  purchase_id    uuid not null references public.purchases(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  product_name   text not null,
  sku            text,
  quantity       integer not null check (quantity > 0),
  purchase_price numeric(12,2) not null,
  tax_percentage numeric(5,2) not null default 0,
  tax_amount     numeric(12,2) not null default 0,
  total          numeric(12,2) not null,
  created_at     timestamptz not null default now()
);

create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);
create index if not exists purchase_items_product_idx  on public.purchase_items(product_id);

-- ─── Stock Movements ─────────────────────────────────────────────────────────
create table if not exists public.stock_movements (
  id             uuid primary key default uuid_generate_v4(),
  product_id     uuid not null references public.products(id) on delete cascade,
  movement_type  text not null check (movement_type in ('in','out','adjustment')),
  reference_type text check (reference_type in ('invoice','purchase','adjustment','opening')),
  reference_id   uuid,
  quantity       integer not null,
  previous_stock integer not null,
  new_stock      integer not null,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists stock_movements_product_idx    on public.stock_movements(product_id);
create index if not exists stock_movements_type_idx       on public.stock_movements(movement_type);
create index if not exists stock_movements_reference_idx  on public.stock_movements(reference_type, reference_id);
create index if not exists stock_movements_created_at_idx on public.stock_movements(created_at desc);

-- ─── Updated_at auto-trigger ──────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach to all tables with updated_at
do $$
declare t text;
begin
  foreach t in array array['settings','categories','suppliers','customers','products','invoices','purchases'] loop
    execute format('
      create trigger %I_updated_at
      before update on public.%I
      for each row execute procedure public.handle_updated_at();
    ', t, t);
  end loop;
exception when duplicate_object then null;
end;
$$;

-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- Enable RLS on every table. All authenticated users can read/write.
-- Adjust policies below if you need multi-tenant isolation.

alter table public.settings       enable row level security;
alter table public.categories     enable row level security;
alter table public.suppliers      enable row level security;
alter table public.customers      enable row level security;
alter table public.products       enable row level security;
alter table public.invoices       enable row level security;
alter table public.invoice_items  enable row level security;
alter table public.purchases      enable row level security;
alter table public.purchase_items enable row level security;
alter table public.stock_movements enable row level security;

-- Authenticated users: full access
create policy "auth_all_settings"        on public.settings        for all to authenticated using (true) with check (true);
create policy "auth_all_categories"      on public.categories      for all to authenticated using (true) with check (true);
create policy "auth_all_suppliers"       on public.suppliers       for all to authenticated using (true) with check (true);
create policy "auth_all_customers"       on public.customers       for all to authenticated using (true) with check (true);
create policy "auth_all_products"        on public.products        for all to authenticated using (true) with check (true);
create policy "auth_all_invoices"        on public.invoices        for all to authenticated using (true) with check (true);
create policy "auth_all_invoice_items"   on public.invoice_items   for all to authenticated using (true) with check (true);
create policy "auth_all_purchases"       on public.purchases       for all to authenticated using (true) with check (true);
create policy "auth_all_purchase_items"  on public.purchase_items  for all to authenticated using (true) with check (true);
create policy "auth_all_stock_movements" on public.stock_movements for all to authenticated using (true) with check (true);

-- ─── ALTER existing tables to add return/payment columns ─────────────────────
alter table public.invoices
  add column if not exists paid_amount    numeric(12,2) not null default 0,
  add column if not exists balance_amount numeric(12,2) not null default 0,
  add column if not exists return_status  text not null default 'none'
    check (return_status in ('none','partial','full')),
  add column if not exists payment_method_ext text; -- allows credit, cheque, bank_transfer

alter table public.purchases
  add column if not exists paid_amount    numeric(12,2) not null default 0,
  add column if not exists balance_amount numeric(12,2) not null default 0,
  add column if not exists return_status  text not null default 'none'
    check (return_status in ('none','partial','full'));

-- Extend payment_method check on invoices to include all methods
-- (drop old constraint, add new one)
alter table public.invoices
  drop constraint if exists invoices_payment_method_check;
alter table public.invoices
  add constraint invoices_payment_method_check
    check (payment_method in ('cash','card','upi','bank_transfer','credit','cheque','other'));

-- ─── Sales Returns ────────────────────────────────────────────────────────────
create table if not exists public.sales_returns (
  id             uuid primary key default uuid_generate_v4(),
  return_number  text not null unique,
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  invoice_number text not null,
  customer_id    uuid references public.customers(id) on delete set null,
  customer_name  text,
  return_date    date not null default current_date,
  reason         text not null default 'other',
  notes          text,
  total_amount   numeric(12,2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists sales_returns_invoice_idx    on public.sales_returns(invoice_id);
create index if not exists sales_returns_customer_idx   on public.sales_returns(customer_id);
create index if not exists sales_returns_date_idx       on public.sales_returns(return_date);
create index if not exists sales_returns_number_idx     on public.sales_returns(return_number);

-- ─── Sales Return Items ───────────────────────────────────────────────────────
create table if not exists public.sales_return_items (
  id              uuid primary key default uuid_generate_v4(),
  sales_return_id uuid not null references public.sales_returns(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  product_name    text not null,
  sku             text,
  return_qty      integer not null check (return_qty > 0),
  unit_price      numeric(12,2) not null,
  tax_percent     numeric(5,2) not null default 0,
  discount        numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists sales_return_items_return_idx   on public.sales_return_items(sales_return_id);
create index if not exists sales_return_items_product_idx  on public.sales_return_items(product_id);

-- ─── Purchase Returns ─────────────────────────────────────────────────────────
create table if not exists public.purchase_returns (
  id              uuid primary key default uuid_generate_v4(),
  return_number   text not null unique,
  purchase_id     uuid not null references public.purchases(id) on delete cascade,
  purchase_number text not null,
  supplier_id     uuid references public.suppliers(id) on delete set null,
  supplier_name   text,
  return_date     date not null default current_date,
  reason          text not null default 'other',
  notes           text,
  total_amount    numeric(12,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists purchase_returns_purchase_idx on public.purchase_returns(purchase_id);
create index if not exists purchase_returns_supplier_idx on public.purchase_returns(supplier_id);
create index if not exists purchase_returns_date_idx     on public.purchase_returns(return_date);
create index if not exists purchase_returns_number_idx   on public.purchase_returns(return_number);

-- ─── Purchase Return Items ────────────────────────────────────────────────────
create table if not exists public.purchase_return_items (
  id                 uuid primary key default uuid_generate_v4(),
  purchase_return_id uuid not null references public.purchase_returns(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  product_name       text not null,
  sku                text,
  return_qty         integer not null check (return_qty > 0),
  unit_cost          numeric(12,2) not null,
  created_at         timestamptz not null default now()
);

create index if not exists purchase_return_items_return_idx   on public.purchase_return_items(purchase_return_id);
create index if not exists purchase_return_items_product_idx  on public.purchase_return_items(product_id);

-- ─── Stock Transactions (detailed ledger replacing stock_movements) ───────────
create table if not exists public.stock_transactions (
  id               uuid primary key default uuid_generate_v4(),
  product_id       uuid not null references public.products(id) on delete cascade,
  product_name     text not null,
  sku              text,
  transaction_type text not null check (transaction_type in (
    'SALE','PURCHASE','PURCHASE_RECEIVE','PURCHASE_REPLACEMENT_RECEIVE',
    'GENERAL_PURCHASE_RECEIVE',
    'SALE_RETURN','PURCHASE_RETURN',
    'MANUAL_ADJUSTMENT','DAMAGED','EXPIRED','OPENING_STOCK'
  )),
  reference_type   text,
  reference_id     uuid,
  reference_number text,
  quantity_in      integer not null default 0,
  quantity_out     integer not null default 0,
  previous_stock   integer not null,
  new_stock        integer not null,
  note             text,
  created_at       timestamptz not null default now()
);

-- ─── Additional columns for PO receiving detail ───────────────────────────────
-- Purchase order items: extra quantity tracking + replacement
alter table public.purchase_items
  add column if not exists accepted_qty            integer not null default 0,
  add column if not exists damaged_qty             integer not null default 0,
  add column if not exists defective_qty           integer not null default 0,
  add column if not exists rejected_qty            integer not null default 0,
  add column if not exists pending_replacement_qty integer not null default 0,
  add column if not exists replacement_received_qty integer not null default 0,
  add column if not exists extra_accepted_qty      integer not null default 0,
  add column if not exists extra_damaged_qty       integer not null default 0,
  add column if not exists extra_defective_qty     integer not null default 0,
  add column if not exists extra_rejected_qty      integer not null default 0;

-- Purchase returns: replacement tracking fields
alter table public.purchase_returns
  add column if not exists condition_type           text,
  add column if not exists is_extra_quantity        boolean not null default false,
  add column if not exists replacement_required     boolean not null default true,
  add column if not exists pending_replacement_qty  integer not null default 0,
  add column if not exists replacement_date         date,
  add column if not exists replacement_notes        text,
  add column if not exists replacement_ref_num      text,
  add column if not exists purchase_order_id        uuid references public.purchases(id) on delete set null,
  add column if not exists purchase_order_number    text,
  add column if not exists purchase_receipt_id      uuid,
  add column if not exists purchase_receipt_number  text,
  add column if not exists source_type              text;

-- Extend purchase_returns status check
alter table public.purchase_returns
  drop constraint if exists purchase_returns_status_check;
-- (status is text, no constraint was defined by default — add one explicitly)
alter table public.purchase_returns
  add column if not exists status text not null default 'pending_return';

-- Purchase return items: extra quantity + condition tracking
alter table public.purchase_return_items
  add column if not exists condition       text,
  add column if not exists po_item_id      uuid,
  add column if not exists is_extra_quantity boolean not null default false;

create index if not exists stock_tx_product_idx    on public.stock_transactions(product_id);
create index if not exists stock_tx_type_idx       on public.stock_transactions(transaction_type);
create index if not exists stock_tx_reference_idx  on public.stock_transactions(reference_type, reference_id);
create index if not exists stock_tx_created_at_idx on public.stock_transactions(created_at desc);

-- ─── Enable RLS on new tables ─────────────────────────────────────────────────
alter table public.sales_returns          enable row level security;
alter table public.sales_return_items     enable row level security;
alter table public.purchase_returns       enable row level security;
alter table public.purchase_return_items  enable row level security;
alter table public.stock_transactions     enable row level security;

create policy "auth_all_sales_returns"         on public.sales_returns         for all to authenticated using (true) with check (true);
create policy "auth_all_sales_return_items"    on public.sales_return_items    for all to authenticated using (true) with check (true);
create policy "auth_all_purchase_returns"      on public.purchase_returns      for all to authenticated using (true) with check (true);
create policy "auth_all_purchase_return_items" on public.purchase_return_items for all to authenticated using (true) with check (true);
create policy "auth_all_stock_transactions"    on public.stock_transactions    for all to authenticated using (true) with check (true);

-- Attach updated_at trigger to new tables
do $$
declare t text;
begin
  foreach t in array array['sales_returns','purchase_returns'] loop
    execute format('
      create trigger %I_updated_at
      before update on public.%I
      for each row execute procedure public.handle_updated_at();
    ', t, t);
  end loop;
exception when duplicate_object then null;
end;
$$;

-- ─── Purchase Orders ─────────────────────────────────────────────────────────
create table if not exists public.purchase_orders (
  id            uuid primary key default uuid_generate_v4(),
  po_number     text not null unique,
  supplier_id   uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  status        text not null default 'created' check (status in (
    'created','sent','approved','partially_received','received',
    'cancelled','rejected','closed'
  )),
  order_date    date not null default current_date,
  expected_date date,
  supplier_ref  text,
  payment_terms text,
  notes         text,
  subtotal      numeric(12,2) not null default 0,
  grand_total   numeric(12,2) not null default 0,
  timeline      jsonb not null default '[]',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists po_number_idx   on public.purchase_orders(po_number);
create index if not exists po_supplier_idx on public.purchase_orders(supplier_id);
create index if not exists po_status_idx   on public.purchase_orders(status);
create index if not exists po_date_idx     on public.purchase_orders(order_date);

-- ─── Purchase Order Items ─────────────────────────────────────────────────────
create table if not exists public.purchase_order_items (
  id                    uuid primary key default uuid_generate_v4(),
  po_id                 uuid not null references public.purchase_orders(id) on delete cascade,
  product_id            uuid references public.products(id) on delete set null,
  product_name          text not null,
  sku                   text,
  description           text,
  unit                  text,
  quantity              integer not null default 1 check (quantity > 0),
  received_qty          integer not null default 0,
  unit_cost             numeric(12,2) not null default 0,
  selling_price         numeric(12,2) not null default 0,
  tax_percent           numeric(5,2) not null default 0,
  hsn_sac               text,
  category_id           uuid references public.categories(id) on delete set null,
  brand                 text,
  is_new_product        boolean not null default false,
  product_linked        boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists po_items_po_idx      on public.purchase_order_items(po_id);
create index if not exists po_items_product_idx on public.purchase_order_items(product_id);

-- ─── Purchase Receipts (GRN) ─────────────────────────────────────────────────
create table if not exists public.purchase_receipts (
  id             uuid primary key default uuid_generate_v4(),
  receipt_number text not null unique,
  po_id          uuid references public.purchase_orders(id) on delete set null,
  po_number      text,
  supplier_id    uuid references public.suppliers(id) on delete set null,
  supplier_name  text,
  receipt_date   date not null default current_date,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists grn_po_idx   on public.purchase_receipts(po_id);
create index if not exists grn_date_idx on public.purchase_receipts(receipt_date);

-- ─── Purchase Receipt Items ───────────────────────────────────────────────────
create table if not exists public.purchase_receipt_items (
  id           uuid primary key default uuid_generate_v4(),
  receipt_id   uuid not null references public.purchase_receipts(id) on delete cascade,
  po_item_id   uuid references public.purchase_order_items(id) on delete set null,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  sku          text,
  ordered_qty  integer not null default 0,
  received_qty integer not null default 0,
  condition    text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists grn_items_receipt_idx on public.purchase_receipt_items(receipt_id);
create index if not exists grn_items_product_idx on public.purchase_receipt_items(product_id);

-- RLS for purchase orders tables
alter table public.purchase_orders        enable row level security;
alter table public.purchase_order_items   enable row level security;
alter table public.purchase_receipts      enable row level security;
alter table public.purchase_receipt_items enable row level security;

create policy "auth_all_purchase_orders"        on public.purchase_orders        for all to authenticated using (true) with check (true);
create policy "auth_all_purchase_order_items"   on public.purchase_order_items   for all to authenticated using (true) with check (true);
create policy "auth_all_purchase_receipts"      on public.purchase_receipts      for all to authenticated using (true) with check (true);
create policy "auth_all_purchase_receipt_items" on public.purchase_receipt_items for all to authenticated using (true) with check (true);

do $$
begin
  execute '
    create trigger purchase_orders_updated_at
    before update on public.purchase_orders
    for each row execute procedure public.handle_updated_at();
  ';
exception when duplicate_object then null;
end;
$$;

-- ─── Convenience views ────────────────────────────────────────────────────────
create or replace view public.low_stock_products as
  select id, name, sku, current_stock, minimum_stock, unit
  from   public.products
  where  current_stock <= minimum_stock and status = 'active';

create or replace view public.sales_summary as
  select
    date_trunc('month', invoice_date)::date as month,
    count(*)                                as invoice_count,
    sum(grand_total)                        as revenue,
    sum(tax_total)                          as tax_collected,
    sum(case when payment_status = 'paid' then grand_total else 0 end) as paid_revenue
  from public.invoices
  group by 1
  order by 1 desc;
