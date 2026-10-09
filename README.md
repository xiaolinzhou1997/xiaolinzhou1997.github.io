# Xiaolin Zhou: job market website

Hugo site (theme: hugo-apero), deployed by Netlify to https://xiaolinzhou.netlify.app.
Build locally with `hugo server` (Hugo extended; tested with 0.105.0, which the deploys use, and 0.167.0).

## Where to edit

| What | File |
|---|---|
| Homepage text, fields, buttons, photo | `content/_index.md` |
| Papers (homepage JMP + Research page) | `data/research.yaml` |
| References and placement director | `data/references.yaml` |
| JMP and CV PDFs | `static/files/Zhou_JMP.pdf`, `static/files/Zhou_CV.pdf` (keep the names) |
| Headshot | add to `static/img/`, then point `images:` in `content/_index.md` to it |
| CV page, Teaching page | `content/cv.md`, `content/teaching.md` |
| About page | `content/about/main/index.md`, `content/about/sidebar/index.md` |
| Travel posts | one folder per trip in `content/travel/`, with `index.md` and photos |
| Menu, social icons (Scholar/SSRN/LinkedIn placeholders) | `config.toml` |
| Job Map data (AEA JOE postings) | `static/data/joe-postings.json`, built by `scripts/joe/build_joe.py` (see below) |

Placeholder text is in [square brackets]. Unfinished items are hidden from the site and listed in `TODO.md`.

## Updating the Job Map

**Automatic:** `.github/workflows/joe-update.yml` runs every day at 11:17 UTC. It downloads the
JOE XLS export, rebuilds `static/data/joe-postings.json`, and commits and republishes only when
the postings changed. If the download is not a spreadsheet (for example an error page) or has no
postings, the run fails, the map keeps its last good data, and GitHub emails you. To run it now:
**Actions → Update Job Map data → Run workflow**.

The export link is tied to one JOE issue (currently 2026-02). When JOE opens a new issue, copy
the new XLS link from https://www.aeaweb.org/joe/listings and save it as a repository variable
named `JOE_EXPORT_URL` (Settings → Secrets and variables → Actions → Variables), or replace the
link in the workflow file.

GitHub pauses scheduled workflows in public repos after 60 days without any commits. If the map
stops updating, re-enable the workflow on the Actions tab.

**Manual:**

1. On https://www.aeaweb.org/joe/listings, open **Download Options** and export the listings as **XLS**.
2. Run:

   ```
   pip install -r scripts/joe/requirements.txt
   python scripts/joe/build_joe.py ~/Downloads/joe_resultset.xlsx
   ```

3. The script rewrites `static/data/joe-postings.json` and lists any location it could only
   place at the state or country level. To pin one to a city, add the exact location line to
   `scripts/joe/overrides.json`, then rerun. New unresolved places also show in the
   automatic run's log.
4. Commit and push. Both sites rebuild.

The raw export is not committed. It contains the full text of every ad, and the map only
publishes basic fields with a link back to JOE.
