# Actual k6 results

Generated from retained k6 summaries; latency in milliseconds. RPS is completions in the fixed 20-second measured window divided by 20. Failures are unexpected statuses/invalid bodies; expected booking HTTP 409 responses are separate.

| Run | Workload | VUs | Measured requests | RPS | p50 | p95 | p99 | Failure rate | Server errors |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | availability | 10 | 210 | 10.50 | 933.67 | 1133.40 | 1195.69 | 0.00% | 0 |
| baseline | availability | 50 | 150 | 7.50 | 6486.04 | 8483.04 | 8502.74 | 0.00% | 0 |
| baseline | availability | 100 | 101 | 5.05 | 24198.53 | 24758.40 | 24819.17 | 29.70% | 30 |
| baseline | availability | 200 | 426 | 21.30 | 6014.89 | 13640.40 | 17022.19 | 100.00% | 426 |
| baseline | booking | 10 | 333 | 16.65 | 444.67 | 1500.61 | 1623.41 | 0.00% | 0 |
| baseline | booking | 50 | 612 | 30.60 | 1601.73 | 2780.33 | 3077.47 | 0.00% | 0 |
| baseline | booking | 100 | 1260 | 63.00 | 1386.23 | 2845.54 | 2979.14 | 0.00% | 0 |
| baseline | booking | 200 | 1156 | 57.80 | 3411.66 | 6682.45 | 8041.36 | 0.00% | 0 |
| baseline | discovery-cached | 10 | 13643 | 682.15 | 11.96 | 23.52 | 39.66 | 0.00% | 0 |
| baseline | discovery-cached | 50 | 10455 | 522.75 | 68.06 | 177.82 | 382.33 | 0.00% | 0 |
| baseline | discovery-cached | 100 | 11230 | 561.50 | 165.06 | 316.37 | 428.15 | 0.00% | 0 |
| baseline | discovery-cached | 200 | 8895 | 444.75 | 288.62 | 950.31 | 5322.73 | 1.23% | 109 |
| baseline | discovery-uncached | 10 | 478 | 23.90 | 402.14 | 576.92 | 675.15 | 0.00% | 0 |
| baseline | discovery-uncached | 50 | 522 | 26.10 | 1902.07 | 2586.30 | 3033.29 | 0.00% | 0 |
| baseline | discovery-uncached | 100 | 330 | 16.50 | 5800.37 | 7561.76 | 7981.83 | 5.45% | 18 |
| baseline | discovery-uncached | 200 | 539 | 26.95 | 6292.75 | 9587.88 | 10689.87 | 36.73% | 198 |
| controlled-before | discovery-cached | 200 | 10099 | 504.95 | 281.06 | 819.22 | 5247.48 | 0.93% | 94 |
| controlled-after | discovery-cached | 200 | 17114 | 855.70 | 230.15 | 288.67 | 311.37 | 0.00% | 0 |
| after-matrix | discovery-cached | 10 | 10203 | 510.15 | 11.77 | 33.89 | 90.82 | 0.00% | 0 |
| after-matrix | discovery-cached | 50 | 16572 | 828.60 | 58.27 | 79.64 | 92.65 | 0.00% | 0 |
| after-matrix | discovery-cached | 100 | 16355 | 817.75 | 113.54 | 194.61 | 235.03 | 0.00% | 0 |
| after-matrix | discovery-cached | 200 | 15102 | 755.10 | 247.77 | 384.64 | 479.57 | 0.00% | 0 |

## Simultaneous conflicting reservations

Five timed waves per level, one attempt per VU per wave. k6 HTTP RPS includes deliberate pacing and the five winner-confirmation requests, so it is not a sustained capacity measure. Latencies below cover the creation attempts only.

| VUs per wave | Attempts | Created | HTTP 409 conflicts | Confirmed winners | k6 HTTP RPS (paced) | Unexpected failures | p50 ms | p95 ms | p99 ms | Active overlaps in DB |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 50 | 5 | 45 | 5 | 4.54 | 0.00% | 97.75 | 204.99 | 384.82 | 0 |
| 50 | 250 | 5 | 245 | 5 | 20.52 | 0.00% | 286.88 | 497.06 | 700.20 | 0 |
| 100 | 500 | 5 | 495 | 5 | 40.74 | 0.00% | 321.34 | 1013.01 | 1024.02 | 0 |
| 200 | 1000 | 5 | 995 | 5 | 78.53 | 0.00% | 564.77 | 1253.53 | 1306.11 | 0 |

## Interpretation

The baseline survey exposed uncached/availability saturation and hot-cache expiry failures; failed runs are retained. The controlled comparison restarts the API, primes the same query, ages its 45-second cache for 30 seconds, and runs the same 200-VU script (5-second warm-up, 20-second measurement). Both use the same database, dataset, resource limits and pool. The change shares one database fill among identical undated requests. It does not improve the number of rows processed by distinct uncached requests, distributed cache invalidation, or multi-process coordination.

The final resume rounds 855.70 RPS to 856 and p95 288.667805 ms to 289 ms, explicitly stating local k6 users and synthetic providers. The 82 ms historical claim is not reused. `smoke/` is an intentionally retained failed harness check against an incorrect URL; `smoke-corrected/` validated the actual `/api/providers/v1` route. Smoke results do not support resume metrics.
