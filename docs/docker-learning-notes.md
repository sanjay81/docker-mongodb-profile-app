# What this Docker experiment teaches

## The question

If MongoDB becomes unavailable, does the whole application stop? If we replace a database container, does its data disappear?

The lab answers those questions with HTTP checks, Docker container inspection, and a saved sample document. You can reproduce every check without a video using [the walkthrough](recovery-lab.md).

## Architecture

```text
Browser or curl
      |
localhost:3001                Separate recovery-lab project
      |
Node.js container :3000 ----> MongoDB container :27017
 /api/health                         |
 /api/ready                    lab-data volume
 /api/profile                  mounted at /data/db
```

The host port 3001 forwards to port 3000 inside the Node container. MongoDB has no host port published in the lab. The Node container reaches it by the Compose service name `mongodb` over the project network. The regular app on port 3000 and Mongo Express on 8081 belong to the normal setup, not this experiment.

## What happens at each stage

| Stage | Webpage / Node | Database requests | Stored data |
| --- | --- | --- | --- |
| Both services running | Available | Reads and saves work | Stored in the volume |
| MongoDB stopped | Still available on port 3001 | Reads and saves return 503 | Retained, temporarily inaccessible |
| MongoDB started again | Same Node process | Driver reconnects; explicit save retries work | Previous values can be read |
| MongoDB container replaced | Same Node process | Brief interruption during replacement | Retained in the reused volume |

Readiness polling updates the database status indicator. It does not submit the form or reload your typed values. A failed save is not queued for later. A write timeout in a more complex failure can have an uncertain outcome; this lab tests saves after the database is already stopped and confirms the original document remains unchanged.

## Five Docker lessons

1. **Containers have independent lifecycles.** Stopping MongoDB does not stop Node. The browser can still load HTML even when the API cannot fetch database records.
2. **Liveness and readiness answer different questions.** `/api/health` confirms Node can answer HTTP. `/api/ready` performs a database read, so it also verifies connectivity and read access. Startup still requires MongoDB; liveness during this test concerns an app that was already running.
3. **Health checks observe; they do not repair this lab.** Docker eventually marks the app unhealthy. You explicitly start MongoDB again. The existing MongoDB client reconnects; the test confirms Node's container ID, start time, and restart count remain unchanged.
4. **Volumes outlive individual containers.** The test checks that the database container ID changes and the full saved profile remains. Deleting the volume would remove that persistence. A volume is not an independent backup.
5. **Separate projects make experiments repeatable.** An explicit Compose file and project name give this lab its own containers, network, and volumes. Test commands target only that project.

## Evidence and limits

Read [the observed results](recovery-results.md). Run `npm run lab:test` to generate your own `lab-results/latest.json`.

The timer begins before the database start command and ends at the first successful readiness response. It includes command execution and polling. Results depend on the machine and run. The experiment does not test production traffic, high availability, backup restoration, database replication, or a host-machine failure.

The lab database is unauthenticated and has no published host port. It is intentionally limited to synthetic data. The normal app uses the separately configured credentials in `.env`.

## Files to explore

- [`compose.lab.yaml`](../compose.lab.yaml): isolated services, readiness health check, port mapping, and named volumes.
- [`server.js`](../server.js): liveness/readiness endpoints, bounded database operations, and profile API.
- [`public/app.js`](../public/app.js): readiness polling and explicit save retries.
- [`scripts/recovery-lab.cjs`](../scripts/recovery-lab.cjs): assertions and recovery measurement.

For Docker's underlying behavior, see [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) and [Docker volumes](https://docs.docker.com/engine/storage/volumes/).
