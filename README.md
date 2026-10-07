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

Placeholder text is in [square brackets]. Unfinished items are hidden from the site and listed in `TODO.md`.
