from flask import Flask, jsonify, request
from flask_cors import CORS
import subprocess

app = Flask(__name__)
CORS(app)

@app.route('/scan-wifi')
def scan_wifi():
    try:
        result = subprocess.run(
            ['nmcli', '-t', '-f', 'SSID', 'dev', 'wifi'],
            capture_output=True, text=True
        )
        networks = [ssid for ssid in result.stdout.split('\n') if ssid]
        return jsonify({'networks': networks})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/connect-wifi', methods=['POST'])
def connect_wifi():
    data = request.json
    ssid = data.get('ssid')
    password = data.get('password')
    try:
        cmd = ['nmcli', 'dev', 'wifi', 'connect', ssid]
        if password:
            cmd += ['password', password]
        subprocess.run(cmd, check=True)
        return jsonify({'status': 'connected'})
    except subprocess.CalledProcessError as e:
        return jsonify({'status': 'failed', 'error': str(e)}), 400

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
