# Mastery artwork contract

Only `placeholder.svg` currently exists. It is a neutral geometric placeholder, not a final reward illustration. The 13-surah artwork table was absent from the supplied brief. No final artwork or religious narrative has been approved or claimed as generated.

Supply reviewed, local 4:3 WebP illustrations as `001.webp`, and `103.webp` through `114.webp`. Use consistent emerald, teal, gold, cream and midnight-blue storybook/geometric styling. No depictions of Allah, Prophets, angels or unseen beings; no physical object, light source or silhouette representing Allah. Do not embed generated Arabic lettering. Titles use the application's verified Arabic font separately.

Add a verified illustration description and artwork status in `src/mastery/masteryStories.js`. Check the supplied primary Ibn Kathir and al-Jalalayn passages, write a narrative under 200 words, record exact references and `checked: true` per source, and set `editorialStatus: 'verified'` only after the checks. The interface withholds stories until those conditions are met. Missing image files always fall back to the labeled placeholder.

## Requested master artwork

The following user-specified titles are mapped in the Gallery, but the image attachments have not been received:

| Surah | Artwork title | Destination |
| --- | --- | --- |
| Al-Fatihah (1) | Illuminated Path Through World | `001.webp` |
| An-Nas (114) | Golden Sanctuary Against the Shadows | `114.webp` |
| Al-Falaq (113) | Dawn Over the Shadow Valley | `113.webp` |

Use the exact supplied images when available; do not substitute generated artwork or label placeholder assets as final. Artwork availability is independent from source verification of tafsir narratives. The Poetic Tafsir tab intentionally has empty content slots until future poems are supplied.
