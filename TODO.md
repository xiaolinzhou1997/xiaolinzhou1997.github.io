# Website to-do list

Content that is hidden from the site until it is ready. When you finish an item,
un-hide it as described and delete it from this list.

| # | What | Where it goes | How to show it |
|---|------|---------------|----------------|
| 1 | Professional headshot | `static/img/` (e.g. `headshot.jpg`) | Uncomment `images:` in `content/_index.md` and point it at the file |
| 2 | First travel post | `content/travel/<trip-name>/index.md` (see the sample in `content/travel/placeholder-trip/`) | Set `draft: false`; uncomment the Travel menu item in `config.toml`; optionally re-add a travel link to `content/about/main/index.md` |
| 3 | Abstracts for the two working papers (optional) | `abstract:` fields in `data/research.yaml` | Shows automatically as an expandable "Abstract" |
| 4 | JMP slides (optional) | `static/files/Zhou_JMP_slides.pdf` | Uncomment the Slides link under `jmp` in `data/research.yaml` |
| 5 | Google Scholar / SSRN / LinkedIn profiles (optional) | `config.toml` → `[[params.social]]` | Uncomment each block and add your profile URL |

Tip: `hugo server -D` shows draft content locally, so you can preview hidden items.
