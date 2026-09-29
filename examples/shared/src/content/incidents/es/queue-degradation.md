---
title: La cola de mensajes responde más lento que el objetivo
date: 2026-08-24
service: queue
severity: major
resolved: false
chart: ../../../assets/queue-latency.png
chartAlt: 'Tiempo mediano de entrega de la cola durante doce horas: sube de 142 a 604 ms, cruza el objetivo de 300 ms y baja a 410.'
summary: 'Los consumidores van por detrás de los productores: la entrega se retrasa, pero nada se pierde.'
---

## Qué está pasando

La cola acepta escrituras con normalidad, pero los consumidores van por detrás
de los productores. La entrega se retrasa en lugar de perderse: todo mensaje que
entró en la cola se entregará cuando el rendimiento se recupere.

## A qué afecta

Todo lo que lee de la cola ve datos de hace unos minutos. La escritura no está
afectada y no se ha perdido ningún mensaje.

## Estado actual

Hemos añadido capacidad de consumo y vigilamos cómo baja el retraso. La
incidencia sigue abierta hasta que la entrega mediana vuelva al objetivo.
