---
title: Message Queue latency above target
date: 2026-08-24
service: queue
severity: major
resolved: false
chart: ../../../assets/queue-latency.png
chartAlt: 'Median delivery time of Message Queue over twelve hours: it rises from 142 to 604 ms, crossing the 300 ms target, then falls back to 410.'
summary: Consumers lag behind producers; delivery is delayed but nothing is lost.
---

## What is happening

Message Queue is accepting writes normally, but consumers lag behind producers.
Delivery is delayed rather than lost: every message that entered the queue will
be delivered once throughput recovers.

## Impact

Anything reading the queue sees data that is a few minutes old. Writes are not
affected, and no message has been dropped.

## Current state

We have added consumer capacity and are watching the lag drain. The incident
stays open until median delivery is back under the agreed target.
