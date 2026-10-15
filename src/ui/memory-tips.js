export const labMemoryTips = {
  falling: 'Listen to each arriving block and repeat it aloud. Say the word again as you move it to the correct position; discard words from another ayah.',
  vanishing: 'Say the missing word before choosing a piece. Listen to its pronunciation, repeat it, then recite the complete phrase aloud.',
  jigsaw: 'Read each word group aloud, then practice the join between neighboring groups. Listen and repeat the full phrase after connecting them.',
  match: 'Say the word when you turn its card. Connect its sound with its meaning or continuation, then repeat the matched pair aloud.',
  chain: 'Recite each ayah aloud, then repeat its ending together with the next ayah’s beginning. These bridges help you remember the order.',
  continue: 'Recite the remainder aloud before comparing. As you rebuild, listen and say each chosen word, then repeat the whole ayah.',
  detective: 'Say the opening aloud, then recall its continuation before choosing. Listen closely to the alternatives and repeat the correct passage.',
};
const tips = {
  practice: 'Listen to each word, repeat it aloud after the reciter, then say it again as you move its piece. Join two words before adding another.',
  quiz: 'Say each word aloud as you place it. Read your sequence from the right, then listen and correct one piece at a time.',
  recall: 'Say the hidden word from memory before revealing it. Compare, listen, and repeat the phrase aloud.',
  sequence: 'Recite the end of one ayah and the beginning of the next together. Repeat that bridge to remember their order.',
  review: 'Recite before revealing the text. Record yourself if helpful, compare afterward, and grade honestly. Speaking strengthens your practice.',
  daily: 'Start with due reviews, then choose a small new passage. Short, regular spoken practice is easier to sustain.',
  gallery: 'Celebrate your progress, then keep returning for scheduled spoken reviews to strengthen what you remember.',
  journey: 'Practice a little, recall aloud independently, and return on another scheduled day. Puzzle progress and memorization are separate.',
  lab: 'Listen when you choose a piece, repeat after the reciter, and say the word again as you place it. Use Mute audio when you need quiet.',
};
export function mountMemoryTip(main, mode) {
  const tip = document.createElement('aside');
  tip.className = 'memory-pro-tip';
  tip.setAttribute('aria-label', 'Memorization pro tip');
  const title = document.createElement('strong');
  title.textContent = '✦ Memorization pro tip';
  const text = document.createElement('p');
  text.textContent = mode === "lab" ? labMemoryTips.falling : tips[mode] || tips.practice;
  tip.append(title, text);
  const anchor = main.querySelector('.lab-game, .builder, .practice-space, .daily-dashboard, .recall-session, .sequence-builder') || main.querySelector('footer');
  if (anchor) anchor.before(tip); else main.append(tip);
}
