.PHONY: up down test lint format migrate

up:
	docker-compose up -d --build

down:
	docker-compose down

test:
	cd backend && pytest -v

lint:
	cd backend && ruff check . && mypy app

format:
	cd backend && ruff format .

migrate:
	cd backend && alembic upgrade head
