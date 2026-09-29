---
title: API Gateway slow in eu-central
date: 2026-06-14
service: gateway
severity: minor
resolved: true
summary: A bad routing table sent part of the traffic the long way around.
---

## What happened

A routing table rolled out with the wrong preference sent part of eu-central
traffic through a neighbouring region. Requests succeeded, but the extra hop
added around 180 ms to the median.

## Resolution

The table was rolled back within the hour and latency returned to normal.
Rollout of routing changes is now staged one region at a time.
