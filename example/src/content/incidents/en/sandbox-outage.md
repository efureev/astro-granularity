---
title: Sandbox Runner unavailable
date: 2026-08-26
service: sandbox
severity: critical
resolved: false
summary: The development sandbox is not responding to health checks.
---

## What is happening

Sandbox Runner stopped answering health checks. This environment carries no
production traffic, so nothing user-facing is affected.

## Impact

Development sandboxes cannot be created or resumed. Existing production and
staging environments are untouched.
