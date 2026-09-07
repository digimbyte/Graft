"""Create a deterministic skills-only submission archive; no MCP registration."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[2]
plugin = root / 'plugins/graft-setup'
manifest = json.loads((plugin / '.codex-plugin/plugin.json').read_text())
assert 'mcpServers' not in manifest and 'apps' not in manifest
assert not (plugin / '.mcp.json').exists()
output = root / '.portable/graft-setup.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
    for source in sorted(plugin.rglob('*')):
        if not source.is_file():
            continue
        info = ZipInfo(source.relative_to(plugin).as_posix(), (1980, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, source.read_text(encoding='utf-8').replace('\r\n', '\n').encode('utf-8'))
digest = hashlib.sha256(output.read_bytes()).hexdigest()
Path(str(output) + '.sha256').write_text(f'{digest}  {output.name}\n')
print(f'{output}: {digest}')
