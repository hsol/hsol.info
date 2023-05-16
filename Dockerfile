FROM python:3.10-slim as base

RUN adduser --disabled-password pynecone
FROM base as build

WORKDIR /app
ENV VIRTUAL_ENV=/app/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY . .

RUN pip install --upgrade pip
RUN pip install wheel && pip install poetry
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction \
    && rm -rf /root/.cache/pypoetry


FROM base as runtime

RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_19.x | bash - \
    && apt-get update && apt-get install -y \
    nodejs \
    unzip \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/app/venv/bin:$PATH"


FROM runtime as init

WORKDIR /app
ENV BUN_INSTALL="/app/.bun"
COPY --from=build /app/ /app/
RUN pc init


FROM runtime

COPY --chown=pynecone --from=init /app/ /app/
USER pynecone
WORKDIR /app
CMD ["pc","run" , "--env", "prod"]

EXPOSE 3000
EXPOSE 8000