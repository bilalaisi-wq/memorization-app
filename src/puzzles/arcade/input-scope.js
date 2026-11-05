// A game embedded in its own modal must remain playable. An unrelated modal
// (including a nested game-over dialog) must never steer the background game.
export function outsideGameDialog(root,event) {
  const host=root.closest?.('dialog'),target=event.target?.closest?.('dialog');
  return host ? target!==host||!root.contains(event.target) : !!target;
}
