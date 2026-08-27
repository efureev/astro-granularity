---
title: API Gateway lento en eu-central
date: 2026-06-14
service: gateway
severity: minor
resolved: true
summary: Una tabla de rutas con la preferencia equivocada desvió parte del tráfico.
---

## Qué ocurrió

Una tabla de rutas salió con la preferencia equivocada y envió parte del tráfico
de eu-central por una región vecina. Las peticiones funcionaban, pero el salto
adicional sumó unos 180 ms a la mediana.

## Resolución

La tabla se revirtió en menos de una hora y la latencia volvió a la normalidad.
Los cambios de enrutado ahora se despliegan región por región.
