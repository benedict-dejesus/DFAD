# Setting up the DFAD backend (Google Sheets + Apps Script)

**DFAD — DCPA Faculty Advisers' Directory**
Built and developed by Benedict de Jesus

This is the complete walkthrough for the database side of DFAD. Follow it once
and the website has a working, editable backend, plus 50 access codes ready to
hand out.

**Time needed:** about 20 minutes.
**Account used:** `benedictdejesuslpt@gmail.com` — the Google Drive that will
hold the spreadsheet, the access codes and the faculty photos.

> **Before you start:** make sure you are signed in as
> `benedictdejesuslpt@gmail.com` and not another Google account. If you use
> several, do this in a private window to be certain. Whoever owns the
> spreadsheet owns the data and is the only one who can change the code later,
> and a sheet created under the wrong account cannot simply be moved
> afterwards without breaking the deployment.
>
> If DFAD is later handed to the department, transfer the spreadsheet **and**
> recreate the deployment under the department account, then update
> `BUILT_IN_API_BASE` in `assets/js/config.js`.

---

## What you are building

```
   STUDENTS                              FACULTY
   phones, no sign-in                    phones, access code
        │                                     │
        │  read only                          │  read + write
        ▼                                     ▼
   ┌─────────────────────────────────────────────────┐
   │        GitHub Pages — the DFAD website           │
   └─────────────────────────────────────────────────┘
                          │  HTTPS
                          ▼
              ┌───────────────────────┐
              │  Apps Script Web App  │   ← the only thing that
              └───────────────────────┘      touches the data
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      ┌───────────────┐      ┌─────────────────┐
      │ Google Sheet  │      │  Drive folder   │
      │  5 tabs       │      │  faculty photos │
      └───────────────┘      └─────────────────┘
```

**Only faculty ever use Apps Script.** Students never sign in, never send a
request that identifies them, and nothing about a student visit is recorded
anywhere. The database holds exactly three things:

1. **faculty access codes** (hashed) and what each one is allowed to do,
2. **faculty profile data**,
3. **schedule and availability updates** faculty make themselves.

---

## Step 1 — Create the spreadsheet

1. Signed in as `benedictdejesuslpt@gmail.com`, go to <https://sheets.new>
   (this creates a new blank spreadsheet in that Drive).
2. Rename it something obvious: **`DFAD — DCPA Faculty Advisers' Database`**.
   Click the title at the top-left to rename.
3. Leave the default `Sheet1` tab alone — the installer replaces it in step 4.

> Keep this spreadsheet **private**. Do not share it with "Anyone with the
> link". Nobody needs direct access: faculty use the website, and the Web App
> reads the sheet on their behalf.

---

## Step 2 — Open the script editor

In the spreadsheet, go to **Extensions ▸ Apps Script**.

A new tab opens with a project containing one file, `Code.gs`, with an empty
`myFunction()` in it.

> **Important:** open the editor *from the spreadsheet*, not from
> script.google.com. That makes the script "bound" to this spreadsheet, which
> is what lets it find the sheet automatically and adds the **DFAD** menu.

Rename the project (click **Untitled project** at the top): **`DFAD API`**.

---

## Step 3 — Paste in the code

You are copying three files from the `apps-script/` folder of this repository.

**3a. `Code.gs`**

- Select everything already in the editor's `Code.gs` and delete it.
- Open `apps-script/Code.gs` from this repo, copy all of it, paste it in.

**3b. `Lib.gs`**

- In the editor's left sidebar, click **＋** next to *Files* ▸ **Script**.
- Name it exactly `Lib` (the editor adds `.gs` itself).
- Paste in the contents of `apps-script/Lib.gs`.

**3c. `Setup.gs`**

- Add another script file, name it `Setup`.
- Paste in the contents of `apps-script/Setup.gs`.

**3d. Check the runtime (usually already correct)**

- Click the **⚙ Project Settings** icon in the left sidebar.
- Tick **"Show 'appsscript.json' manifest file in editor"**.
- Back in the **Editor**, open `appsscript.json` and make sure
  `"runtimeVersion": "V8"` is there. If your file differs, replace its whole
  contents with `apps-script/appsscript.json` from this repo.

Click **💾 Save project** (or `Ctrl`/`Cmd` + `S`).

---

## Step 4 — Run the installer

This creates the five tabs, the dropdowns, and your coordinator access code.

1. In the toolbar, choose **`setup`** from the function dropdown.
2. Click **▶ Run**.
3. Google asks for permission the first time:
   - **Review permissions** ▸ choose your account.
   - You will see **"Google hasn't verified this app"**. This is expected —
     *you* own this app; it is unverified simply because it was never submitted
     to Google for review.
   - Click **Advanced** ▸ **Go to DFAD API (unsafe)** ▸ **Allow**.
   - It asks to see and edit your spreadsheets **and your Drive files**. The
     Drive permission is what lets faculty upload profile photos — DFAD puts
     them in one folder it creates, called *DFAD — Faculty photos*.
4. Watch the **Execution log** at the bottom.

You will see something like:

```
DFAD — DCPA Faculty Advisers' Directory: setup complete.

Spreadsheet: DFAD — DCPA Faculty Advisers' Database
Tabs ready: Faculty, Consultations, Codes, Sessions, Settings

=====================================================
  COORDINATOR ACCESS CODE:  DFAD-4NMV-GFKA
  Copy it now — it is hashed and cannot be shown again.
=====================================================
```

### ⚠️ Copy that coordinator code now

Paste it somewhere safe (a password manager, or a sealed note). It is your
master key, and it is stored **hashed** — even you cannot read it back out of
the spreadsheet.

Lost it? No problem: run the `newCoordinatorCode` function to issue another.

Switch back to the spreadsheet. You should now see five tabs along the bottom:
**Faculty · Consultations · Codes · Sessions · Settings**.

---

## Step 5 — Prepare 50 adviser slots and their access codes

This is the step that makes onboarding painless. Instead of adding faculty one
at a time, you create the whole roster now and hand out codes as you meet
people.

1. In the script editor, choose **`prepareRoster50`** ▸ **▶ Run**.
   (Or, from the spreadsheet: **DFAD ▸ Prepare 50 adviser slots + codes**.)
2. It creates 50 blank rows on the **Faculty** tab with status `Pending`, and
   issues one access code for each.
3. A new tab appears: **Codes to hand out**.

```
 Slot │ Access code      │ Given to            │ Date given
 ─────┼──────────────────┼─────────────────────┼────────────
  01  │ DCPA-7FHK-92QX   │                     │
  02  │ DCPA-M3TW-XR4B   │                     │
  03  │ DCPA-QJ8N-K52V   │                     │
  …
```

### How a slot becomes a real profile

A `Pending` slot is **invisible to students**. Nothing shows up in the
directory until the faculty member signs in and saves their name — at that
moment the slot flips itself to `Active` and they appear.

So you can hand out all 50 codes today and let people claim them whenever they
get round to it. **Nothing lands back on your desk.**

### Handing them out

Fill in the *Given to* and *Date given* columns as you distribute, so you know
who holds which slot. When you are done:

**DFAD ▸ Delete hand-out sheet**

That removes the only place a readable code was ever written down. After that
the codes exist only where you wrote them and where each faculty member keeps
theirs. If someone loses one, issue a new one — you cannot look the old one up.

> **Why the codes avoid certain letters.** Access codes never contain
> **0**, **O**, **1**, **I** or **L**. Those are the characters people misread
> off a screen or a printed slip. Every code uses only the 31 characters that
> cannot be confused. Codes are also case-insensitive and the dashes are
> optional, so `dcpa7fhk92qx` works just as well as `DCPA-7FHK-92QX`.

---

## Step 6 — Add some sample data (optional)

So you have something to look at before real data goes in:

1. In the script editor, choose **`seedSampleData`** ▸ **▶ Run**.
2. It creates three clearly-labelled placeholder profiles with codes.

Delete those rows before you launch. They all say *"Placeholder profile created
by seedSampleData()"* in the bio, so they are easy to spot.

---

## Step 7 — Deploy the Web App

This is the step that turns your script into a URL the website can call.

1. Top right of the editor: **Deploy ▸ New deployment**.
2. Click the **⚙ gear** next to *Select type* and choose **Web app**.
3. Fill in:

   | Field | Value |
   |---|---|
   | **Description** | `DFAD v2` |
   | **Execute as** | **Me (benedictdejesuslpt@gmail.com)** |
   | **Who has access** | **Anyone** |

4. Click **Deploy**, approve access if prompted.
5. Copy the **Web app URL**. It looks like:

   ```
   https://script.google.com/macros/s/AKfycb.....................­/exec
   ```

### Both settings matter

- **Execute as: Me** — visitors do not need Google accounts. The script acts
  with your permission to touch your spreadsheet, and only through the specific
  actions the code allows.
- **Who has access: Anyone** — this is what makes the site work for students
  who are not signed in to Google. It does **not** make your spreadsheet
  public: everything goes through the API, which decides what to hand out.
  Writing anything requires a valid access code.

  If you pick "Anyone with a Google account" instead, students get bounced to a
  Google sign-in page and the site fails to load.

---

## Step 8 — Connect the website

Open `assets/js/config.js` in this repository and paste the URL:

```js
const BUILT_IN_API_BASE = 'https://script.google.com/macros/s/AKfycb....../exec';
```

Commit and push. GitHub Pages redeploys in a minute or two.

**Want to test before committing?** Open the live site, go to **About ▸
Connection settings**, paste the URL there and hit **Save & test**. That stores
it in your browser only — good for checking, but every other visitor still
needs the value committed into `config.js`.

---

## Step 9 — Verify

In the script editor, run **`selfTest`**:

```
PASS  spreadsheet reachable  → DFAD — DCPA Faculty Advisers' Database
PASS  tab "Faculty"  → 30 columns
PASS  tab "Consultations"  → 11 columns
PASS  tab "Codes"  → 9 columns
PASS  tab "Sessions"  → 6 columns
PASS  tab "Settings"  → 3 columns
PASS  script pepper set  → yes
PASS  meta endpoint  → DFAD — DCPA Faculty Advisers' Directory
PASS  directory endpoint  → 3 listed adviser(s)
PASS  roster prepared  → 50 unclaimed slot(s) waiting
PASS  coordinator code exists  → 1 active
PASS  code alphabet excludes look-alikes  → 31 safe characters
PASS  photo folder reachable  → DFAD — Faculty photos
PASS  time normalisation  → ok
```

Then open the website itself:

1. The directory lists your sample profiles. **No sign-in appears anywhere** —
   that is the student experience, and it is correct.
2. Go to **Faculty portal**, sign in with your coordinator code.
3. You land on the **Coordinator dashboard**, with 50 `Pending` slots listed.
4. Sign out, sign in with one of the hand-out codes: you get the **Faculty
   dashboard** with a welcome banner asking for a name.

---

## The two dashboards

|  | Students | Faculty |
|---|---|---|
| **Sign in** | Never | Access code |
| **Can see** | Listed profiles, expertise, schedules, availability, Facebook / LinkedIn buttons | Their own record in full |
| **Can change** | Nothing | Only their own profile, schedule and availability |
| **Recorded** | Nothing at all | Their profile edits |

The coordinator code unlocks a third view — roster management — but even a
coordinator does not fill in profiles. Faculty do that themselves.

---

## What a faculty member can do (so you do not have to)

When someone signs in with their code, they get four tabs:

- **Profile** — upload a photo straight from their phone (DFAD crops it square
  and shrinks it before it ever leaves the browser), plus name, rank,
  department, programmes, fields of expertise, a short bio, Facebook, LinkedIn,
  a personal page, and contact details with a visibility switch on the email
  and the phone separately.
- **Thesis tasks** — switch on the tasks they can handle: **Thesis Adviser**,
  **Critic**, **Thesis Consultant**, **Media Expert**. Each one that is on can
  be marked *Open* or *Limited*. This is what students filter by.
- **Schedule** — weekly consultation slots with day, time, mode (face-to-face,
  online, hybrid), venue and a note. Overlapping slots are rejected.
- **Account** — replace their own access code, or remove themselves from the
  directory.

A completeness meter at the top nudges them toward filling the gaps. Nothing
requires the administrator.

---

## Day-to-day

### Someone new joins the department

Hand them the next unused code from the hand-out sheet. That is the whole
process. They sign in, save their name, and they are listed.

If you have run out of prepared slots, run `prepareRoster(10)` for ten more, or
use **DFAD ▸ Prepare 50 adviser slots + codes** again.

### Someone loses their code

**DFAD ▸ Issue code for selected row** — click their row on the Faculty tab
first. The old code stops working immediately.

Or, from the coordinator dashboard on the website: open the record ▸ **Issue
new code**.

### Someone leaves

Open their record from the coordinator dashboard and set the status to
**Archived**, or use **DFAD ▸ Revoke codes for selected row** to sign them out
and block their code without touching the record.

### Sending someone their code

Send it the way you would a temporary password — a direct message, not a group
chat. Tell them they can replace it themselves from **Account ▸ Replace my
access code** once they are in.

---

## The tabs, briefly

| Tab | What it holds | Safe to edit by hand? |
|---|---|---|
| **Faculty** | One row per adviser: name, rank, expertise, bio, photo, socials, contacts, thesis tasks | Yes — dropdowns guide you |
| **Consultations** | One row per weekly slot, linked by `faculty_id` | Yes, carefully |
| **Codes** | Hashed access codes. No readable code is ever stored | Only to set `status` to `revoked` |
| **Sessions** | Who is currently signed in. Self-cleaning | Leave alone |
| **Settings** | Site title, announcement banner, current term, leadership and developer credits | Yes |

The **Settings** tab also carries the names shown in the footer and on the
About page. Officers change, so these are settings rather than hard-coded text
— edit them here or from **Coordinator dashboard ▸ Site settings**:

| Key | Default |
|---|---|
| `dean` | Dr. Lois Ruth B. Villavicencio |
| `dean_title` | Dean, College of Arts and Letters |
| `chair` | Mr. Marlon B. Santos |
| `chair_title` | Chairperson, Department of Communication and Performing Arts |
| `proponent` | Mr. Joshua Nicdao |
| `proponent_title` | Proponent — originated the idea for DFAD |
| `author` | Benedict de Jesus |

There is deliberately **no activity log**. Students are not tracked, so there
is nothing to log about them.

A few columns worth knowing:

- **`status`**: `Pending` (code issued, unclaimed, invisible), `Active`
  (public), `Hidden` (temporarily off the directory, can still sign in),
  `Archived` (kept for records only).
- **`slot_no`**: the roster number from the hand-out sheet, so you can match a
  row to the code you gave out.
- **`show_email` / `show_phone`**: each faculty member's own choice about what
  students see. Do not override these without asking them.
- **`role_adviser` / `role_critic` / `role_consultant` / `role_media`**:
  `Open`, `Limited` or `Closed`.
- **`programs`** and **`expertise`**: semicolon-separated lists —
  `Broadcast production; Media ethics`.
- **`facebook` / `linkedin` / `website`**: full profile URLs. Faculty can type
  a bare username in the portal and DFAD expands it; if you type in the sheet
  by hand, paste the whole link.
- **`photo` / `photo_file_id`**: written by the uploader. Leave them alone —
  editing `photo` by hand is fine if you want to point at an existing image
  URL, but `photo_file_id` is how DFAD cleans up replaced photos in Drive.

---

## Updating the code later

When you change anything in the `.gs` files, the live site keeps using the old
version until you redeploy:

**Deploy ▸ Manage deployments ▸ ✏️ edit ▸ Version: New version ▸ Deploy**

This keeps the **same URL**, so you do not have to touch `config.js` again.

> Creating a *new deployment* instead gives you a *new URL* and leaves the old
> one running. That is occasionally useful for testing, but for normal updates
> always use **Manage deployments ▸ New version**.

---

## Troubleshooting

**"This site is not connected to its database yet."**
`config.js` still has an empty `BUILT_IN_API_BASE`, or the URL does not end in
`/exec`. A `/dev` URL only works for you while signed in — always use `/exec`.

**The directory is empty but the sheet has rows.**
Check the `status` column says exactly `Active`, and that each row has both an
`id` and a `name`. `Pending` rows are hidden on purpose. Rows typed in by hand
without an id are skipped — use **DFAD ▸ Issue code for selected row**, which
fills the id in for you.

**"That access code was not recognised."**
Case and dashes do not matter, so that is not it. Check the **Codes** tab: the
row's `status` must be `active`. If someone rotated their code, older ones read
`revoked` and will never work again.

**Photo upload fails.**
The first upload creates the Drive folder and may need the Drive permission you
approved in step 4. If you skipped it, run `setup` again and re-approve. Very
large images are resized in the browser first, so size is rarely the problem.

**Everything worked, then stopped after I edited the script.**
You edited the code but did not redeploy. See *Updating the code later*.

**"Sorry, unable to open the file at this time."**
You are signed in to more than one Google account and the browser picked the
wrong one. Open the URL in a private window, or set your default account.

**Changes are not showing on the website.**
The directory is cached in the browser for five minutes. Pull to refresh, or
wait it out. Faculty always see their own changes immediately.

**"Too many sign-in attempts."**
The API blocks repeated wrong codes for 15 minutes. Wait, or issue a fresh code
from the spreadsheet menu.

---

## What the security actually is (and is not)

Being straight about this matters, because real people's contact details are in
here.

**What is protected:**

- Access codes are never stored. The sheet holds a SHA-256 hash of
  `salt : code : pepper`, and the pepper lives in Script Properties — *outside*
  the spreadsheet. A leaked copy of the sheet does not yield working codes.
- Sessions expire after 12 hours; expired ones are deleted automatically.
- Repeated wrong codes are rate-limited.
- Faculty can only edit their own row and their own slots. The server checks
  ownership on every write; it does not trust anything the page sends.
- Facebook and LinkedIn fields only accept real Facebook and LinkedIn URLs, so
  a profile cannot be turned into a link to somewhere else.
- Everything a user types is length-limited and stripped of control characters
  before it reaches the sheet, and escaped again before it is displayed.
- Students send nothing identifying, and nothing about them is stored.

**What this is not:**

- An access code is a *shared secret*, like a door key. Anyone holding it can
  edit that profile. It is not a password with a second factor.
- The hand-out sheet is the one moment readable codes exist in the
  spreadsheet. Delete it once you have distributed them.
- Anyone with the Web App URL can read the public directory. That is the
  point — but it means anything marked visible is genuinely public, indexable
  and copyable. This is why `show_email` and `show_phone` exist, and why
  `show_phone` is off by default.
- Uploaded photos live in a Drive folder shared as "anyone with the link". That
  is what makes them display on the site; treat them as public images.
- Deleting a record from the coordinator dashboard is permanent — use
  **Archived** if you might want it back.

**Sensible practice:** hand out codes individually rather than posting one in a
group chat, revoke codes when someone leaves the department, delete the
hand-out sheet once distribution is done, and keep the spreadsheet private.

---

*DFAD — DCPA Faculty Advisers' Directory. Proposed by Mr. Joshua Nicdao.
Designed, developed and documented by Benedict de Jesus for the Department of Communication and Performing Arts,
College of Arts and Letters, Bulacan State University.*
