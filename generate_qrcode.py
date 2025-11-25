import qrcode

# URL para o QR Code
url = "https://calculadora.prontasc.com.br"

# Configuração do QR Code
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=10,
    border=4,
)

# Adiciona os dados
qr.add_data(url)
qr.make(fit=True)

# Cria a imagem
img = qr.make_image(fill_color="black", back_color="white")

# Salva o arquivo
filename = "qrcode_calculadora.png"
img.save(filename)

print(f"QR Code gerado com sucesso: {filename}")
