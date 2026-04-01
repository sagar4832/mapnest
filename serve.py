"""GeoVec local dev server — Python 3 (no Node.js required)"""
import http.server, socketserver, webbrowser, threading, os, sys

PORT = 3000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Force UTF-8 output so Unicode chars don't crash on Windows cp1252
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    # Silence the request log to avoid Windows encoding issues
    def log_message(self, fmt, *args):
        pass

def open_browser():
    import time
    time.sleep(1.0)
    webbrowser.open(f'http://localhost:{PORT}')

print(f"GeoVec running at http://localhost:{PORT}")
print("Press Ctrl+C to stop.\n")
threading.Thread(target=open_browser, daemon=True).start()

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("Server stopped.")
