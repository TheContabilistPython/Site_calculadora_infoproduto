# Planejador Tributário — Landing (projeto inicial)

Projeto mínimo com landing page em HTML/CSS/JS e backend em Python (Flask) para receber inscrições por e-mail.

Como executar (Windows PowerShell):

1. Crie e ative um ambiente virtual (opcional, recomendado):

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
```

2. Instale dependências:

```powershell
pip install -r requirements.txt
```

3. Inicie o servidor:

```powershell
python app.py
```

4. Abra http://127.0.0.1:5000 no navegador.

O endpoint POST /subscribe aceita JSON: {"empresa":"...","email":"...","whatsapp":"...","consent":true}

Para exportar os inscritos como CSV (download):

GET /export

Retorna um arquivo `subscribers.csv` com as colunas: empresa, email, whatsapp, consent.

Normalização de WhatsApp:
- O backend normaliza números de WhatsApp para o formato que começa com `5511...` removendo caracteres não numéricos, eliminando prefixos repetidos e garantindo DDD `11` e country code `55`.
