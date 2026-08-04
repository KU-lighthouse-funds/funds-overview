#!/usr/bin/env python3
"""Local preview server with live reload. Stdlib only."""
from __future__ import annotations

import http.server
import os
import socketserver
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8080
WATCH_SUFFIXES = {".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp"}

_reload_token = time.time()

LIVERELOAD_JS = b"""(() => {
  let v = 0;
  setInterval(async () => {
    try {
      const r = await fetch("/__reload", { cache: "no-store" });
      const n = Number(await r.text());
      if (v && n > v) location.reload();
      v = n;
    } catch (_) {}
  }, 700);
})();"""


def scan_files() -> None:
    global _reload_token
    latest = _reload_token
    for path in ROOT.rglob("*"):
        if path.is_file() and path.suffix.lower() in WATCH_SUFFIXES:
            latest = max(latest, path.stat().st_mtime)
    _reload_token = latest


def watcher() -> None:
    while True:
        scan_files()
        time.sleep(0.6)


class DevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        if args and isinstance(args[0], str) and "/__reload" in args[0]:
            return
        super().log_message(format, *args)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/__reload":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(str(_reload_token).encode())
            return

        if self.path.split("?", 1)[0] == "/__livereload.js":
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.end_headers()
            self.wfile.write(LIVERELOAD_JS)
            return

        fs_path = self.translate_path(self.path)
        if os.path.isdir(fs_path):
            fs_path = os.path.join(fs_path, "index.html")

        if os.path.isfile(fs_path) and fs_path.lower().endswith(".html"):
            content = Path(fs_path).read_bytes()
            if b"</body>" in content and b"/__livereload.js" not in content:
                inject = b'<script src="/__livereload.js"></script>'
                content = content.replace(b"</body>", inject + b"</body>", 1)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        super().do_GET()


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Local preview with live reload")
    parser.add_argument("--port", type=int, default=PORT, help="Port (default 8080)")
    parser.add_argument("--no-open", action="store_true", help="Do not open a browser tab")
    args = parser.parse_args()

    os.chdir(ROOT)
    scan_files()
    threading.Thread(target=watcher, daemon=True).start()

    url = f"http://localhost:{args.port}/"
    print(f"Local preview: {url}")
    print("Live reload on — save HTML/CSS/JS/JSON and the browser refreshes.")
    print("Press Ctrl+C to stop.")

    if not args.no_open:
        webbrowser.open(url)

    with socketserver.TCPServer(("", args.port), DevHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
