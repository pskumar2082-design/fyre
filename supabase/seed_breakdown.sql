-- Optional sample breakdown rows for "Veera Simham" so you can see the new
-- /now-showing/[id] page working immediately, instead of typing a full
-- state-by-state table by hand as your first test.
-- Run AFTER migration_breakdown.sql, and after seed.sql (Veera Simham must
-- already exist in now_showing). Uses a subquery by title so you don't need
-- to know its generated id.

-- STATE WISE, 2026-09-17
insert into box_office_breakdown (movie_id, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'state', 'Uttar Pradesh', '2026-09-17', 1.18, 1130, 49510, 83, 30, 19.04 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'state', 'Maharashtra', '2026-09-17', 1.01, 1110, 37690, 37, 2, 14.1 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'state', 'Delhi', '2026-09-17', 0.58, 299, 15640, 38, 0, 20.45 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'state', 'Karnataka', '2026-09-17', 0.50, 342, 17190, 48, 0, 20.14 from now_showing where title = 'Veera Simham';

-- LANGUAGE WISE, 2026-09-17
insert into box_office_breakdown (movie_id, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'language', 'Telugu', '2026-09-17', 2.85, 2200, 98000, 140, 22, 21.3 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'language', 'Hindi (dubbed)', '2026-09-17', 0.42, 481, 21840, 66, 10, 17.5 from now_showing where title = 'Veera Simham';

-- FORMAT WISE, 2026-09-17
insert into box_office_breakdown (movie_id, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'format', '2D', '2026-09-17', 2.60, 2400, 105000, 150, 20, 19.8 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'format', 'IMAX', '2026-09-17', 0.67, 281, 14840, 56, 12, 24.6 from now_showing where title = 'Veera Simham';

-- also fills in the top stat cards (lifetime totals, cities, occupancy)
update now_showing
set release_date = '2026-09-09',
    language = 'Telugu',
    genre = 'Action',
    lifetime_gross = '₹210.4 Cr',
    lifetime_tickets = '0.92 Cr',
    lifetime_shows = '1.1 L',
    cities = 480,
    lifetime_occupancy = 28.6
where title = 'Veera Simham';
