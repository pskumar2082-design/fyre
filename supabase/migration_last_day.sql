-- Lets a long-running movie stay in "Now Showing" past the usual ~6-week
-- window as long as Sacnilk is still publishing fresh daily numbers for it
-- (see lib/movieStatus.ts isInTheaters and lib/syncBoxOffice.ts, which
-- keeps this column current).
--
-- Safe to run more than once.

alter table now_showing add column if not exists last_day_date date;
