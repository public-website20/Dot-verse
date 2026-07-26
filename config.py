from dotenv import load_dotenv
import os

load_dotenv()

# توکن ربات تلگرام
BOT_TOKEN = os.getenv("BOT_TOKEN")

# آدرس وب‌اپلیکیشن بازی (می‌توانید مستقیم لینک دهید یا از .env بخوانید)
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://your-username.github.io/dotverse")