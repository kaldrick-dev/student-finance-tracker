# Student Finance Tracker

## Theme
Student Finance Tracker (Summative Assignment)

## Live Pages
- App: `index.html`
- Validation tests: `tests.html`
- GitHub Pages: <!-- TODO: Replace with your GitHub Pages URL, e.g. https://YOUR-USERNAME.github.io/REPO-NAME/ -->
- Demo Video: <!-- TODO: Replace with your unlisted demo video link -->

## Features
- Semantic layout with landmarks (`header`, `nav`, `main`, `section`, `footer`)
- Mobile-first responsive design with breakpoints at ~360px, 768px, 1024px
- Add/edit/delete finance transactions with timestamps and unique IDs
- Inline edit in desktop table rows + form-based edit
- Regex validation for description, amount, date, category
- Advanced regex rule to reject duplicate consecutive words
- Live regex search with safe compiler (`try/catch`) and case-insensitive toggle
- Highlighted regex matches with `<mark>`
- Sorting by date, description, amount
- Dashboard stats: total records, total amount, top category, last-7-day chart
- Budget cap with ARIA live updates (polite under cap, assertive when over)
- localStorage persistence for records/settings
- JSON export/import with shape validation
- Currency settings with base currency + two others (manual rates)

## Regex Catalog
- Description trim/no edge spaces: `^\S(?:.*\S)?$`
- Amount: `^(0|[1-9]\d*)(\.\d{1,2})?$`
- Date: `^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$`
- Category: `^[A-Za-z]+(?:[ -][A-Za-z]+)*$`
- Advanced duplicate-word detection: `\b(\w+)\s+\1\b`
- Search examples:
  - Cents only: `\.\d{2}\b`
  - Beverage keyword: `(coffee|tea)`
  - Duplicate words: `\b(\w+)\s+\1\b`

## Keyboard Map
- `Tab` / `Shift+Tab`: move through all controls
- `Enter`: submit focused form button
- `Space`: toggle checkbox controls
- Skip link (`Tab` from top) jumps directly to main content

## Accessibility Notes
- Visible focus style on interactive elements
- `aria-live` status areas for form/search/settings updates
- Cap feedback toggles between polite/assertive urgency
- Labels are explicitly bound to all form controls
- Mobile cards and desktop table maintain keyboard-operable actions

## How to Run
1. Open `index.html` in your browser.
2. Use `seed.json` via Import JSON to load sample records.
3. Open `tests.html` to view simple validator/regex assertions.

## Milestone Mapping (M1-M7)
- M1: Theme selected, data model and a11y considerations documented
- M2: Semantic HTML and responsive CSS complete
- M3: Regex validation + tests in `tests.html`
- M4: Render/sort/search/highlight implemented
- M5: Stats, cap logic, trend chart + ARIA live updates
- M6: Persistence + JSON import/export + currency/settings
- M7: UI polish, animation, README completion
