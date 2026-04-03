#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
source "${ROOT_DIR}/scripts/private_server/load_server_profile.sh"

CPU_LIMIT="${1:-${SCREEPS_TEST_CPU:-20}}"
SERVER_ROOT="${SCREEPS_PRIVATE_SERVER_DIR}"
SERVER_ENV_FILE="${SERVER_ROOT}/.local-dev.env"
SCREEPSRC_FILE="${SERVER_ROOT}/.screepsrc"

cat > "${SERVER_ENV_FILE}" <<EOF
LOCAL_NOAUTH_CPU=${CPU_LIMIT}
EOF

python3 - "${SCREEPSRC_FILE}" "${CPU_LIMIT}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
cpu = sys.argv[2]
lines = path.read_text(encoding="utf8").splitlines()

section_start = None
section_end = len(lines)
for i, line in enumerate(lines):
    if line.strip().lower() == "[auth]":
        section_start = i
        break

if section_start is not None:
    for i in range(section_start + 1, len(lines)):
        if lines[i].strip().startswith("[") and lines[i].strip().endswith("]"):
            section_end = i
            break
    replaced = False
    for i in range(section_start + 1, section_end):
        if lines[i].split("=", 1)[0].strip() == "registerCpu":
            lines[i] = f"registerCpu = {cpu}"
            replaced = True
            break
    if not replaced:
        lines.insert(section_start + 1, f"registerCpu = {cpu}")
else:
    if lines and lines[-1].strip():
        lines.append("")
    lines.extend(["[auth]", f"registerCpu = {cpu}"])

path.write_text("\n".join(lines) + "\n", encoding="utf8")
PY

echo "wrote ${SERVER_ENV_FILE}"
echo "updated ${SCREEPSRC_FILE}"
echo "restart the private server for LOCAL_NOAUTH_CPU=${CPU_LIMIT} to take effect"
