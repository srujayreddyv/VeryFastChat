.PHONY: web api

web:
	cd apps/web && npm run dev

api:
	cd apps/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
