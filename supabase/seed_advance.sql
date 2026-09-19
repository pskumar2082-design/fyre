-- Sample "Advance booking" data for Veera Simham, so the new Advance/Tracked
-- toggle on /now-showing/[id] has something to show on both sides right
-- away instead of only the Tracked (post-release) numbers from
-- seed_breakdown.sql. Run AFTER migration_advance.sql, and after seed.sql
-- (Veera Simham must already exist in now_showing).

-- STATE WISE, advance booking snapshot from 2026-09-05 (four days before release)
insert into box_office_breakdown (movie_id, kind, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'advance', 'state', 'Telangana', '2026-09-05', 0.62, 410, 19800, 55, 8, 21.4 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, kind, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'advance', 'state', 'Andhra Pradesh', '2026-09-05', 0.54, 380, 17250, 49, 6, 19.8 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, kind, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'advance', 'state', 'Karnataka', '2026-09-05', 0.21, 140, 6100, 22, 1, 15.6 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, kind, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'advance', 'state', 'Maharashtra', '2026-09-05', 0.14, 96, 3900, 14, 0, 13.2 from now_showing where title = 'Veera Simham';

-- LANGUAGE WISE
insert into box_office_breakdown (movie_id, kind, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'advance', 'language', 'Telugu', '2026-09-05', 1.38, 920, 41300, 130, 14, 20.9 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, kind, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'advance', 'language', 'Hindi (dubbed)', '2026-09-05', 0.13, 106, 5750, 16, 1, 12.4 from now_showing where title = 'Veera Simham';

-- FORMAT WISE
insert into box_office_breakdown (movie_id, kind, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'advance', 'format', '2D', '2026-09-05', 1.21, 980, 44100, 138, 12, 18.7 from now_showing where title = 'Veera Simham';
insert into box_office_breakdown (movie_id, kind, breakdown_type, label, day_date, gross, shows, tickets_sold, ff, sold_out, occ_pct)
select id, 'advance', 'format', 'IMAX', '2026-09-05', 0.30, 46, 2950, 8, 3, 26.5 from now_showing where title = 'Veera Simham';

-- fills in the advance stat cards at the top of the page
update now_showing
set advance_gross = '₹1.51 Cr',
    advance_tickets = '0.51 L',
    advance_shows = '1.03 K',
    advance_cities = 260,
    advance_occupancy = 18.9
where title = 'Veera Simham';
