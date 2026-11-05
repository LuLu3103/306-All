#!/usr/bin/env python3
"""静态文件服务器：把「西综学习台（进度看板 + 学习转盘 + 讲义阅读）」跑在 http://127.0.0.1:8787/。

浏览器禁止 file:// 页面 fetch 本地 PDF，所以讲义阅读必须通过这个本地服务器打开。
用法： python serve.py [端口]
"""
import os
import re
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
DEFAULT_PORT = 8787
CHUNK = 64 * 1024

MIME = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".pdf": "application/pdf",
    ".bcmap": "application/octet-stream",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8",
}


def content_type(path: Path) -> str:
    return MIME.get(path.suffix.lower(), "application/octet-stream")


class Handler(BaseHTTPRequestHandler):
    server_version = "MedLectureViewer/1.0"

    def log_message(self, fmt, *args):  # keep the console quiet-ish
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _resolve(self):
        parsed = urlparse(self.path)
        rel = unquote(parsed.path)
        if rel in ("", "/"):
            rel = "/index.html"
        target = (ROOT / rel.lstrip("/")).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            return None
        if target.is_dir():
            target = target / "index.html"
        return target

    def _not_found(self):
        body = b"404 Not Found"
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_HEAD(self):
        self.do_GET(head_only=True)

    def do_GET(self, head_only=False):
        target = self._resolve()
        if target is None or not target.is_file():
            return self._not_found()

        size = target.stat().st_size
        ctype = content_type(target)
        range_header = self.headers.get("Range")

        start, end = 0, size - 1
        status = 200
        if range_header:
            m = re.match(r"bytes=(\d*)-(\d*)$", range_header.strip())
            if m:
                if m.group(1):
                    start = int(m.group(1))
                if m.group(2):
                    end = int(m.group(2))
                if not m.group(1) and m.group(2):
                    start = max(0, size - int(m.group(2)))
                    end = size - 1
                if start > end or start >= size:
                    self.send_response(416)
                    self.send_header("Content-Range", "bytes */%d" % size)
                    self.end_headers()
                    return
                end = min(end, size - 1)
                status = 206

        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        if status == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.end_headers()

        if head_only:
            return

        try:
            with open(target, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(CHUNK, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (ConnectionError, BrokenPipeError):
            pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", DEFAULT_PORT))
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = "http://127.0.0.1:%d/" % port
    print("=" * 62)
    print("  西综学习台 已启动（进度看板 / 学习转盘 / 讲义阅读）")
    print("  在浏览器打开: %s" % url)
    print("  按 Ctrl+C 停止服务器")
    print("=" * 62)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
