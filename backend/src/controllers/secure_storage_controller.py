from datetime import datetime
from src.lib.db import get_db
from src.lib.crypto_client import backup_user_state, restore_user_state


async def setup_secure_storage(user_id: str, pin: str):
    db = get_db()

    existing = await db["secure_storage"].find_one({"userId": user_id})
    if existing:
        return {"error": "Secure storage already configured for this user"}, 409

    # call crypto service to produce encrypted user crypto state
    crypto_state = await backup_user_state(user_id, pin)

    now = datetime.utcnow()
    payload = {
        "userId": user_id,
        "encryptedState": crypto_state["encryptedState"],
        "salt": crypto_state["salt"],
        "iv": crypto_state["iv"],
        "authTag": crypto_state["authTag"],
        "version": crypto_state.get("version", 1),
        "createdAt": now,
        "updatedAt": now
    }

    await db["secure_storage"].insert_one(payload)

    return {
        "message": "Secure storage setup complete",
        "version": payload["version"],
        "userId": user_id,
        "updatedAt": now
    }, 201


async def backup_secure_storage(user_id: str, pin: str):
    db = get_db()

    existing = await db["secure_storage"].find_one({"userId": user_id})
    if not existing:
        return {"error": "No secure storage record found for this user"}, 404

    crypto_state = await backup_user_state(user_id, pin)
    now = datetime.utcnow()

    update = {
        "$set": {
            "encryptedState": crypto_state["encryptedState"],
            "salt": crypto_state["salt"],
            "iv": crypto_state["iv"],
            "authTag": crypto_state["authTag"],
            "version": crypto_state.get("version", existing.get("version", 1)),
            "updatedAt": now
        }
    }

    await db["secure_storage"].update_one({"userId": user_id}, update)

    return {
        "message": "Secure storage backup updated",
        "version": update["$set"]["version"],
        "userId": user_id,
        "updatedAt": now
    }, 200


async def restore_secure_storage(user_id: str, pin: str):
    db = get_db()

    existing = await db["secure_storage"].find_one({"userId": user_id})
    if not existing:
        return {"error": "No secure storage record found for this user"}, 404

    # call crypto service restore logic
    await restore_user_state(
        user_id,
        pin,
        existing["encryptedState"],
        existing["salt"],
        existing["iv"],
        existing["authTag"]
    )

    now = datetime.utcnow()
    await db["secure_storage"].update_one({"userId": user_id}, {"$set": {"updatedAt": now}})

    return {"message": "Secure storage restored", "userId": user_id, "updatedAt": now}, 200


async def status_secure_storage(user_id: str):
    db = get_db()
    existing = await db["secure_storage"].find_one({"userId": user_id})

    if not existing:
        return {"userId": user_id, "configured": False}, 200

    return {
        "userId": user_id,
        "configured": True,
        "createdAt": existing.get("createdAt"),
        "updatedAt": existing.get("updatedAt")
    }, 200
