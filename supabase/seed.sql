-- Optional sample content so the site isn't empty while you build.
-- Run once in Supabase SQL Editor, same way you ran schema.sql.
-- Safe to skip or delete afterwards — everything here can also be edited/removed from /admin.

-- NEWS
insert into news (title, excerpt, content, category, date) values
('Director Siva Kartikeya locks next project',
 'The filmmaker confirms his next film goes on floors early next year with a fresh technical team.',
 'Director Siva Kartikeya has officially wrapped script work on his next feature and is set to begin filming in the new year. Sources close to the production say the film will be a family entertainer, a shift from his last two action-heavy outings.

Casting announcements are expected within the next few weeks, with the director hinting at "a few fresh faces alongside a familiar name."',
 'news', 'Sep 15, 2026'),
('Ashwamedham 2 crosses ₹250 Cr worldwide',
 'The sequel continues its strong run at the box office, now closing in on becoming the year''s biggest opener.',
 'Ashwamedham 2 has crossed the ₹250 crore mark worldwide in just over two weeks of release, trade analysts confirmed this week. The film has held remarkably well on weekdays, a trend usually reserved for word-of-mouth hits.

Distributors say the film is now on track to become one of the top five grossers of the year.',
 'boxoffice', 'Sep 14, 2026'),
('Prema Kaburu OTT rights sold for a record price',
 'A leading streaming platform has picked up digital rights just days after the film''s theatrical debut.',
 'In a rare move, the makers of Prema Kaburu have closed a streaming deal within a week of the film''s theatrical release, reportedly for one of the highest OTT prices this year for a mid-budget romance.

The film is expected to premiere on the platform six weeks after its theatrical run ends.',
 'ott', 'Sep 12, 2026'),
('First look: Nishabda''s haunting visual style',
 'New stills from the thriller reveal a stark, minimal color palette unlike anything the director has done before.',
 'A fresh set of stills from Nishabda has given audiences their first real look at the film''s visual language — muted tones, long shadows, and a deliberately quiet color palette that mirrors the story''s themes.

The cinematographer said the team "wanted the frame to feel like it was holding its breath."',
 'gallery', 'Sep 10, 2026'),
('Ganga Bhavani opens to solid numbers in overseas markets',
 'The period drama is outperforming pre-release estimates in the US and UK circuits.',
 'Ganga Bhavani has opened stronger than expected overseas, with early estimates placing it ahead of the director''s previous release at the same point in its run.

Trade trackers note that period dramas have had a mixed year, making this an encouraging signal for similar upcoming titles.',
 'boxoffice', 'Sep 8, 2026');

-- REVIEWS
insert into reviews (title, excerpt, content, rating, date) values
('Veera Simham',
 'A confident, well-mounted action drama that mostly earns its runtime.',
 'Veera Simham works best when it leans into its action set-pieces — the mid-film chase sequence in particular is a genuine highlight. The emotional beats land less consistently, occasionally slowing the film down in its second half.

Still, strong lead performances and sharp technical work make this an easy recommend for fans of the genre.',
 '4', 'Sep 16, 2026'),
('Ashwamedham 2',
 'A sequel that improves on the original in almost every way.',
 'Ashwamedham 2 is that rare sequel that expands its world without losing what made the first film work. The writing is tighter, the action more coherent, and the new additions to the cast bring real weight to the story.

It is, without question, one of the strongest releases of the year so far.',
 '5', 'Sep 14, 2026'),
('Prema Kaburu',
 'A gentle, well-written romance carried by its lead pair''s chemistry.',
 'Prema Kaburu doesn''t reinvent the romance genre, but it doesn''t need to — the writing is warm, the pacing unhurried, and the two leads share an easy chemistry that carries the film through its quieter stretches.

A pleasant watch that trusts its characters over spectacle.',
 '4', 'Sep 11, 2026'),
('Ganga Bhavani',
 'Visually rich but narratively uneven.',
 'Ganga Bhavani looks the part — the production design and cinematography are consistently strong — but the screenplay struggles to maintain momentum across its nearly three-hour runtime.

Worth watching for the craft on display, even if the story doesn''t always keep pace.',
 '3', 'Sep 9, 2026');

-- GALLERY
insert into gallery (caption) values
('Veera Simham — first day, first show celebrations'),
('Ashwamedham 2 — behind the scenes from the climax shoot'),
('Prema Kaburu — the leads at the trailer launch event'),
('Ganga Bhavani — costume test stills'),
('Nishabda — on set with the director'),
('Fan art from this week: Veera Simham tribute posters');

-- LIVE BOX OFFICE (inserted oldest-first so it sorts Veera Simham-first by created_at desc)
insert into live_box_office (title, sub, amt) values
('Nishabda', 'Day 2 · Worldwide', 12.3);
insert into live_box_office (title, sub, amt) values
('Ganga Bhavani', 'Day 5 · Worldwide', 61.9);
insert into live_box_office (title, sub, amt) values
('Ashwamedham 2', 'Day 16 · Worldwide', 288.1);
insert into live_box_office (title, sub, amt) values
('Prema Kaburu', 'Day 3 · Worldwide', 34.8);
insert into live_box_office (title, sub, amt) values
('Veera Simham', 'Day 9 · Worldwide', 210.4);

-- NOW SHOWING
insert into now_showing (title, status, amt) values
('Veera Simham', 'Blockbuster', '₹210 Cr'),
('Ashwamedham 2', 'Hit', '₹288 Cr'),
('Prema Kaburu', 'Hit', '₹35 Cr'),
('Ganga Bhavani', 'Average', '₹62 Cr'),
('Nishabda', 'New', '₹12 Cr');

-- UPCOMING
insert into upcoming (title, release_date) values
('Sammohanam 2', '2026-10-02'),
('Rakshasa Rajyam', '2026-10-24'),
('Chandamama Cinema', '2026-11-14'),
('Kondaveedu', '2026-12-05');
