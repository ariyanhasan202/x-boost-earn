# Supabase Store Local Data

This directory (`data/supabase_store`) and `data/supabase_store.json` maintain local persistent fallback and shadow synchronization for user accounts, balances, referrals, tasks, and withdrawal records.

- If Supabase environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are configured, live updates are written to both Supabase and this persistent storage.
- If Supabase is not yet configured or temporarily offline, this storage maintains persistent data so no state is lost across reloads.
- To export or download this data via API, endpoints are available at `/api/export/supabase_store`, `/api/download/supabase_store`, and `/data/supabase_store`.
