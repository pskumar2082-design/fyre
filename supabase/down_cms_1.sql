-- Undo for migration_cms_1.sql. NOT RUN; needs explicit approval.
-- DESTRUCTIVE for newsroom articles: export cms_article and
-- cms_article_revision first (see docs/fyre-v2/BACKUP_AND_ROLLBACK.md).
-- Drops ONLY what migration_cms_1.sql created. `news` and `reviews` are untouched.
drop function if exists cms_record_view(uuid, date);
drop table if exists cms_article_view_day;
drop table if exists cms_slug_redirect;
drop table if exists cms_article_revision;
drop table if exists cms_article;
drop table if exists cms_breaking_banner;
drop table if exists cms_home_section;
drop table if exists cms_category;
