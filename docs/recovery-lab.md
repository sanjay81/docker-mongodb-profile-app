# Docker failure and recovery: step by step

This experiment deliberately stops a **test database**. It runs on port **3001** with project name `profile-recovery-lab`, database `recovery_lab`, and its own volumes. Your regular app on 3000 and its database volumes are separate.

Always use the full `-p profile-recovery-lab -f compose.lab.yaml` options below. Specifying this standalone file avoids loading your normal Compose file or its local override. The lab database has no authentication and no published host port: use synthetic data only. It omits Mongo Express because the browser and API provide the evidence for this experiment.

## 1. Start

Open Docker Desktop and wait until it is running. In VS Code, open the project terminal:

```sh
docker compose -p profile-recovery-lab -f compose.lab.yaml up -d --build --wait
```

Open **http://localhost:3001**. The status should read **Database online**. Enter a sample name and email, save, then reload to check persistence.

## 2. Run the automated experiment

With local Node.js 22 or newer:

```sh
npm run lab:test
```

This overwrites the lab's shared profile with synthetic data. It checks:

1. Saving works; invalid email and malformed JSON are rejected; unknown API routes return 404.
2. After MongoDB stops, `/api/health` and the webpage return 200 (Node is alive and still serves the frontend).
3. `/api/ready`, profile reads, and a valid save return 503 during the outage.
4. Docker marks the app unhealthy.
5. Starting MongoDB restores reads and saves, with the original profile preserved.
6. Recreating MongoDB changes its container ID but preserves the profile in its volume.
7. The app container and Node process did not restart during the experiment.

The report is written to `lab-results/latest.json` (ignored by Git). Recovery time is measured from just before `docker compose start mongodb` until the first successful readiness response. It includes command execution and polling, and is a single local observation, not a performance guarantee. On a failure while MongoDB is stopped, the script attempts to start it again.

## 3. Verify each step manually

Load the profile before stopping MongoDB so the form is editable. Follow these checks in your browser and terminal; no recording is required.

**Stop only the lab database:**

```sh
docker compose -p profile-recovery-lab -f compose.lab.yaml stop mongodb
```

Within a few seconds the browser should report Database offline. Edit the sample name and click Save: you should see an error, and your typed values stay in the form. Saves are not queued or replayed automatically.

**Show the difference between alive and ready:**

```sh
curl -i http://localhost:3001/api/health
curl -i http://localhost:3001/api/ready
docker compose -p profile-recovery-lab -f compose.lab.yaml ps
```

Expect health 200, readiness 503, and eventually `unhealthy` for the app. Docker health status changes after failed probe intervals, so it may lag behind the browser. The unhealthy label itself does not restart or repair this lab's app.

**Restore the database:**

```sh
docker compose -p profile-recovery-lab -f compose.lab.yaml start mongodb
```

Wait for Database online. Click Save again. Reload and verify your saved profile. If you first opened the page during the outage, use **Retry loading** once the database returns.

**Replace the database container while retaining its volume:**

```sh
docker compose -p profile-recovery-lab -f compose.lab.yaml up -d --no-deps --force-recreate mongodb
```

Wait for Database online, then reload. The profile should still exist. The automated test additionally verifies that the database container ID actually changed.

## 4. What the experiment proves

- The Node process can be alive while its database-dependent API is unavailable.
- Health checks reveal failures. An operator restarts MongoDB here; the MongoDB driver then reconnects without restarting Node.
- Failed saves return errors and require a retry; this demonstration has downtime.
- Named volumes preserve data across container replacement. Persistence is not a backup.

Port 3001 remains reachable during the database outage: it belongs to the Node app, not MongoDB. Data saved before the outage stays in the volume. Failed saves must be retried explicitly.

For a written explanation, see [Docker learning notes](docker-learning-notes.md) and [observed results](recovery-results.md).

## 5. Stop the lab

```sh
docker compose -p profile-recovery-lab -f compose.lab.yaml down
```

This removes lab containers and the network while keeping lab volumes. Do not add `--volumes` if you want to retain the sample profile.

## 6. Share the written experiment

Use the [LinkedIn post draft](linkedin-post.md) with the repository link. The [results document](recovery-results.md) records the verified checks and measurement limits. No video is required.
