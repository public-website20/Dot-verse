from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)

from telegram.ext import ContextTypes

from config import WEBAPP_URL

from game.room import (
    create_room,
    get_room,
    room_exists,
    add_player,
    build_players_text,
    player_count,
)

from game.board import (
    create_board,
    get_board_text,
)


def lobby_keyboard():

    keyboard = [
        [
            InlineKeyboardButton(
                "🎲 پیوستن به بازی",
                callback_data="join_game",
            )
        ],
        [
            InlineKeyboardButton(
                "🔒 اتمام ورود / انتخاب ابعاد",
                callback_data="select_grid_size",
            )
        ],
        [
            InlineKeyboardButton(
                "❌ لغو بازی",
                callback_data="cancel_game",
            )
        ],
    ]

    return InlineKeyboardMarkup(keyboard)


def grid_size_keyboard():

    keyboard = [
        [
            InlineKeyboardButton("8*8", callback_data="set_size_8"),
            InlineKeyboardButton("10*10", callback_data="set_size_10"),
        ],
        [
            InlineKeyboardButton("12*12", callback_data="set_size_12"),
            InlineKeyboardButton("14*14", callback_data="set_size_14"),
        ],
    ]

    return InlineKeyboardMarkup(keyboard)


def webapp_keyboard(url):

    keyboard = [
        [
            InlineKeyboardButton(
                "🎮 ورود به وب‌اپ بازی",
                web_app=WebAppInfo(url=url),
            )
        ]
    ]

    return InlineKeyboardMarkup(keyboard)


def lobby_text(room):

    return (
        "🎮 DotVerse\n\n"

        f"👑 سازنده:\n"
        f"{room['host_name']}\n\n"

        f"👥 بازیکنان ({player_count(room)}/20)\n\n"

        f"{build_players_text(room)}"

        "\n━━━━━━━━━━━━━━\n\n"

        "⏳ منتظر ورود بازیکنان..."
    )


async def create_game(update: Update, context: ContextTypes.DEFAULT_TYPE):

    query = update.callback_query

    await query.answer()

    chat = query.message.chat

    user = query.from_user

    if room_exists(context.bot_data, chat.id):

        await query.answer(
            "❌ داخل این گروه قبلاً یک بازی ساخته شده است.",
            show_alert=True,
        )

        return

    create_room(
        context.bot_data,
        chat.id,
        user.id,
        user.first_name,
        query.message.message_id,
    )

    room = get_room(
        context.bot_data,
        chat.id,
    )

    await query.edit_message_text(
        text=lobby_text(room),
        reply_markup=lobby_keyboard(),
    )


async def join_game(update: Update, context: ContextTypes.DEFAULT_TYPE):

    query = update.callback_query
    await query.answer()

    chat = query.message.chat
    user = query.from_user

    room = get_room(
        context.bot_data,
        chat.id,
    )

    if room is None:

        await query.answer(
            "❌ هیچ بازی فعالی وجود ندارد.",
            show_alert=True,
        )

        return

    if room.get("is_closed", False):

        await query.answer(
            "❌ ورود به لابی توسط سازنده قفل شده است.",
            show_alert=True,
        )

        return

    success = add_player(
        room,
        user.id,
        user.first_name,
    )

    if not success:

        await query.answer(
            "❌ قبلاً وارد بازی شده‌ای یا اتاق پر است.",
            show_alert=True,
        )

        return

    await query.edit_message_text(
        text=lobby_text(room),
        reply_markup=lobby_keyboard(),
    )


async def select_grid_size(update: Update, context: ContextTypes.DEFAULT_TYPE):

    query = update.callback_query
    await query.answer()

    chat = query.message.chat
    user = query.from_user

    room = get_room(
        context.bot_data,
        chat.id,
    )

    if room is None:

        await query.answer(
            "❌ بازی پیدا نشد.",
            show_alert=True,
        )

        return

    if user.id != room["host_id"]:

        await query.answer(
            "❌ فقط سازنده بازی می‌تواند لابی را ببندد و ابعاد زمین را انتخاب کند.",
            show_alert=True,
        )

        return

    if player_count(room) < 2:

        await query.answer(
            "❌ حداقل باید دو بازیکن داخل بازی باشند.",
            show_alert=True,
        )

        return

    room["is_closed"] = True

    await query.edit_message_text(
        text=(
            "🔒 ورود به لابی قفل شد.\n\n"
            f"👑 سازنده ({room['host_name']})، لطفاً ابعاد زمین بازی را انتخاب کن:"
        ),
        reply_markup=grid_size_keyboard(),
    )


async def set_grid_size(update: Update, context: ContextTypes.DEFAULT_TYPE):

    query = update.callback_query
    await query.answer()

    chat = query.message.chat
    user = query.from_user

    room = get_room(
        context.bot_data,
        chat.id,
    )

    if room is None:

        await query.answer(
            "❌ بازی پیدا نشد.",
            show_alert=True,
        )

        return

    if user.id != room["host_id"]:

        await query.answer(
            "❌ فقط سازنده بازی می‌تواند ابعاد زمین را تعیین کند.",
            show_alert=True,
        )

        return

    size = query.data.replace("set_size_", "")
    room["grid_size"] = f"{size}*{size}"
    room["status"] = "playing"

    game_url = f"{WEBAPP_URL}?room_id={chat.id}&size={size}"

    await query.edit_message_text(
        text=(
            "🎮 DotVerse\n\n"
            f"✅ ابعاد زمین انتخاب شد: {room['grid_size']}\n"
            f"👥 تعداد بازیکنان: {player_count(room)}\n\n"
            "روی دکمه زیر کلیک کنید تا وارد بازی شوید:"
        ),
        reply_markup=webapp_keyboard(game_url),
    )


async def start_game(update: Update, context: ContextTypes.DEFAULT_TYPE):

    query = update.callback_query
    await query.answer()

    chat = query.message.chat

    room = get_room(
        context.bot_data,
        chat.id,
    )

    if room is None:

        await query.answer(
            "❌ بازی پیدا نشد.",
            show_alert=True,
        )

        return

    size = room.get("grid_size", "8*8").split("*")[0]
    game_url = f"{WEBAPP_URL}?room_id={chat.id}&size={size}"

    await query.edit_message_text(
        text=(
            "🎮 DotVerse\n\n"
            "✅ بازی آماده است.\n"
            "روی دکمه زیر کلیک کنید تا وارد بازی شوید:"
        ),
        reply_markup=webapp_keyboard(game_url),
    )


async def cancel_game(update: Update, context: ContextTypes.DEFAULT_TYPE):

    query = update.callback_query
    await query.answer()

    chat = query.message.chat
    user = query.from_user

    room = get_room(
        context.bot_data,
        chat.id,
    )

    if room and user.id == room["host_id"]:

        if chat.id in context.bot_data:
            del context.bot_data[chat.id]

        await query.edit_message_text(
            "❌ بازی توسط سازنده لغو شد."
        )

    else:

        await query.answer(
            "❌ فقط سازنده بازی می‌تواند بازی را لغو کند.",
            show_alert=True,
        )


async def show_help(update: Update, context: ContextTypes.DEFAULT_TYPE):

    query = update.callback_query
    await query.answer()

    await query.edit_message_text(
        "📖 آموزش بازی\n\n"
        "۱. بازیکنان وارد لابی می‌شوند.\n"
        "۲. سازنده لابی را بسته و ابعاد زمین را مشخص می‌کند.\n"
        "۳. همگی وارد وب‌اپ شده و به نوبت خط‌ها را وصل می‌کنند."
    )


async def show_settings(update: Update, context: ContextTypes.DEFAULT_TYPE):

    query = update.callback_query
    await query.answer()

    await query.edit_message_text(
        "⚙️ تنظیمات\n\n"
        "تنظیمات بازی به زودی اضافه می‌شود."
    )


async def show_about(update: Update, context: ContextTypes.DEFAULT_TYPE):

    query = update.callback_query
    await query.answer()

    await query.edit_message_text(
        "🎮 DotVerse\n\n"
        "بازی انلاین نقطه‌ها در تلگرام."
    )