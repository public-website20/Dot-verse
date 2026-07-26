MAX_PLAYERS = 20


def get_rooms(bot_data):
    """تمام اتاق‌ها را برمی‌گرداند."""

    if "rooms" not in bot_data:
        bot_data["rooms"] = {}

    return bot_data["rooms"]


def create_room(bot_data, chat_id, host_id, host_name, message_id):
    """ایجاد یک اتاق جدید."""

    rooms = get_rooms(bot_data)

    rooms[chat_id] = {
        "chat_id": chat_id,
        "host_id": host_id,
        "host_name": host_name,
        "message_id": message_id,
        "status": "waiting",
        "is_closed": False,
        "grid_size": "8*8",
        "board": None,
        "turn": 0,
        "players": [
            {
                "id": host_id,
                "name": host_name,
            }
        ],
    }


def get_room(bot_data, chat_id):
    """برگرداندن اطلاعات یک اتاق."""

    rooms = get_rooms(bot_data)

    return rooms.get(chat_id)


def room_exists(bot_data, chat_id):
    """آیا داخل این گروه اتاق وجود دارد؟"""

    rooms = get_rooms(bot_data)

    return chat_id in rooms


def player_exists(room, user_id):
    """بررسی وجود بازیکن داخل اتاق."""

    for player in room["players"]:
        if player["id"] == user_id:
            return True

    return False


def add_player(room, user_id, user_name):
    """اضافه کردن بازیکن به اتاق."""

    if room.get("is_closed", False):
        return False

    if player_exists(room, user_id):
        return False

    if len(room["players"]) >= MAX_PLAYERS:
        return False

    room["players"].append(
        {
            "id": user_id,
            "name": user_name,
        }
    )

    return True


def remove_player(room, user_id):
    """حذف بازیکن."""

    room["players"] = [
        player
        for player in room["players"]
        if player["id"] != user_id
    ]


def player_count(room):
    """تعداد بازیکنان."""

    return len(room["players"])


def room_is_full(room):
    """آیا اتاق پر شده؟"""

    return player_count(room) >= MAX_PLAYERS


def build_players_text(room):
    """ساخت متن لیست بازیکنان."""

    text = ""

    for index, player in enumerate(room["players"], start=1):
        text += f"{index}️⃣ {player['name']}\n"

    return text