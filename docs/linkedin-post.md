# LinkedIn post draft

I stopped the MongoDB container in my Docker project to see what would happen to my Node.js app.

The webpage stayed available on port 3001. But reading or saving a profile failed because the database was offline.

I turned this into a repeatable Docker Compose experiment:

- A liveness endpoint returned 200 while the database readiness endpoint returned 503.
- Docker health checks marked the app unhealthy during the outage.
- After I started MongoDB again, the app reconnected without restarting Node.js.
- Replacing the MongoDB container preserved the saved profile in a named volume.

The test checks HTTP responses, container IDs, process start time, and saved data. It also records recovery time for each local run.

The most useful lesson for me: an app process can be running while a feature is unavailable. Health checks detect the problem, connection handling enables recovery, and volumes preserve data across container replacement.

This was a local learning experiment with downtime and an explicit database restart. Failed saves needed a retry.

I've documented the setup, commands, and observed results so others can reproduce it:

https://github.com/sanjay81/docker-mongodb-profile-app

Next, I'd like to explore backup restoration—because persistent storage alone isn't a backup.

#Docker #DockerCompose #NodeJS #MongoDB #LearningInPublic
