---
id: mechanism-hosted-runner-variance
type: Mechanism
label: "hosted runner variance"
---

## Definition

A shared windows-latest job runs several Bun/Node pools on one machine, so identical work takes 2x or more longer from one run to the next (8.5 s vs 18.7 s measured for one three-child test). Any budget sized from a single observation, and especially from a developer laptop, is inside that spread.

