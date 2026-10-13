# Mastery artwork contract

Only `placeholder.svg` currently exists. It is a neutral geometric placeholder, not a final reward illustration. The 13-surah artwork table was absent from the supplied brief. No final artwork or religious narrative has been approved or claimed as generated.

Supply reviewed, local 4:3 WebP illustrations as `001.webp`, and `103.webp` through `114.webp`. Use consistent emerald, teal, gold, cream and midnight-blue storybook/geometric styling. No depictions of Allah, Prophets, angels or unseen beings; no physical object, light source or silhouette representing Allah. Do not embed generated Arabic lettering. Titles use the application's verified Arabic font separately.

Add a verified illustration description and artwork status in `src/mastery/masteryStories.js`. Check the supplied primary Ibn Kathir and al-Jalalayn passages, write a narrative under 200 words, record exact references and `checked: true` per source, and set `editorialStatus: 'verified'` only after the checks. The interface withholds stories until those conditions are met. Missing image files always fall back to the labeled placeholder.
