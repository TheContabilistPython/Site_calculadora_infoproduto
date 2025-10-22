import os, smtplib
host = os.environ.get('SMTP_HOST')
port = int(os.environ.get('SMTP_PORT', '587'))
user = os.environ.get('SMTP_USER')
password = os.environ.get('SMTP_PASS')
use_tls = os.environ.get('SMTP_USE_TLS', '1').lower() in ('1','true','yes')

print('SMTP_HOST=', host, 'PORT=', port, 'USER=', user, 'USE_TLS=', use_tls)
try:
    with smtplib.SMTP(host, port, timeout=20) as s:
        s.ehlo()
        if use_tls:
            s.starttls()
            s.ehlo()
        if user and password:
            s.login(user, password)
        print('Conexão/Autenticação OK')
except Exception as e:
    import traceback
    traceback.print_exc()
    print('Falha na conexão/autenticação:', e)