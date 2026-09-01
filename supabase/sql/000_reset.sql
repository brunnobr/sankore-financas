-- Reset completo: apaga todas as tabelas do projeto antigo antes de recriar do zero.
-- Rode isso PRIMEIRO no SQL Editor do Supabase, depois rode 001_schema.sql.

drop table if exists import_queue cascade;
drop table if exists goals cascade;
drop table if exists nfse cascade;
drop table if exists card_invoices cascade;
drop table if exists card_charges cascade;
drop table if exists card_installment_plans cascade;
drop table if exists categorization_rules cascade;
drop table if exists transactions cascade;
drop table if exists benchmarks cascade;
drop table if exists dividends cascade;
drop table if exists contributions cascade;
drop table if exists asset_snapshots cascade;
drop table if exists settings cascade;
