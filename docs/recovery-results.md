# Observed recovery experiment

The automated `npm run lab:test` experiment passed locally on 2026-09-21 using the isolated `profile-recovery-lab` project.

| Check | Observed result |
| --- | --- |
| Save a sample profile | HTTP 200 |
| Submit invalid email or malformed JSON | HTTP 400 |
| Request an unknown API route | HTTP 404 |
| Load the webpage while MongoDB is stopped | HTTP 200 |
| Read the profile while MongoDB is stopped | HTTP 503 |
| Node liveness while MongoDB is stopped | HTTP 200 |
| Database readiness while MongoDB is stopped | HTTP 503 |
| Attempt a valid save during the outage | HTTP 503 |
| Docker app health during the outage | Unhealthy |
| Start MongoDB and wait for readiness | 0.98 seconds |
| Read the original profile after recovery | Unchanged |
| Retry a save after recovery | HTTP 200 |
| Recreate MongoDB with the existing lab volumes | New database container ID; profile preserved |
| App process during the full experiment | Same container ID, start time, and restart count |

This is the latest review run; an earlier run measured 0.68 seconds. The [recorded machine-readable evidence](recovery-evidence.json) contains timestamps and assertions from this run.

The measured interval includes `docker compose start mongodb` and readiness polling. This is one local observation, not a benchmark or guarantee. MongoDB was restored by an explicit operator command; the app then reconnected. The experiment demonstrates an outage followed by recovery, not zero downtime or automatic database repair.

Reproduce the test with [the lab guide](recovery-lab.md). Each run writes its own result to the ignored `lab-results/latest.json` file. Browser visual behavior was not checked with an automated browser in this run; the guide includes manual verification steps.

## Additional review checks

- JavaScript syntax and installed dependency checks passed.
- Normal, portable, and lab Compose configurations validate.
- Environment setup creates a private file and refuses to overwrite existing credentials.
- Local Markdown links and the optional guide generator syntax validate.
- `.env`, local overrides, dependencies, and transient reports remain ignored by Git.

The optional Word guide generator was updated but a Word artifact was not generated or visually reviewed. The Markdown guides are the maintained documentation for this change.
