CURATERS — COASTAL BOOKING REDESIGN (PREVIEW)

Files (same page structure as before):
- index.html          Day Trips
- private.html        Private Trips
- group-trips.html    Group Trips
- hosted-trips.html   Hosted Trips
- curaters-preview.css  shared design (colors, layout, animation)
- curaters-preview.js   NEW: the interactive layer (no build step)
- assets/images/        logos + trip photos (extracted from the old Base64)
- assets/video/         "Ghana @ 70" clip (extracted, converted to MP4)

WHAT'S NEW
- Sticky nav with category tabs + a "Saved" trips counter
- Hero with a booking search bar: destination, date, guests (filters live)
- Filter chips, sort, budget slider, saved-only toggle, grid/list view
- Heart to save trips (remembered in the browser), saved drawer with estimated total
- "Quick book" pop-up: date, guest stepper, live price estimate, reserve
- Private page: key field with show/hide, shake on submit, locked teasers,
  and a trip-planner that builds a ready-to-send email to the curators
- Newsletter box, back-to-top, scroll progress bar, 3D card tilt, hover video preview
- Each category has its own color theme

TO TEST: unzip, open index.html in a browser. Works on phone and desktop.
Keyboard: press "/" to jump to search, Esc closes pop-ups.

NOTES
- Still a design preview: no PHP backend. The private key is not checked,
  the newsletter is not sent, and "Reserve" hands off to the live Curaters
  trip page. Estimated totals are price x guests.
- Needs internet for fonts and the SweetAlert2 / Tailwind scripts from the original.
- The "Ghana @ 70" description was "PENDING"; the preview shows "details coming soon".
