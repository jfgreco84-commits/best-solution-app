# v99: Batman tally from his own note (Oct 26)

**Problem.** The Batman screen showed 370 owed (32oz 0, 16oz 0, 8oz 0, 2oz 96, C5-S 274, C5-L 0). Before Oct 22 it had red negatives for the extras Froggy gave back. Those were entered on the phone and wiped by the stale cloud copy; v88 could only restore 0s.

**Source.** A photo of Batman's handwritten note. "I owe Frog": 32's 13, 16's 76, 8's 28, C5L 80. "Frog owes me": 2oz 96, C5 234.

**Fix.** One-time `batman_note_oct26_v99` (`bmNoteOct26`) sets the tally to 32oz −13, 16oz −76, 8oz −28, 2oz 96, C5-S 234, C5-L −80, with one History entry (`set`, Oct 26). It changes the debt only; the garage is not touched. It runs only while the tally is exactly the v88 numbers, so a tally changed since is left alone.

**Note:** C5-S is **234** on Batman's note, against 274 in the app.

**Verified:** `tests/batman-oct19-fix.test.js` 19/19, `batman-history` 35/35.
