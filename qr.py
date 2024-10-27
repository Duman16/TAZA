import qrcode

# Введите вашу ссылку
url = "https://t.me/TAZA_testbot"

# Создаем QR-код
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
)
qr.add_data(url)
qr.make(fit=True)

# Создаем изображение
img = qr.make_image(fill="black", back_color="white")

# Сохраняем изображение в файл
img.save("taza_testbot_qr.png")
