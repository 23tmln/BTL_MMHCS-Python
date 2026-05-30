from bson import ObjectId
from datetime import datetime
from src.lib.cloudinary import upload_image
from src.lib.db import get_db
from src.lib.socket import emit_new_group_message


def _serialize_user(user: dict) -> dict:
    return {
        '_id': str(user['_id']),
        'fullName': user.get('fullName', ''),
        'email': user.get('email', ''),
        'profilePic': user.get('profilePic', ''),
    }


def _serialize_group(group: dict, members: list[dict] | None = None, last_message_date=None) -> dict:
    result = {
        '_id': str(group['_id']),
        'name': group['name'],
        'adminId': str(group['adminId']),
        'memberIds': [str(member_id) for member_id in group.get('memberIds', [])],
        'createdAt': group.get('createdAt').isoformat() if isinstance(group.get('createdAt'), datetime) else group.get('createdAt'),
        'updatedAt': group.get('updatedAt').isoformat() if isinstance(group.get('updatedAt'), datetime) else group.get('updatedAt'),
    }
    if members is not None:
        result['members'] = [_serialize_user(member) for member in members]
    if last_message_date is not None:
        result['lastMessageDate'] = last_message_date.isoformat() if isinstance(last_message_date, datetime) else last_message_date
    return result


def _serialize_group_message(message: dict) -> dict:
    return {
        '_id': str(message['_id']),
        'groupId': str(message['groupId']),
        'senderId': str(message['senderId']),
        'ciphertext': message.get('ciphertext'),
        'mlsEpoch': message.get('mlsEpoch'),
        'contentType': message.get('contentType', 'mls_application'),
        'image': message.get('image'),
        'createdAt': message.get('createdAt').isoformat() if isinstance(message.get('createdAt'), datetime) else message.get('createdAt'),
    }


def _serialize_mls_credential(credential: dict) -> dict:
    return {
        '_id': str(credential['_id']),
        'userId': str(credential['userId']),
        'credential': credential.get('credential'),
        'signatureKey': credential.get('signatureKey'),
        'createdAt': credential.get('createdAt').isoformat() if isinstance(credential.get('createdAt'), datetime) else credential.get('createdAt'),
    }


def _serialize_mls_key_package(key_package: dict) -> dict:
    return {
        '_id': str(key_package['_id']),
        'userId': str(key_package['userId']),
        'keyPackage': key_package.get('keyPackage'),
        'keyPackageRef': key_package.get('keyPackageRef'),
        'cipherSuite': key_package.get('cipherSuite'),
        'used': key_package.get('used', False),
        'createdAt': key_package.get('createdAt').isoformat() if isinstance(key_package.get('createdAt'), datetime) else key_package.get('createdAt'),
    }


async def _get_group_for_member(group_id: str, user_id: str):
    if not ObjectId.is_valid(group_id) or not ObjectId.is_valid(user_id):
        return None
    db = get_db()
    return await db['groups'].find_one({'_id': ObjectId(group_id), 'memberIds': ObjectId(user_id)})


async def create_group(user_id: str, name: str, member_ids: list[str]):
    try:
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)

        group_name = (name or '').strip()
        if not group_name:
            return ({'error': 'Group name is required'}, 400)

        valid_member_ids = []
        for member_id in member_ids or []:
            if not ObjectId.is_valid(member_id):
                return ({'error': 'Invalid member ID'}, 400)
            valid_member_ids.append(ObjectId(member_id))

        creator_id = ObjectId(user_id)
        member_id_set = {creator_id, *valid_member_ids}
        db = get_db()

        existing_members = await db['users'].find({'_id': {'$in': list(member_id_set)}}, {'password': 0}).to_list(None)
        if len(existing_members) != len(member_id_set):
            return ({'error': 'One or more members were not found'}, 404)

        now = datetime.now()
        group_doc = {
            'name': group_name,
            'adminId': creator_id,
            'memberIds': list(member_id_set),
            'createdAt': now,
            'updatedAt': now,
        }
        result = await db['groups'].insert_one(group_doc)
        group_doc['_id'] = result.inserted_id
        return (_serialize_group(group_doc, existing_members), 201)
    except Exception as e:
        print(f'Error in create_group: {e}')
        return ({'error': 'Internal server error'}, 500)


async def save_mls_credential(user_id: str, data: dict):
    try:
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)

        payload = data or {}
        credential = payload.get('credential')
        public_key = payload.get('publicKey')
        cipher_suite = payload.get('cipherSuite')
        if not credential or not public_key or not cipher_suite:
            return ({'error': 'MLS credential, public key, and cipher suite are required'}, 400)

        db = get_db()
        now = datetime.now()
        credential_doc = {
            'userId': ObjectId(user_id),
            'credential': credential,
            'publicKey': public_key,
            'cipherSuite': cipher_suite,
            'updatedAt': now,
        }
        existing = await db['mls_credentials'].find_one({'userId': ObjectId(user_id)})
        if existing:
            await db['mls_credentials'].update_one({'userId': ObjectId(user_id)}, {'$set': credential_doc})
        else:
            credential_doc['createdAt'] = now
            await db['mls_credentials'].insert_one(credential_doc)
        return ({'message': 'MLS credential saved'}, 200)
    except Exception as e:
        print(f'Error in save_mls_credential: {e}')
        return ({'error': 'Internal server error'}, 500)


async def save_mls_key_package(user_id: str, data: dict):
    try:
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)

        payload = data or {}
        key_package = payload.get('keyPackage')
        cipher_suite = payload.get('cipherSuite')
        if not key_package:
            return ({'error': 'MLS KeyPackage is required'}, 400)
        if not cipher_suite:
            return ({'error': 'MLS cipher suite is required'}, 400)

        db = get_db()
        now = datetime.now()
        await db['mls_key_packages'].insert_one({
            'userId': ObjectId(user_id),
            'keyPackage': key_package,
            'keyPackageRef': payload.get('keyPackageRef'),
            'cipherSuite': cipher_suite,
            'used': False,
            'createdAt': now,
        })
        return ({'message': 'MLS KeyPackage saved'}, 201)
    except Exception as e:
        print(f'Error in save_mls_key_package: {e}')
        return ({'error': 'Internal server error'}, 500)


async def get_available_mls_key_packages(user_id: str, member_ids: list[str]):
    try:
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)

        object_ids = []
        for member_id in member_ids or []:
            if not ObjectId.is_valid(member_id):
                return ({'error': 'Invalid member ID'}, 400)
            object_ids.append(ObjectId(member_id))

        db = get_db()
        key_packages = await db['mls_key_packages'].find({'userId': {'$in': object_ids}, 'used': False}).to_list(None)
        by_user = {}
        for key_package in key_packages:
            user_id_str = str(key_package['userId'])
            if user_id_str not in by_user:
                by_user[user_id_str] = {
                    'userId': user_id_str,
                    'keyPackage': key_package.get('keyPackage'),
                    'keyPackageRef': key_package.get('keyPackageRef'),
                    'cipherSuite': key_package.get('cipherSuite'),
                }
        missing = [member_id for member_id in member_ids or [] if member_id not in by_user]
        if missing:
            return ({'error': 'One or more users have not initialized MLS keys', 'missingMemberIds': missing}, 409)
        return (list(by_user.values()), 200)
    except Exception as e:
        print(f'Error in get_available_mls_key_packages: {e}')
        return ({'error': 'Internal server error'}, 500)


async def save_mls_handshake(user_id: str, group_id: str, handshake_type: str, payload: str, epoch: int | None = None):
    try:
        group = await _get_group_for_member(group_id, user_id)
        if not group:
            return ({'error': 'Group not found'}, 404)

        if handshake_type not in ('welcome', 'commit'):
            return ({'error': 'Invalid handshake type'}, 400)

        if not payload:
            return ({'error': 'MLS handshake payload is required'}, 400)

        db = get_db()
        now = datetime.now()
        handshake_doc = {
            'groupId': ObjectId(group_id),
            'senderId': ObjectId(user_id),
            'type': handshake_type,
            'payload': payload,
            'epoch': epoch,
            'createdAt': now,
        }
        result = await db['mls_handshakes'].insert_one(handshake_doc)
        handshake_doc['_id'] = result.inserted_id

        response = {
            '_id': str(handshake_doc['_id']),
            'groupId': group_id,
            'senderId': user_id,
            'type': handshake_type,
            'payload': payload,
            'epoch': epoch,
            'createdAt': now.isoformat(),
        }

        handshake_message = {'mlsHandshake': {'type': handshake_type, 'payload': payload, 'epoch': epoch}}
        await emit_new_group_message([str(member_id) for member_id in group.get('memberIds', [])], handshake_message, user_id)
        return (response, 201)
    except Exception as e:
        print(f'Error in save_mls_handshake: {e}')
        return ({'error': 'Internal server error'}, 500)


async def get_my_groups(user_id: str):
    try:
        if not ObjectId.is_valid(user_id):
            return ({'error': 'Invalid user ID'}, 400)

        db = get_db()
        groups = await db['groups'].find({'memberIds': ObjectId(user_id)}).to_list(None)
        serialized_groups = []

        for group in groups:
            members = await db['users'].find({'_id': {'$in': group.get('memberIds', [])}}, {'password': 0}).to_list(None)
            last_message = await db['group_messages'].find_one({'groupId': group['_id']}, sort=[('createdAt', -1)])
            serialized_groups.append(_serialize_group(group, members, last_message.get('createdAt') if last_message else group.get('updatedAt')))

        serialized_groups.sort(key=lambda item: item.get('lastMessageDate') or item.get('updatedAt') or '', reverse=True)
        return (serialized_groups, 200)
    except Exception as e:
        print(f'Error in get_my_groups: {e}')
        return ({'error': 'Internal server error'}, 500)


async def get_group_messages(user_id: str, group_id: str):
    try:
        group = await _get_group_for_member(group_id, user_id)
        if not group:
            return ({'error': 'Group not found'}, 404)

        db = get_db()
        messages = await db['group_messages'].find({'groupId': ObjectId(group_id)}).sort('createdAt', 1).to_list(None)
        return ([_serialize_group_message(message) for message in messages], 200)
    except Exception as e:
        print(f'Error in get_group_messages: {e}')
        return ({'error': 'Internal server error'}, 500)


async def send_group_message(user_id: str, group_id: str, text: str | None = None, image: str | None = None, ciphertext: str | None = None, mls_epoch: int | None = None):
    try:
        group = await _get_group_for_member(group_id, user_id)
        if not group:
            return ({'error': 'Group not found'}, 404)

        if not ciphertext:
            return ({'error': 'MLS ciphertext is required'}, 400)
        if mls_epoch is None:
            return ({'error': 'MLS epoch is required'}, 400)

        image_url = None
        if image:
            try:
                image_url = upload_image(image)
            except Exception as e:
                print(f'Error uploading group image: {e}')
                return ({'error': 'Failed to upload image'}, 500)

        db = get_db()
        now = datetime.now()
        message_doc = {
            'groupId': ObjectId(group_id),
            'senderId': ObjectId(user_id),
            'ciphertext': ciphertext,
            'mlsEpoch': mls_epoch,
            'contentType': 'mls_application',
            'image': image_url,
            'createdAt': now,
        }
        result = await db['group_messages'].insert_one(message_doc)
        await db['groups'].update_one({'_id': ObjectId(group_id)}, {'$set': {'updatedAt': now}})
        message_doc['_id'] = result.inserted_id
        response_message = _serialize_group_message(message_doc)
        await emit_new_group_message([str(member_id) for member_id in group.get('memberIds', [])], response_message, user_id)
        return (response_message, 201)
    except Exception as e:
        print(f'Error in send_group_message: {e}')
        return ({'error': 'Internal server error'}, 500)


async def add_group_members(user_id: str, group_id: str, member_ids: list[str]):
    try:
        group = await _get_group_for_member(group_id, user_id)
        if not group:
            return ({'error': 'Group not found'}, 404)
        if str(group['adminId']) != str(user_id):
            return ({'error': 'Only group admin can add members'}, 403)

        new_member_ids = []
        for member_id in member_ids or []:
            if not ObjectId.is_valid(member_id):
                return ({'error': 'Invalid member ID'}, 400)
            new_member_ids.append(ObjectId(member_id))

        db = get_db()
        existing_users = await db['users'].find({'_id': {'$in': new_member_ids}}, {'password': 0}).to_list(None)
        if len(existing_users) != len(set(new_member_ids)):
            return ({'error': 'One or more members were not found'}, 404)

        await db['groups'].update_one(
            {'_id': ObjectId(group_id)},
            {'$addToSet': {'memberIds': {'$each': new_member_ids}}, '$set': {'updatedAt': datetime.now()}},
        )
        updated_group = await db['groups'].find_one({'_id': ObjectId(group_id)})
        members = await db['users'].find({'_id': {'$in': updated_group.get('memberIds', [])}}, {'password': 0}).to_list(None)
        return (_serialize_group(updated_group, members), 200)
    except Exception as e:
        print(f'Error in add_group_members: {e}')
        return ({'error': 'Internal server error'}, 500)


async def remove_group_member(user_id: str, group_id: str, member_id: str):
    try:
        group = await _get_group_for_member(group_id, user_id)
        if not group:
            return ({'error': 'Group not found'}, 404)
        if str(group['adminId']) != str(user_id):
            return ({'error': 'Only group admin can remove members'}, 403)
        if str(user_id) == str(member_id):
            return ({'error': 'Admin must use leave group'}, 400)
        if not ObjectId.is_valid(member_id):
            return ({'error': 'Invalid member ID'}, 400)

        db = get_db()
        await db['groups'].update_one(
            {'_id': ObjectId(group_id)},
            {'$pull': {'memberIds': ObjectId(member_id)}, '$set': {'updatedAt': datetime.now()}},
        )
        updated_group = await db['groups'].find_one({'_id': ObjectId(group_id)})
        members = await db['users'].find({'_id': {'$in': updated_group.get('memberIds', [])}}, {'password': 0}).to_list(None)
        return (_serialize_group(updated_group, members), 200)
    except Exception as e:
        print(f'Error in remove_group_member: {e}')
        return ({'error': 'Internal server error'}, 500)


async def leave_group(user_id: str, group_id: str):
    try:
        group = await _get_group_for_member(group_id, user_id)
        if not group:
            return ({'error': 'Group not found'}, 404)

        db = get_db()
        leaving_id = ObjectId(user_id)
        remaining_member_ids = [member_id for member_id in group.get('memberIds', []) if member_id != leaving_id]

        if not remaining_member_ids:
            await db['groups'].delete_one({'_id': ObjectId(group_id)})
            await db['group_messages'].delete_many({'groupId': ObjectId(group_id)})
            return ({'message': 'Group deleted'}, 200)

        update_doc = {'memberIds': remaining_member_ids, 'updatedAt': datetime.now()}
        if group['adminId'] == leaving_id:
            update_doc['adminId'] = remaining_member_ids[0]

        await db['groups'].update_one({'_id': ObjectId(group_id)}, {'$set': update_doc})
        updated_group = await db['groups'].find_one({'_id': ObjectId(group_id)})
        members = await db['users'].find({'_id': {'$in': updated_group.get('memberIds', [])}}, {'password': 0}).to_list(None)
        return (_serialize_group(updated_group, members), 200)
    except Exception as e:
        print(f'Error in leave_group: {e}')
        return ({'error': 'Internal server error'}, 500)
