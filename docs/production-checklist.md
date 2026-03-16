# Production Checklist

## Current State

- [x] Production web deployed at `https://veryfastchat.vercel.app`
- [x] Production API deployed at `https://veryfastchat-api.onrender.com`
- [x] Supabase schema, policies, indexes, and realtime verified
- [x] Core production flow verified:
  - create room
  - join room
  - realtime messaging
  - persistent history
  - host moderation
- [x] Local automated verification completed previously:
  - backend `83/83`
  - frontend `37/37`
- [x] GitHub Actions CI configured
- [x] GitHub Actions public uptime monitoring configured

## Remaining High-Priority Work

### CI

- [ ] Confirm the latest GitHub Actions run is green after the action-version bump

### Error Tracking

- [x] Error tracking wired into code for web and API
- [ ] Create Sentry project(s)
- [ ] Add production env vars in Vercel:
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
  - `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
- [ ] Add production env vars in Render:
  - `SENTRY_DSN`
  - `SENTRY_TRACES_SAMPLE_RATE`
- [ ] Trigger a test error and confirm it appears in Sentry

### Production Hardening

- [ ] Set up alert notifications for uptime failures
- [ ] Add log aggregation if you want searchable production logs
- [ ] Decide whether to enable Upstash Redis in production

## Recommended QA Still Worth Doing

- [ ] Cross-browser testing: Chrome, Firefox, Safari
- [ ] Mobile responsiveness pass on real devices
- [ ] Accessibility pass: keyboard navigation, focus states, screen reader basics
- [ ] Slow-network test for create/join/send flows
- [ ] Failure-path test for rate limits and temporary API failures

## Optional Next Steps

- [ ] Custom domain for web
- [ ] Custom domain for API
- [ ] Load testing
- [ ] Backup/restore drill for Supabase
- [ ] Product analytics

## Operational Notes

- `/metrics` is protected and intended for authorized operational use only
- GitHub monitoring intentionally checks only public endpoints:
  - `https://veryfastchat.vercel.app`
  - `https://veryfastchat-api.onrender.com/health`
