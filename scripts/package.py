from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

DIST = Path(__file__).resolve().parents[1] / "dist"

for target in ("chromium", "firefox"):
    source = DIST / target
    archive = DIST / f"gta6-filter-{target}.zip"
    with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=9) as package:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                package.write(path, path.relative_to(source))
    print(f"Packaged {archive}")
