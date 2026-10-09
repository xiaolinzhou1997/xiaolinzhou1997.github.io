# Xiaolin Zhou: job market website

Hugo site (theme: hugo-apero), deployed by Netlify to https://xiaolinzhou.netlify.app.
Build locally with Hugo 0.105.0 extended: `hugo server`.

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

1. On https://www.aeaweb.org/joe/listings, open **Download Options** and export the listings as **XLS**.
2. Run:

   ```
   pip install -r scripts/joe/requirements.txt
   python scripts/joe/build_joe.py ~/Downloads/joe_resultset.xlsx
   ```

3. The script rewrites `static/data/joe-postings.json` and lists any location it could only
   place at the state or country level. To pin one to a city, add the exact location line to
   `scripts/joe/overrides.json`, then rerun.
4. Commit and push. Both sites rebuild.

The raw export is not committed. It contains the full text of every ad, and the map only
publishes basic fields with a link back to JOE.
