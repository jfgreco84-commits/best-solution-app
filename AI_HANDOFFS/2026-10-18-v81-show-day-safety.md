# v81 show-day safety: the app has to help when things go sideways (Oct 18 2026)

| | |
|---|---|
| **Branch** | `claude/simplify-v79` (rides PR #79 with v79 and v80) |
| **App version** | v80 → **v81** |
| **Tests** | `node tests/show-day-safety-v81.test.js` (16 checks) |

Froggy asked for an audit from his side: under show stress, moving parts get stuck or break, and the app should make that easier, not harder.

## How it was tested (locally, against the Oct 17 backup, never committed)

- **Every button.** A Chromium script at phone size clicked every button on all 8 pages and on every show tab, for an active, completed booth, completed table, upcoming, passed and missed show. It then clicked every button inside each window those opened. That was 552 clicks with no crashes and no NaN or "undefined" on screen. The 5 hits it logged were harness-only (no click event, `file://` fetch, `select()` on a fake element).
- **A full 2-day weekend through the real screens:** new show, crew, pack, morning, money, page reload, evening, closeout, lock, day 2, close. The counts carried over, the money survived the reload, the garage came back exact and rep pay filled in.
- **Stress cases:** packing the wrong show, double taps, closing on Saturday by mistake, a rain date, a typo count, and 2 booths with mixed crews.

## What was stuck or risky, and the fix

| At the show | Before | v81 |
|---|---|---|
| Packed the wrong show | No way back. Closing it charged lunch, paper, liner and gas to a show you never worked. | **↩️ Undo Start** while nothing is sold or night-counted and no stock was moved. The packed stock goes back to the garage and the show is upcoming again (`canUndoStart`, `undoStartShow`). |
| Closed Saturday instead of Sunday | No reopen. | **↩️ Reopen Show** on a completed show that recorded its return in the last 14 days (the button stays off older shows so a stray tap cannot pull stock). The return comes back off the garage shelf. It refuses if the garage no longer has it, and says to fix the counts instead, since the garage already follows count fixes on closed shows (`reopenShow`). |
| Rain date or rescheduled | A show's date could not be changed anywhere. | **Start Date** field in ✏️ Edit Show. Day tabs relabel, and the move is logged. |
| Open a show from Home or the list | The list always opened Day 1. Home opened whatever day was looked at last, even on another show, which is how Sunday money lands on Saturday. | Opens on **today's day** while it runs, else the first unfinished day (`showDefaultDay`). An out-of-range day can't happen. |
| Double tap | Pack and close could run twice (stock packed or returned twice). New show, restock, Batman add and return, new rep, supply item and worker could duplicate. | Pack and close check status first. The others ignore the **same entry repeated within 1.5s** (`_sameTap`), so a real second entry still works. |
| Night count typo (300 for 30) | Saved quietly; it only showed up at closeout. | Toast right away: "🛑 Typo? C5-S 300 tonight, only 30 this morning." It stays up 7 seconds. |
| Rep pay on a show with no booths | A forgotten Rep-only tick silently split Isaiah's pay with the owner. | Each rep shows how their pay was figured. A note says "You are marked as working this show, so the 35% is split with you. Not there? Change crew." |
| Day screen gas chip | It still showed Gas $0 after v79 moved gas to Edit Show. | It only shows when old day gas exists. The closeout text matches. |

## Noted on the real board (not changed)

- Fox & Found Oct 17 has morning and evening counts (about 90 units sold) and **$0 money logged**. Once money is entered, Isaiah's 40% fills in on its own.
