from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InlineQueryResultArticle, InputTextMessageContent, WebAppInfo
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    CallbackQueryHandler,
    MessageHandler,
    InlineQueryHandler,
    filters,
)
import uuid

from config import BOT_TOKEN
from game.handlers import (
    create_game,
    join_game,
    start_game,
    cancel_game,
    show_help,
    show_settings,
    show_about,
    select_grid_size,
    set_grid_size,
)

CORRECT_PASSWORD = "Dv032000vD"

# آدرس وب‌سایت شما روی گیت‌هاب پیج
WEB_APP_URL = "https://public-website20.github.io/Dot-verse/"


async def start_or_game_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    if not context.bot_data.get(f"authenticated_{user_id}", False):
        context.user_data["waiting_for_password"] = True
        await update.message.reply_text(
            "🔒 این ربات محافظت‌شده است.\n\nلطفاً برای شروع و استفاده از ربات، رمز عبور را ارسال کنید:"
        )
        return

    # استفاده از دکمه Web App برای باز کردن سایت درون تلگرام
    keyboard = [
        [InlineKeyboardButton("🎮 ورود به محیط بازی (مینی‌اپ)", web_app=WebAppInfo(url=WEB_APP_URL))],
        [InlineKeyboardButton("📖 آموزش", callback_data="help")],
        [InlineKeyboardButton("⚙️ تنظیمات", callback_data="settings")],
        [InlineKeyboardButton("ℹ️ درباره بازی", callback_data="about")],
    ]

    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "🎮 به DotVerse خوش اومدی!\n\n"
        "برای شروع بازی، روی گزینه زیر کلیک کن تا محیط بازی باز شود:",
        reply_markup=reply_markup,
    )


async def check_password(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id

    if context.user_data.get("waiting_for_password", False):
        password_input = update.message.text

        if password_input == CORRECT_PASSWORD:
            context.bot_data[f"authenticated_{user_id}"] = True
            context.user_data["waiting_for_password"] = False
            await update.message.reply_text(
                "✅ رمز عبور صحیح است!\n\nاکنون می‌توانید از ربات استفاده کنید یا دستور `/start` را بزنید."
            )
        else:
            await update.message.reply_text("❌ رمز عبور اشتباه است. لطفاً دوباره تلاش کنید:")


async def inline_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.inline_query.from_user.id

    if not context.bot_data.get(f"authenticated_{user_id}", False):
        results = [
            InlineQueryResultArticle(
                id=str(uuid.uuid4()),
                title="🔒 ربات قفل است (نیاز به رمز ورود)",
                description="برای استفاده از ربات ابتدا در پی‌وی به ربات رمز را بدهید.",
                input_message_content=InputTextMessageContent(
                    message_text="❌ این ربات محافظت‌شده است. لطفاً ابتدا به پی‌وی ربات بروید و با وارد کردن رمز عبور آن را فعال کنید."
                )
            )
        ]
        await update.inline_query.answer(results, cache_time=1)
        return

    # ارسال مینی‌اپ از طریق اینلاین در گروه یا چت دوستان
    keyboard = [
        [InlineKeyboardButton("🎮 باز کردن مینی‌اپ بازی", web_app=WebAppInfo(url=WEB_APP_URL))]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    results = [
        InlineQueryResultArticle(
            id=str(uuid.uuid4()),
            title="🎮 بازی DotVerse",
            description="برای باز کردن محیط بازی کلیک کنید",
            input_message_content=InputTextMessageContent(
                message_text="🎮 به بازی DotVerse خوش آمدید!\n\nبرای ورود به محیط بازی روی دکمه زیر کلیک کنید:",
                reply_markup=reply_markup
            ),
            reply_markup=reply_markup
        )
    ]
    await update.inline_query.answer(results, cache_time=1)


def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start_or_game_menu))
    app.add_handler(CommandHandler("game", start_or_game_menu))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, check_password))
    app.add_handler(InlineQueryHandler(inline_query_handler))

    app.add_handler(CallbackQueryHandler(show_help, pattern="^help$"))
    app.add_handler(CallbackQueryHandler(show_settings, pattern="^settings$"))
    app.add_handler(CallbackQueryHandler(show_about, pattern="^about$"))

    print("Bot is running...")
    app.run_polling()


if __name__ == "__main__":
    main()