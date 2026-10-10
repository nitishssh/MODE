# Implementation tickets

Project: https://github.com/users/nitishssh/projects/14

The GitHub issues and board follow the approved phased plan. All 16 MVP cards have a Phase, priority P0 and the final target date of 11 October; deferred #17 is archived. Check each linked issue for current status. The backend acceptance evidence for #1, #2, #4, #5 and #6 is recorded in [ACCEPTANCE.md](ACCEPTANCE.md).

| Ticket | Owner | Area | Dependencies |
|---|---|---|---|
| [#1 [Foundation] Publish the runnable MODE starter and quality checks](https://github.com/nitishssh/MODE/issues/1) | @nitishssh | platform | None |
| [#2 P0 shared membership, ledger and native-auth foundations](https://github.com/nitishssh/MODE/issues/2) | @DIVYANK-BHARDWAJ; @nitishssh integration | foundation | #1, completed #3 |
| [#3 Completed base authentication and roles](https://github.com/nitishssh/MODE/issues/3) | @DIVYANK-BHARDWAJ | backend | Closed; extensions in #2 |
| [#4 P1 dues, renewals and reminders](https://github.com/nitishssh/MODE/issues/4) | @DIVYANK-BHARDWAJ | backend | #2, #3 |
| [#5 P2 tickets, expiring holds and check-in](https://github.com/nitishssh/MODE/issues/5) | @DIVYANK-BHARDWAJ | backend | #2, #3, #4 |
| [#6 P3 merchandise stock holds and ledger](https://github.com/nitishssh/MODE/issues/6) | @DIVYANK-BHARDWAJ | backend | #2, #3, #4; after #5 |
| [#7 P5 reimbursements, ledger and CSV](https://github.com/nitishssh/MODE/issues/7) | @nitishssh | backend | #2, #3; after #8 |
| [#8 P4 announcements, outbox and notifications](https://github.com/nitishssh/MODE/issues/8) | @nitishssh | backend | #2, #3 |
| [#9 P5 volunteers and progress](https://github.com/nitishssh/MODE/issues/9) | @nitishssh | backend | #2, #3; after #8 |
| [#10 P6a/P6 Expo shell, auth and navigation](https://github.com/nitishssh/MODE/issues/10) | @Azmanshaikh; @nitishssh scaffold support | frontend | #2, #3; coordinate #14 |
| [#11 P6 Member Pass, tickets, holds and scanner](https://github.com/nitishssh/MODE/issues/11) | @Azmanshaikh | frontend | #2, #4, #5, #10 |
| [#12 P6 merchandise and announcements](https://github.com/nitishssh/MODE/issues/12) | @Azmanshaikh | frontend | #6, #8, #10 |
| [#13 P6 volunteers and treasurer register](https://github.com/nitishssh/MODE/issues/13) | @Azmanshaikh | frontend | #7, #9, #10 |
| [#14 P8 LAN, Expo Go and web/PWA builds](https://github.com/nitishssh/MODE/issues/14) | @nitishssh | platform | #2, #10; final smoke #11–#13 |
| [#15 P7 semester journey and reconciliation](https://github.com/nitishssh/MODE/issues/15) | @nitishssh | integration | #4–#14 |
| [#16 P7 release demo and submission](https://github.com/nitishssh/MODE/issues/16) | @nitishssh | platform | #14, #15 |
| [#17 Deferred officer handover/assets](https://github.com/nitishssh/MODE/issues/17) | @nitishssh | deferred | Closed as not planned for MVP |

Tickets #1–#16 belong to the MVP plan. #17 is outside this release. Module owners supply their own tests; Nitish owns integration and evidence. See [team ownership](TEAM.md) for the schedule checkpoints and scope reductions.
