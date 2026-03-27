# shift left  Docker Image

Starts shift left  from the Docker image configured in this folder's compose files.

## Usage

1. Create `.env` file and specify the `PORT` (refer to `.env.example`)
2. `docker compose up -d`
3. Open `http://localhost:3000`
4. You can bring the containers down by `docker compose stop`

## Env Variables

If you want to persist your data (flows, logs, credentials, storage), set these variables in the `.env` file inside the `docker` folder:

-   DATABASE_PATH=/root/.shiftleft
-   LOG_PATH=/root/.shiftleft/logs
-   SECRETKEY_PATH=/root/.shiftleft
-   BLOB_STORAGE_PATH=/root/.shiftleft/storage

shift left  also supports environment variables to configure your instance. See `https://docs.shiftleftai.ai/configuration/environment-variables`.

## Queue Mode

### Building from source

```
docker compose -f docker-compose-queue-source.yml up -d
```

Monitor Health:

```
docker compose -f docker-compose-queue-source.yml ps
```

### From pre-built images

```
docker compose -f docker-compose-queue-prebuilt.yml up -d
```

Monitor Health:

```
docker compose -f docker-compose-queue-prebuilt.yml ps
```
