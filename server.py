import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os

# --- Load Environment Variables (.env) ---
def load_env():
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    if '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key.strip()] = value.strip().strip("'\"")

load_env()
API_KEY = os.environ.get('OPENAI_API_KEY')

if not API_KEY:
    print("Warning: OPENAI_API_KEY is not set in the .env file.")

PORT = 8080

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    
    # Custom GET for fallback to index.html if using routing
    def do_GET(self):
        return super().do_GET()

    # Proxy POST requests sent to /api/chat
    def do_POST(self):
        if self.path == '/api/chat':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            if not API_KEY:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': {'message': "API Key not configured on the server."}}).encode('utf-8'))
                return

            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', data=post_data)
            req.add_header('Content-Type', 'application/json')
            req.add_header('Authorization', f'Bearer {API_KEY}')
            
            try:
                with urllib.request.urlopen(req) as response:
                    status = response.status
                    body = response.read()
                    
                    self.send_response(status)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(body)
            except urllib.error.HTTPError as e:
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(e.read())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': {'message': str(e)}}).encode('utf-8'))
        else:
            self.send_error(404, 'Not Found')

# --- Start Server ---
with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
    print(f"Serving on port {PORT} at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        httpd.shutdown()
