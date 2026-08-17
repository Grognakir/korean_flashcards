#!/usr/bin/env bash
set -euo pipefail

KL="/Users/tensolomon/Documents/GitHub/korean_learning"
KF="/Users/tensolomon/Documents/GitHub/korean_flashcards"
BACKUP="$KL/supabase/backup"
OLD_REF="cyoezrdxqncroflgkyry"
ORG="hplovlrntosqtghszilm"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP/migrations"
cp -R "$KL/supabase/migrations/." "$BACKUP/migrations/"
test -f "$KL/supabase/seed.sql" && cp "$KL/supabase/seed.sql" "$BACKUP/seed.sql" || true
cp "$KL/supabase/config.toml" "$BACKUP/config.toml"
echo "$TS backup of korean-learning (ref $OLD_REF)" > "$BACKUP/README.txt"

cd "$KL"

# Try full pg_dump via Supabase CLI (needs Docker)
if [ -S "$HOME/.docker/run/docker.sock" ]; then
  npx supabase db dump --linked -f "$BACKUP/schema.sql"
  npx supabase db dump --linked --data-only --use-copy -f "$BACKUP/data.sql"
else
  echo "Docker not running — saved migrations/seed only. See README.txt" >> "$BACKUP/README.txt"
fi

echo "Deleting Supabase project korean-learning ($OLD_REF)..."
npx supabase projects delete "$OLD_REF" --yes

echo "Creating Supabase project korean-flashcards..."
DB_PASS="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
CREATE_JSON="$(npx supabase projects create korean-flashcards --org-id "$ORG" --region ap-northeast-2 --db-password "$DB_PASS" -o json)"
NEW_REF="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$CREATE_JSON")"
export NEW_REF
echo "Created project ref: $NEW_REF"

cd "$KF"
npx supabase link --project-ref "$NEW_REF" --yes
npx supabase db push --yes

# Write local config without printing secrets
python3 <<'PY'
import json, subprocess, os
ref = os.environ["NEW_REF"]
keys = json.loads(subprocess.check_output(
    ["npx", "supabase", "projects", "api-keys", "--project-ref", ref, "-o", "json"],
    cwd="/Users/tensolomon/Documents/GitHub/korean_flashcards",
    text=True,
))
pub = None
for k in keys:
    name = (k.get("name") or "").lower()
    if "publishable" in name or name == "anon":
        pub = k.get("api_key") or k.get("key")
        break
if not pub and keys:
    pub = keys[0].get("api_key") or keys[0].get("key")
if not pub:
    raise SystemExit("publishable key not found")
path = "/Users/tensolomon/Documents/GitHub/korean_flashcards/supabase-config.local.js"
with open(path, "w") as f:
    f.write("window.SUPABASE_CONFIG = {\n")
    f.write(f"  url: 'https://{ref}.supabase.co',\n")
    f.write(f"  anonKey: '{pub}'\n")
    f.write("};\n")
print("WROTE_CONFIG", path)
print("PROJECT_URL", f"https://{ref}.supabase.co")
PY

echo "Done."
