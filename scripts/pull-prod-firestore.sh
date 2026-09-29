#!/usr/bin/env bash
# Copies production Firestore into .emulator-data/ so `npm run emulators`
# starts with real data. Requires gcloud authenticated with an owner account.
#
#   npm run pull-prod-data
#
# The export goes through gs://<bucket>/firestore-exports/<timestamp> (the only
# destination Firestore can export to) and is deleted from the bucket once
# downloaded. The previous .emulator-data/ is kept as .emulator-data.bak/.
set -euo pipefail

PROJECT=lingarten-efc0b
BUCKET=gs://lingarten-efc0b.appspot.com
DATA_DIR=.emulator-data
FIRESTORE_PORT=8080

cd "$(dirname "$0")/.."

if ! command -v gcloud >/dev/null; then
  echo "Falta gcloud: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

# A running emulator rewrites .emulator-data/ on exit and would discard the import.
if (echo > /dev/tcp/127.0.0.1/$FIRESTORE_PORT) 2>/dev/null; then
  echo "Detén los emuladores (Ctrl+C en 'npm run emulators') antes de importar." >&2
  exit 1
fi

name="prod-$(date +%Y%m%d-%H%M%S)"
remote="$BUCKET/firestore-exports/$name"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

echo "Exportando Firestore de $PROJECT a $remote ..."
gcloud firestore export "$remote" --project "$PROJECT"

echo "Descargando exportación ..."
mkdir -p "$staging/firestore_export"
gcloud storage cp --recursive "$remote/*" "$staging/firestore_export/" --project "$PROJECT"
gcloud storage rm --recursive "$remote" --project "$PROJECT"

cat > "$staging/firebase-export-metadata.json" <<EOF
{
  "version": "$(firebase --version)",
  "firestore": {
    "path": "firestore_export",
    "metadata_file": "firestore_export/$name.overall_export_metadata"
  }
}
EOF

rm -rf "$DATA_DIR.bak"
if [ -d "$DATA_DIR" ]; then
  mv "$DATA_DIR" "$DATA_DIR.bak"
fi
mv "$staging" "$DATA_DIR"
trap - EXIT

echo "Listo: datos de producción en $DATA_DIR/ (respaldo anterior en $DATA_DIR.bak/)."
echo "Arranca los emuladores con: npm run emulators"
