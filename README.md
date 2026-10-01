# MongoDB profile app

A learning app with an HTML/JavaScript frontend, a Node.js/Express API, MongoDB, and Mongo Express. Docker Compose runs all three services on one network. The app saves one shared profile.

## Failure and recovery experiment

Follow [the step-by-step recovery lab](docs/recovery-lab.md) to stop a separate test database, observe failed saves, measure recovery, and verify volume persistence. The lab uses port 3001 and separate volumes. Start it with `docker compose -p profile-recovery-lab -f compose.lab.yaml up -d --build --wait`, then run `npm run lab:test`.

See the [verified results](docs/recovery-results.md), [Docker concepts explained](docs/docker-learning-notes.md), and [LinkedIn post draft](docs/linkedin-post.md). No video is needed to follow the experiment.

The app now exposes `/api/health` (process alive) and `/api/ready` (database read succeeds). The frontend polls database readiness without overwriting your unsaved form values.


## 1. Get the source and create your configuration

Download or clone this project and open a terminal in its folder. You need Docker Desktop (or Docker Engine with Compose). With Node.js 22 or newer installed, run:

```sh
node scripts/setup-env.cjs
```

This creates a private `.env` with random database and Mongo Express passwords and matching connection URLs. It refuses to overwrite an existing file. The script has no npm dependencies.

Without local Node.js, copy `.env.example` to `.env` and replace the database password in all three places and the web password. URL-encode credentials inside connection URLs if they contain special characters. Alternatively, run the setup script with Docker:

```sh
docker run --rm -v "$PWD:/workspace" -w /workspace node:22-alpine node scripts/setup-env.cjs
```

Why: each installation needs its own credentials. Never commit `.env`.

## 2. Build and start your own copy

```sh
docker compose up -d --build
docker compose ps
```

The Dockerfile builds the app from source with `npm ci`. Compose initializes MongoDB with the configured administrator credentials on its first start and creates project-specific volumes automatically. It waits for MongoDB's health check before starting the app and Mongo Express.

Open:

- Website: http://localhost:3000
- Mongo Express: http://localhost:8081

For the Mongo Express login, use `MONGO_EXPRESS_WEB_USERNAME` and `MONGO_EXPRESS_WEB_PASSWORD` in `.env`. This login is separate from the database credentials.

Save a profile in the website, then select the database from `MONGODB_DB` and collection from `MONGODB_COLLECTION` in Mongo Express. MongoDB creates these when the first profile is saved.

Why: a new user should not need your Mac's volume names or your existing database users.

## 3. Run a compatible published image instead

Build from source for the current recovery features. The older `singhania8192/profile-app:1.0` tag is not verified with the new `/api/ready` health check. This GitHub update does not publish a new Docker Hub image.

After publishing a current image (see below), set its tag in `.env`:

```dotenv
APP_IMAGE=YOUR_USERNAME/profile-app:1.1
```

Then run:

```sh
docker compose pull app
docker compose up -d --no-build
```

The Docker Hub repository must be public for anonymous pulls. For a private repository, sign in with `docker login` using an authorized account. A release built only for Apple Silicon might not run natively on an Intel/AMD machine; build from source or publish a multi-platform release.

Why: people who only want to run the app can download a prepared image. People who want to edit it can build the source.

## 4. Everyday commands

```sh
docker compose logs -f              # Follow logs; Ctrl+C exits the viewer
docker compose stop                # Stop services
docker compose up -d               # Start services
docker compose up -d --build app    # Rebuild after source changes
docker compose down                # Remove containers; keep database volumes
```

Do not add `--volumes` to `down` unless you intend to delete Compose-managed database data. Changing initialization credentials in `.env` does not change users already stored in an existing database; initialize a fresh installation or update database users deliberately.

## Existing local installation

On the maintainer's Mac, an ignored `compose.override.yaml` keeps the original MongoDB image and external volumes. The local `.env` retains the existing published app image name. Compose loads it automatically. It is not included in the public project. Existing `.env` credentials and the selected database are preserved. Do not copy this override to another machine or start two MongoDB processes against the same volume.

To inspect only the portable configuration, use `docker compose -f compose.yaml config --quiet`.

## Optional local Node.js development

```sh
docker compose up -d mongodb mongo-express
docker compose stop app
npm ci
npm run dev
```

The local backend uses `MONGODB_URI` with `127.0.0.1`. Both app and Mongo Express containers use `MONGO_EXPRESS_URI` with the Compose hostname `mongodb`. These URLs are generated with the same credentials. Keep MongoDB's port published for local Node.js access.

## Publish your own release

Create a Docker Hub repository, then replace YOUR_USERNAME below:

```sh
docker login
docker build -t YOUR_USERNAME/profile-app:1.1 .
docker push YOUR_USERNAME/profile-app:1.1
```

For both Intel/AMD servers and Apple Silicon, use a Buildx builder with support for both platforms:

```sh
docker buildx create --name profile-multiplatform --driver docker-container --use
docker buildx build --platform linux/amd64,linux/arm64 -t YOUR_USERNAME/profile-app:1.1 --push .
```

Create the builder once. On later releases, select it with `docker buildx use profile-multiplatform`. An image registry stores images; a running computer or server is still required to host the website.

## How it works

- `public/index.html`, `public/style.css`, and `public/app.js`: browser frontend.
- `server.js`: serves the frontend and profile API.
- `GET /api/health`: process liveness, independent of database access after startup.
- `GET /api/ready`: readiness, verified by a database read.
- `GET /api/profile`: reads the shared profile.
- `PUT /api/profile`: validates and saves the profile with `_id: "demo-profile"`.
- `compose.yaml`: portable services, health checks, networking, and volumes.
- `compose.lab.yaml`: isolated failure/recovery lab on port 3001.
- `scripts/recovery-lab.cjs`: repeatable assertions and measured recovery report.
- `.env.example`: shareable configuration reference with placeholders.
- `scripts/setup-env.cjs`: creates matching random credentials without overwriting existing settings.

This project is for local learning. The profile API has no user authentication and uses the database administrator account for simplicity. Published ports bind to localhost. The Mongo Express image retains the tested digest; its Docker Official Image is deprecated. See https://hub.docker.com/_/mongo-express.

A source-code license has not yet been selected. Public visibility alone does not grant a general license to redistribute or modify the code.
