# ACR-Based Docker Build Notes

更新日期：2026-04-16

This project can be built without pulling directly from Docker Hub by parameterizing the Docker base image.

Current repository state:

- The production image now copies prebuilt `frontend/dist` assets directly into the container.
- Server deployment no longer needs to build the frontend with Node in Docker.
- Docker Hub sensitivity is now mainly about the Python base image, not the frontend toolchain.

## Why This Exists

The original `Dockerfile` used:

```dockerfile
FROM python:3.11-slim
```

That requires stable access to Docker Hub during `docker build`. On some Alibaba Cloud servers this is unreliable.

The repository now supports:

- `BASE_IMAGE`: override the Docker base image
- `PIP_INDEX_URL`: override the Python package index
- `PIP_TRUSTED_HOST`: trust a custom package host

## Recommended Strategy

Use ACR for the Python base image layer:

1. Base image

That gives you a stable server-side workflow:

```text
git pull
docker build --build-arg BASE_IMAGE=<acr>/python:3.11-slim ...
docker run ...
```

Or:

```text
local/ci build
push app image to ACR
server docker pull
server docker run
```

## Step 1: Prepare the Base Image in ACR

Mirror or push a Python base image into your own ACR registry, for example:

```text
<your-acr-registry>/python:3.11-slim
```

The exact registry address depends on your Alibaba Cloud region and namespace.

Before building on the server, prepare the frontend assets locally:

```bash
cd frontend
npm.cmd run build
```

Then commit and push `frontend/dist`.

## Step 2: Build the App Image Against ACR

Example server-side build:

```bash
docker build \
  --build-arg BASE_IMAGE=<your-acr-registry>/python:3.11-slim \
  --build-arg PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ \
  --build-arg PIP_TRUSTED_HOST=mirrors.aliyun.com \
  -t resume-assistant:latest .
```

## Step 3: Run the Container

Example:

```bash
docker run --rm -d \
  --name resume-assistant \
  -p 8008:8008 \
  --env-file .env \
  -v /opt/resume-assistant/data:/app/data \
  resume-assistant:latest
```

## Optional: Push the App Image Back to ACR

If you want the server to avoid rebuilding every time, tag and push the finished app image:

```bash
docker tag resume-assistant:latest <your-acr-registry>/resume-assistant:latest
docker push <your-acr-registry>/resume-assistant:latest
```

Then future deployments can become:

```text
docker pull <your-acr-registry>/resume-assistant:latest
docker stop/rm old container
docker run new container
```

## Practical Guidance

- If your main problem is only Docker Hub access, fixing the base image source may already be enough.
- If `pip install` is also slow or unstable, pass a domestic `PIP_INDEX_URL`.
- Do not hardcode your private ACR registry address into the repository unless you intend the repo to be environment-specific.
- Keep production `.env` only on the server.
- If you want `/` to serve the new frontend, also set `HOME_RENDER_MODE=frontend` in production `.env`.
