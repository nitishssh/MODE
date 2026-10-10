# Implementation tickets

Project: https://github.com/users/nitishssh/projects/14

The GitHub board is the source of live status. This file is the initial task/ownership map; check the linked issue for current acceptance criteria.

| Ticket | Owner | Area | Dependencies |
|---|---|---|---|
| [#1 [Foundation] Publish the runnable MODE starter and quality checks](https://github.com/nitishssh/MODE/issues/1) | @nitishssh | platform | None |
| [#2 [Architecture] Freeze MVP boundaries, API contracts and team ownership](https://github.com/nitishssh/MODE/issues/2) | @nitishssh | integration | #1 |
| [#3 [Backend] Add authentication, club roles and protected API boundaries](https://github.com/nitishssh/MODE/issues/3) | @DIVYANK-BHARDWAJ | backend | #2 |
| [#4 [Backend] Implement membership dues, benefits, expiry and renewal reminders](https://github.com/nitishssh/MODE/issues/4) | @DIVYANK-BHARDWAJ | backend | #3 |
| [#5 [Backend] Implement event booking, member pricing and ticket check-in](https://github.com/nitishssh/MODE/issues/5) | @DIVYANK-BHARDWAJ | backend | #3, #4 |
| [#6 [Backend] Implement merchandise variants, orders and stock-safe checkout](https://github.com/nitishssh/MODE/issues/6) | @DIVYANK-BHARDWAJ | backend | #3, #4 |
| [#7 [Backend] Build the club ledger and receipt-based reimbursement workflow](https://github.com/nitishssh/MODE/issues/7) | @DIVYANK-BHARDWAJ | backend | #3, #2 |
| [#8 [Backend] Publish announcements with an archived mailing-list delivery flow](https://github.com/nitishssh/MODE/issues/8) | @DIVYANK-BHARDWAJ | backend | #3 |
| [#9 [Backend] Add volunteer task assignments, deadlines and progress](https://github.com/nitishssh/MODE/issues/9) | @DIVYANK-BHARDWAJ | backend | #3 |
| [#10 [Frontend] Build authenticated navigation and role-aware dashboard states](https://github.com/nitishssh/MODE/issues/10) | @Azmanshaikh | frontend | #2, #3 |
| [#11 [Frontend] Deliver membership, ticket booking and entrance check-in screens](https://github.com/nitishssh/MODE/issues/11) | @Azmanshaikh | frontend | #4, #5, #10 |
| [#12 [Frontend] Deliver merchandise ordering and announcement publishing screens](https://github.com/nitishssh/MODE/issues/12) | @Azmanshaikh | frontend | #6, #8, #10 |
| [#13 [Frontend] Deliver volunteer task board and treasurer workspace](https://github.com/nitishssh/MODE/issues/13) | @Azmanshaikh | frontend | #9, #7, #10 |
| [#14 [Platform] Deploy a persistent demo with environment, migration and rollback checks](https://github.com/nitishssh/MODE/issues/14) | @nitishssh | platform | #1, #3 |
| [#15 [Integration] Verify the full semester journey and close critical regressions](https://github.com/nitishssh/MODE/issues/15) | @nitishssh | integration | #11, #12, #13, #14 |
| [#16 [Release] Prepare demo evidence, README and final submission checklist](https://github.com/nitishssh/MODE/issues/16) | @nitishssh | platform | #15 |
| [#17 [Stretch] Add officer handover and club asset responsibility](https://github.com/nitishssh/MODE/issues/17) | @nitishssh | integration | #15 |

Tickets #1–#16 belong to the MVP milestone. #17 is optional and should wait until the core acceptance demo passes.
