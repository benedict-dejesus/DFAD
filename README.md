# DAD — DCPA Advisers' Directory

A mobile-first, interactive directory of advisers for the **Department of
Communication and Performing Arts (DCPA)**, College of Arts and Letters,
Bulacan State University.

*Designed, developed and maintained by **Benedict de Jesus**.*

Students taking **BA Broadcasting**, **BA Journalism** and the **Bachelor in
Performing Arts** can find DCPA faculty and guest faculty from across CAL —
their expertise, consultation hours, contact details, Facebook and LinkedIn,
and which thesis tasks they are currently taking on: **Thesis Adviser**,
**Critic**, **Thesis Consultant** or **Media Expert**.

Faculty members keep their own entries current. They sign in with an access
code and edit their profile, photo, schedule and availability themselves — no
forms to submit, nobody to wait for, and nothing that lands back on the
administrator's desk.

---

## Two audiences, two dashboards

|  | **Students** | **Faculty** |
|---|---|---|
| Sign-in | None, ever | Access code |
| Access | **View only** | Edit their own record |
| Can do | Browse, search, filter, read profiles and schedules, tap through to Facebook / LinkedIn, export consultation hours to their calendar | Photo, profile, thesis tasks, consultation schedule, contact visibility, replace their own code |
| Recorded | **Nothing at all** | Their own profile edits |

A coordinator code unlocks a third view for roster management. Even then, the
coordinator never fills in profiles — faculty do that themselves.

---

## How it is built

| Layer | Technology | Why |
|---|---|---|
| Site | Static HTML + CSS + ES modules, no build step | GitHub Pages serves it as-is; nothing to compile, nothing to break at deploy time |
| Data | Google Sheet (5 tabs) | The department can read and fix the data without a developer |
| Photos | Google Drive folder | Uploaded by faculty, cropped and shrunk in the browser first |
| API | Google Apps Script Web App | Free, owned by the department's own Google account, no server to maintain |

No framework, no dependencies to keep updated. Total payload is around 100 KB,
which matters on campus wifi and prepaid data.

**The database holds exactly three things:** faculty access codes and their
permissions, faculty profile data, and the schedule and availability updates
faculty make themselves. There is no activity log, because students are never
tracked in the first place.

---

## Setting up the Google Sheets database

The whole database lives in one Google Sheet in **your own Google Drive**
(`benedictdejesuslpt@gmail.com`). Nothing is hosted anywhere else and no
third-party service is involved: GitHub Pages serves the static site, and that
site talks to a Google Apps Script Web App that only you own.

**Time needed:** about 20 minutes, once.

> [`apps-script/GUIDE.md`](apps-script/GUIDE.md) is the long-form version of
> this, with screenshots-in-words, troubleshooting and day-to-day operations.
> The steps below are the complete path from nothing to a working site.

### Step 1 — Sign in as the account that will own the data

Open <https://drive.google.com> and make sure you are signed in as
**`benedictdejesuslpt@gmail.com`**.

This matters more than it looks. Whoever owns the spreadsheet owns:

- every faculty profile and consultation schedule,
- the hashed access codes,
- the Drive folder of uploaded faculty photos,
- the ability to change the code later.

If you are signed in to several Google accounts, do this in a private window to
be certain which one you are using — a spreadsheet created under the wrong
account cannot simply be moved later without breaking the deployment.

### Step 2 — Create the spreadsheet

1. Go to <https://sheets.new>. A blank spreadsheet opens in your Drive.
2. Click the title at the top-left and rename it
   **`DAD — DCPA Advisers' Database`**.
3. Leave `Sheet1` alone — the installer replaces it in step 5.

Keep this spreadsheet **private**. Do not share it with "Anyone with the link".
Faculty never touch the sheet directly; they use the website, and the Web App
reads and writes on their behalf.

### Step 3 — Open the script editor

In the spreadsheet: **Extensions ▸ Apps Script**.

Open it *from the spreadsheet*, not from script.google.com — that binds the
script to this sheet, which is what lets it find the data automatically and
adds the **DAD** menu to the spreadsheet toolbar.

Rename the project (click *Untitled project*) to **`DAD API`**.

### Step 4 — Paste in the three script files

From the `apps-script/` folder of this repository:

| Editor file | Paste in | How |
|---|---|---|
| `Code.gs` | [`apps-script/Code.gs`](apps-script/Code.gs) | Select all the existing contents, delete, paste |
| `Lib.gs` | [`apps-script/Lib.gs`](apps-script/Lib.gs) | **＋** next to *Files* ▸ **Script** ▸ name it `Lib` |
| `Setup.gs` | [`apps-script/Setup.gs`](apps-script/Setup.gs) | **＋** ▸ **Script** ▸ name it `Setup` |

Then check the runtime: **⚙ Project Settings** ▸ tick *Show 'appsscript.json'
manifest file in editor*, go back to the editor, open `appsscript.json` and
confirm `"runtimeVersion": "V8"`. If it differs, replace the file with
[`apps-script/appsscript.json`](apps-script/appsscript.json).

Save (`Ctrl`/`Cmd` + `S`).

### Step 5 — Run the installer

Choose **`setup`** in the function dropdown and click **▶ Run**.

Google will ask for permission the first time:

1. **Review permissions** ▸ choose `benedictdejesuslpt@gmail.com`.
2. You will see *"Google hasn't verified this app"*. That is expected — you own
   this script; it is unverified only because it was never submitted to Google
   for review.
3. **Advanced** ▸ **Go to DAD API (unsafe)** ▸ **Allow**.

It asks for access to your spreadsheets **and your Drive files**. The Drive
permission is what lets faculty upload profile photos — the script creates one
folder, *DAD — Faculty photos*, and uses only that.

The execution log prints your **coordinator access code**:

```
=====================================================
  COORDINATOR ACCESS CODE:  DAD-7FHK-92QX
  Copy it now — it is hashed and cannot be shown again.
=====================================================
```

**Copy it somewhere safe now.** It is stored hashed; not even you can read it
back out of the spreadsheet. (Lost it? Run `newCoordinatorCode` for a new one.)

Back in the spreadsheet you should now see five tabs: **Faculty ·
Consultations · Codes · Sessions · Settings**.

### Step 6 — Create the 50 adviser slots and their codes

Run **`prepareRoster50`** (or use **DAD ▸ Prepare 50 adviser slots + codes**
from the spreadsheet menu).

This creates 50 blank `Pending` rows and issues one access code for each, then
writes them to a temporary **Codes to hand out** tab with *Given to* and *Date
given* columns for you to fill in as you distribute them.

A `Pending` slot is invisible to students until the faculty member signs in and
saves their name — at that moment it lists itself. So all 50 codes can go out
now and be claimed whenever people get round to it.

When distribution is done: **DAD ▸ Delete hand-out sheet**. That removes the
only place readable codes were ever written down.

*(Optional: run `seedSampleData` for three clearly-labelled placeholder
profiles so the site has something to show while you set it up. Delete those
rows before launch.)*

### Step 7 — Deploy the Web App

1. Top right of the editor: **Deploy ▸ New deployment**.
2. **⚙** next to *Select type* ▸ **Web app**.
3. Fill in:

   | Field | Value |
   |---|---|
   | Description | `DAD v2` |
   | **Execute as** | **Me (benedictdejesuslpt@gmail.com)** |
   | **Who has access** | **Anyone** |

4. **Deploy**, approve if prompted, then copy the **Web app URL** — it ends in
   `/exec`.

Both settings matter:

- **Execute as: Me** — students do not need Google accounts. The script acts
  with your permission on your spreadsheet, and only through the specific
  actions the code allows.
- **Who has access: Anyone** — this is what lets students who are not signed in
  to Google load the directory. It does *not* make your spreadsheet public;
  everything goes through the API, and every write still requires a valid
  access code. Choosing "Anyone with a Google account" instead will bounce
  students to a sign-in page and the site will fail to load.

### Step 8 — Connect the site to your database

Paste the URL into [`assets/js/config.js`](assets/js/config.js):

```js
const BUILT_IN_API_BASE = 'https://script.google.com/macros/s/AKfycb…/exec';
```

Commit and push.

To test before committing, open the live site ▸ **About ▸ Connection
settings**, paste the URL and press **Save & test**. That stores it in your
browser only — every other visitor still needs the value committed here.

### Step 9 — Publish the site

On GitHub: **Settings ▸ Pages ▸ Source: Deploy from a branch ▸ `main` /
`(root)`**.

The site appears at `https://<your-username>.github.io/<repo>/` within a minute
or two.

### Step 10 — Verify

In the script editor, run **`selfTest`**. Every line should read `PASS`:

```
PASS  spreadsheet reachable  → DAD — DCPA Advisers' Database
PASS  tab "Faculty"  → 30 columns
PASS  directory endpoint  → 3 listed adviser(s)
PASS  roster prepared  → 50 unclaimed slot(s) waiting
PASS  coordinator code exists  → 1 active
PASS  code alphabet excludes look-alikes  → 31 safe characters
PASS  photo folder reachable  → DAD — Faculty photos
```

Then on the site itself: the directory loads with no sign-in anywhere (that is
the student experience), and **Faculty portal** + your coordinator code takes
you to the Coordinator dashboard.

### Later: updating the script

When you edit any `.gs` file, the live site keeps running the old version until
you redeploy:

**Deploy ▸ Manage deployments ▸ ✏️ edit ▸ Version: New version ▸ Deploy**

This keeps the same URL, so `config.js` never needs touching again. Creating a
*new deployment* instead would give you a new URL and leave the old one
running.

### A note on account ownership

Because everything sits in `benedictdejesuslpt@gmail.com`, the directory
depends on that account staying available. If DAD is ever handed over to the
department, the clean way to do it is to transfer ownership of the spreadsheet
*and* recreate the deployment under the department's account, then update
`BUILT_IN_API_BASE`. Worth planning for before it becomes urgent.

---

## Preview it without any of that

```bash
npx serve -l 4321 .
```

Then open **<http://localhost:4321/?mock>**.

The `?mock` flag loads [`dev/mock.js`](dev/mock.js), an in-browser stand-in for
the API with sample advisers. Everything works — search, filters, photo upload,
the faculty dashboard, the coordinator dashboard — against data that lives only
in memory. Nothing is loaded unless that flag is present.

Sample codes for the mock:

| Code | Signs in as |
|---|---|
| `DCPA-TEST-2345` | A faculty member with a filled-in profile |
| `DCPA-NEW-7788` | An unclaimed slot, to see the first-time experience |
| `DAD-HEAD-2345` | The coordinator |

---

## The 50-slot roster

Running `prepareRoster50()` once creates 50 blank adviser slots and issues an
access code for each, then writes them to a temporary **Codes to hand out**
tab.

A slot stays **invisible to students** until the faculty member signs in and
saves their name — at that moment it lists itself. So all 50 codes can be
handed out on day one and claimed whenever people get round to it.

**Access codes never contain `0`, `O`, `1`, `I` or `L`.** Those are the
characters people misread off a screen or a printed slip; every code uses only
the 31 that cannot be confused. Codes are also case-insensitive and the dashes
are optional.

---

## Project layout

```
index.html               Application shell
404.html                 Bounces stray paths back to the app
humans.txt               Authorship
manifest.webmanifest     Installable-to-homescreen metadata

assets/css/
  tokens.css             Colours, type, spacing, motion — rebrand here
  layout.css             Reset, shell, responsive frame
  components.css         Buttons, cards, sheets, forms, task picker, toasts

assets/js/
  app.js                 Bootstrap: routing, theme, chrome
  router.js              Hash router with history-depth tracking
  store.js               Observable state, filters, derived data
  api.js                 Apps Script client (CORS-safe, cached, JSONP fallback)
  util.js                Safe templating, DOM helpers, formatting
  ui.js                  Toasts, bottom sheets, confirmations, icons
  ics.js                 Calendar export
  config.js              ← the one file you must edit
  views/
    home.js              Student dashboard — the advisers' directory
    faculty.js           Adviser profile sheet (read-only, social actions)
    schedules.js         Department-wide consultation hours
    portal.js            Faculty dashboard — the only place data is written
    admin.js             Coordinator dashboard — roster management
    about.js             About, FAQ, credits, connection settings

apps-script/
  GUIDE.md               ← the setup walkthrough
  Code.gs                HTTP entry points and API actions
  Lib.gs                 Storage, auth, validation
  Setup.gs               Installer, roster preparation, menu, self-test

assets/img/
  CAL_logo.png           Source seal, College of Arts and Letters
  DCPA_logo.png          Source seal, Department of Communication & Performing Arts
  cal-logo.png           192px derivative — what the site actually loads
  dcpa-logo.png          192px derivative
  favicon.svg            Tab icon (a seal is unreadable at 16px)

dev/mock.js              Offline sample API (loaded only with ?mock)
dev/validators.test.js   Tests for the Apps Script validation layer
dev/resize-logos.js      Regenerates the small logo derivatives
```

### Logos

The site displays the official **CAL** and **DCPA** seals. The full-resolution
sources are 483 KB together — more than the entire rest of the site — so
[`dev/resize-logos.js`](dev/resize-logos.js) produces the 192px versions the
interface loads (129 KB, 73% smaller). Re-run it if either seal is replaced:

```bash
node dev/resize-logos.js
```

It has no dependencies — Node's built-in zlib handles the PNG, and the
resampling is alpha-weighted so the transparent edges stay clean.

Both seals are detailed marks with transparent backgrounds, and DCPA's is dark
green, so on any dark surface they are placed on a light tile
(`.seal--plated`, or `.seal--adaptive` which switches with the theme). They are
never rendered below ~28px, which is where the ring lettering stops resolving.

Run the backend validator tests any time you edit `apps-script/Lib.gs`
(no dependencies, no Google account needed):

```bash
node dev/validators.test.js
```

They cover the code alphabet, hashing, social-URL parsing, slot validation and
the permission boundary between what faculty and coordinators may change.

---

## Rebranding

Every colour is a custom property in
[`assets/css/tokens.css`](assets/css/tokens.css). Change `--brand-*` and
`--accent-*` and the whole site follows, including dark mode.

The palette ships as **CAL green with an academic gold accent**.

---

## Notes on design decisions

**Why hash routing?** GitHub Pages has no server-side rewrites. Hash URLs mean
`#/faculty/fac_abc123` survives a refresh and can be shared, with no redirect
tricks.

**Why `text/plain` on POST?** Apps Script cannot answer a CORS preflight.
Sending JSON with a `text/plain` content type keeps the request "simple", so the
browser never asks for one. Public reads also have a JSONP fallback for
networks that break Apps Script's cross-origin redirect.

**Why are access codes hashed?** So that a leaked copy of the spreadsheet —
the most likely accident — does not hand over working credentials. The salt sits
next to the hash, but the pepper lives in Script Properties, outside the sheet.

**Why is the photo resized in the browser?** A phone photo is 3–5 MB. Cropping
it square and shrinking it to 600 px before upload means ~50 KB crosses the
wire, Apps Script never has to process an image, and the faculty member on a
prepaid connection is not punished for having a good camera.

**Why a switch-plus-level task picker instead of four dropdowns?** Because
"which of these can you handle?" is the question faculty are actually
answering. Four `Open / Limited / Closed` selects made them read the same
three words four times. Now they flip a switch, and refine to *Limited* only
if it matters.

**Why does the client escape everything?** Faculty type their own bios. Those
strings go through a spreadsheet and come back as HTML, so every interpolation
in `util.js`'s `html` template is escaped by default, and every URL passes
through `safeUrl()`.

For an honest account of what the access-code model does and does not protect,
see the last section of [`apps-script/GUIDE.md`](apps-script/GUIDE.md).

---

## Accessibility

Keyboard-navigable throughout, with focus trapped in dialogs and restored on
close. Colour is never the only signal — availability states carry text labels
as well as colour. No nested interactive controls, every field is labelled, and
touch targets meet minimum sizing on coarse pointers. Respects
`prefers-reduced-motion` and `prefers-color-scheme`.

---

## Credits

**DAD — DCPA Advisers' Directory** was designed, built, documented and is
maintained solely by **Benedict de Jesus** — architecture, interface, database
design and this documentation.

DAD is a personal gift to the Department of Communication and Performing Arts,
College of Arts and Letters, Bulacan State University: built so that resource
persons for thesis work — advisers, consultants, critics and media experts —
are findable by the students who need them, and so that keeping the directory
accurate never becomes anyone's second job.

### College and Department leadership

DAD serves the Department under the leadership of:

- **Dr. Lois Ruth B. Villavicencio** — Dean, College of Arts and Letters
- **Mr. Marlon B. Santos** — Chairperson, Department of Communication and
  Performing Arts

These names appear in the site footer and on the About page. Because officers
change, they are stored as settings (`dean`, `dean_title`, `chair`,
`chair_title`) rather than hard-coded, and can be updated from **Coordinator
dashboard ▸ Site settings** or the **Settings** tab of the spreadsheet — no
code change needed. The developer credit (`author`) works the same way.
