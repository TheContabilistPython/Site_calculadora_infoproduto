from flask import Flask, send_from_directory, request, jsonify, redirect
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
import re
import json
import uuid
import os
from urllib.parse import urljoin, quote_plus
import smtplib
from email.message import EmailMessage
import logging

logging.basicConfig(level=logging.INFO)

BASE = Path(__file__).parent
STATIC = BASE / 'static'

app = Flask(__name__, static_folder=str(STATIC), static_url_path='')

# Database Configuration
# Use SQLite locally if DATABASE_URL is not set, otherwise use the provided URL (Render provides this)
db_url = os.environ.get('DATABASE_URL', 'sqlite:///subscribers.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

@app.before_request
def force_https():
    # Heroku forwards the request protocol in X-Forwarded-Proto
    if request.headers.get('X-Forwarded-Proto') == 'http':
        url = request.url.replace('http://', 'https://', 1)
        return redirect(url, code=301)

# Database Model
class Subscriber(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    empresa = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    whatsapp = db.Column(db.String(20), nullable=True)
    consent = db.Column(db.Boolean, default=True)
    confirmed = db.Column(db.Boolean, default=False)
    confirm_token = db.Column(db.String(100), unique=True, nullable=True)

    def to_dict(self):
        return {
            'empresa': self.empresa,
            'email': self.email,
            'whatsapp': self.whatsapp,
            'consent': self.consent,
            'confirmed': self.confirmed,
            'confirm_token': self.confirm_token
        }

# Create tables on startup - MOVED to create_db.py or manual init
# with app.app_context():
#     db.create_all()

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_whatsapp_number(raw: str) -> str:
    """Normalize WhatsApp input to digits starting with '5511'.

    Rules applied:
    - remove all non-digit characters
    - strip leading zeros
    - remove existing country code '55' if present
    - ensure DDD '11' is present (if missing, it will be prefixed)
    - prefix '55' as country code
    Example: '(11) 9 1234-5678' -> '5511912345678'
    """
    if not raw:
        return ''
    digits = re.sub(r"\D", "", raw)
    digits = digits.lstrip('0')
    # remove leading country code if present
    if digits.startswith('55'):
        digits = digits[2:]
    digits = digits.lstrip('0')
    # ensure DDD 11
    if not digits.startswith('11'):
        digits = '11' + digits
    return '55' + digits

def load_subscribers():
    # Deprecated: Use db.session.query(Subscriber).all() instead
    return [s.to_dict() for s in Subscriber.query.all()]

def save_subscribers(items):
    # Deprecated: No-op, saving is done via db.session.commit()
    pass


def find_subscriber_by_token(token: str):
    return Subscriber.query.filter_by(confirm_token=token).first()


def send_confirmation_email(to_email: str, confirm_url: str) -> bool:
    """Send a confirmation email using SMTP settings from environment variables.

    Environment variables used:
    - SMTP_HOST (required)
    - SMTP_PORT (optional, default 587)
    - SMTP_USER (optional)
    - SMTP_PASS (optional)
    - SMTP_FROM (optional, fallback to SMTP_USER or 'no-reply@example.com')
    - SMTP_USE_TLS (optional, '1' or 'true' to enable STARTTLS; default '1')
    Returns True on success, False on failure (caller should fallback to printing link).
    """
    host = os.environ.get('SMTP_HOST')
    if not host:
        logging.info('SMTP_HOST not configured; skipping send')
        return False

    port = int(os.environ.get('SMTP_PORT', '587'))
    user = os.environ.get('SMTP_USER')
    password = os.environ.get('SMTP_PASS')
    # Use the authenticated SMTP user as the From address when possible to avoid SendAsDenied
    from_addr = user or os.environ.get('SMTP_FROM') or 'no-reply@example.com'
    use_tls = os.environ.get('SMTP_USE_TLS', '1').lower() in ('1', 'true', 'yes')

    msg = EmailMessage()
    msg['Subject'] = 'Confirme sua inscrição — Planejador Tributário'
    msg['From'] = from_addr
    msg['To'] = to_email
    # Use plain text email content (simpler, 'feio' but reliable)
    text = (
        "Olá,\n\n"
        "Clique no link abaixo para confirmar sua inscrição e acessar o Planejador Tributário:\n\n"
        f"{confirm_url}\n\n"
        "Se você não solicitou, ignore esta mensagem.\n"
    )
    msg.set_content(text)

    try:
        logging.info('Connecting to SMTP %s:%s (tls=%s)', host, port, use_tls)
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            smtp.ehlo()
            if use_tls:
                smtp.starttls()
                smtp.ehlo()
            if user and password:
                smtp.login(user, password)
            smtp.send_message(msg)
        logging.info('Confirmation email sent to %s', to_email)
        return True
    except Exception as exc:
        logging.exception('Failed to send confirmation email: %s', exc)
        return False

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(app.static_folder, filename)

@app.route('/subscribe', methods=['POST'])
def subscribe():
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({'error':'JSON inválido'}), 400

    empresa = (data.get('empresa') or '').strip()
    email = (data.get('email') or '').strip()
    whatsapp = (data.get('whatsapp') or '').strip()
    consent = bool(data.get('consent'))

    if not empresa:
        return jsonify({'error':'Empresa é obrigatória'}), 400
    if not EMAIL_RE.match(email):
        return jsonify({'error':'E-mail inválido'}), 400
    if not consent:
        return jsonify({'error':'Consentimento obrigatório'}), 400

    existing = Subscriber.query.filter(Subscriber.email.ilike(email)).first()
    
    if existing:
        if existing.confirmed:
            return jsonify({'message':'E-mail já inscrito e confirmado','confirmed': True}), 200
        else:
            # Resend token
            token = existing.confirm_token or uuid.uuid4().hex
            existing.confirm_token = token
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
                return jsonify({'error':'Não foi possível salvar'}), 500
            
            host = request.host_url or 'http://localhost:5000/'
            confirm_url = urljoin(host, f'confirm/{token}')
            sent = send_confirmation_email(email, confirm_url)
            if not sent:
                print(f'Confirmation link for {email}: {confirm_url}')
            return jsonify({'message':'Verifique seu e-mail para confirmar sua inscrição. (Link impresso no servidor se SMTP não configurado)','confirmed': False}), 200

    # Create new subscriber
    token = uuid.uuid4().hex
    new_sub = Subscriber(
        empresa=empresa,
        email=email,
        whatsapp=normalize_whatsapp_number(whatsapp) if whatsapp else None,
        consent=True,
        confirmed=False,
        confirm_token=token
    )
    
    try:
        db.session.add(new_sub)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error':'Não foi possível salvar'}), 500

    host = request.host_url or 'http://localhost:5000/'
    confirm_url = urljoin(host, f'confirm/{token}')
    sent = send_confirmation_email(email, confirm_url)
    if not sent:
        print(f'Confirmation link for {email}: {confirm_url}')
    return jsonify({'message':'Inscrição recebida. Verifique seu e-mail e confirme para acessar.'}), 200


@app.route('/export', methods=['GET'])
def export_csv():
    subs = Subscriber.query.all()
    # build CSV header
    headers = ['empresa', 'email', 'whatsapp', 'consent']
    lines = [','.join(headers)]
    for s in subs:
        row = [
            '"' + (s.empresa or '') + '"',
            '"' + (s.email or '') + '"',
            '"' + (s.whatsapp or '') + '"',
            '"' + str(bool(s.consent)) + '"'
        ]
        lines.append(','.join(row))

    csv_data = '\n'.join(lines)
    return (csv_data, 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="subscribers.csv"'
    })


@app.route('/confirm/<token>', methods=['GET'])
def confirm(token):
    sub = Subscriber.query.filter_by(confirm_token=token).first()
    if sub:
        sub.confirmed = True
        try:
            db.session.commit()
            email = sub.email
            q = quote_plus(email)
            return redirect(f'/?confirmed_email={q}')
        except Exception:
            db.session.rollback()
            return "Erro ao confirmar. Tente novamente mais tarde.", 500
            
    return "Token inválido ou expirado.", 400


@app.route('/is_confirmed', methods=['GET'])
def is_confirmed():
    email = (request.args.get('email') or '').strip()
    if not email:
        return jsonify({'error':'email missing'}), 400
    
    sub = Subscriber.query.filter(Subscriber.email.ilike(email)).first()
    return jsonify({'confirmed': bool(sub and sub.confirmed)}), 200


@app.route('/resend', methods=['GET'])
def resend():
    """Temporary debug endpoint: resend confirmation email for a saved subscriber.

    Usage: GET /resend?email=you@domain.com
    Returns JSON {sent: bool, message: str}
    """
    email = (request.args.get('email') or '').strip()
    if not email:
        return jsonify({'error': 'email missing'}), 400
    
    sub = Subscriber.query.filter(Subscriber.email.ilike(email)).first()
    if not sub:
        return jsonify({'error': 'not found'}), 404
    
    token = sub.confirm_token or uuid.uuid4().hex
    sub.confirm_token = token
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error':'Não foi possível salvar'}), 500

    host = request.host_url or 'http://localhost:5000/'
    confirm_url = urljoin(host, f'confirm/{token}')
    sent = send_confirmation_email(email, confirm_url)
    if sent:
        return jsonify({'sent': True, 'message': 'E-mail disparado'}), 200
    else:
        print(f'Confirmation link for {email}: {confirm_url}')
        return jsonify({'sent': False, 'message': 'Envio falhou; link impresso no servidor'}), 200


@app.route('/debug/subscribers', methods=['GET'])
def debug_subscribers():
    """Temporary debug route: return the list of subscriber emails the server currently sees."""
    subs = Subscriber.query.all()
    emails = [s.email for s in subs]
    return jsonify({'count': len(emails), 'emails': emails}), 200

if __name__ == '__main__':
    # Print local IPv4 addresses to help connect from other machines on the same LAN
    try:
        import socket
        host_name = socket.gethostname()
        addrs = socket.getaddrinfo(host_name, None)
        ipv4s = []
        for a in addrs:
            fam, _, _, _, sockaddr = a
            if fam == socket.AF_INET:
                ip = str(sockaddr[0])
                # skip loopback
                if isinstance(ip, str) and not ip.startswith('127.') and ip not in ipv4s:
                    ipv4s.append(ip)
        if ipv4s:
            print('Local LAN IPv4 addresses detected:')
            for ip in ipv4s:
                print('  http://' + ip + ':5000')
        else:
            print('No non-loopback IPv4 found; you can still try http://<this-host-ip>:5000')
    except Exception:
        pass
    # Bind to all interfaces so other machines on the LAN can access (for testing only)
    # Print SMTP debug info (do not print passwords)
    try:
        logging.info('Startup SMTP check: SMTP_HOST=%s SMTP_USER=%s', os.environ.get('SMTP_HOST'), os.environ.get('SMTP_USER'))
    except Exception:
        pass
    app.run(host='0.0.0.0', port=5000, debug=False)