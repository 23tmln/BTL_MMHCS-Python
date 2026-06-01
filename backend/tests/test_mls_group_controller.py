import asyncio
import os
import sys
import types
from unittest.mock import AsyncMock, MagicMock

from bson import ObjectId

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

motor_module = types.ModuleType('motor')
motor_asyncio_module = types.ModuleType('motor.motor_asyncio')
motor_asyncio_module.AsyncIOMotorClient = MagicMock()
motor_asyncio_module.AsyncIOMotorDatabase = MagicMock()
sys.modules.setdefault('motor', motor_module)
sys.modules.setdefault('motor.motor_asyncio', motor_asyncio_module)

socketio_module = types.ModuleType('socketio')
socketio_module.AsyncServer = MagicMock()
socketio_module.ASGIApp = MagicMock()
sys.modules.setdefault('socketio', socketio_module)

from src.controllers import group_controller  # noqa: E402


class FakeInsertResult:
    def __init__(self, inserted_id=None):
        self.inserted_id = inserted_id or ObjectId()


class FakeCollection:
    def __init__(self):
        self.docs = []
        self.updated = []

    async def insert_one(self, doc):
        self.docs.append(doc)
        return FakeInsertResult(doc.get('_id'))

    async def find_one(self, query, *args, **kwargs):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None

    def find(self, query, *args, **kwargs):
        return FakeSortableCursor([doc for doc in self.docs if all(doc.get(k) == v for k, v in query.items())])

    async def update_one(self, query, update):
        self.updated.append((query, update))

    async def update_many(self, query, update):
        self.updated.append((query, update))
        target_ids = set(query.get('_id', {}).get('$in', []))
        for doc in self.docs:
            if doc.get('_id') in target_ids and all(doc.get(k) == v for k, v in query.items() if k != '_id'):
                for key, value in update.get('$set', {}).items():
                    doc[key] = value
                for key in update.get('$unset', {}):
                    doc.pop(key, None)

    async def find_one_and_update(self, query, update, *args, **kwargs):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                for key, value in update.get('$set', {}).items():
                    doc[key] = value
                return doc
        return None


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, length):
        return self.docs


class FakeSortableCursor(FakeCursor):
    def sort(self, key, direction):
        return self


def test_save_mls_credential_stores_public_data_only(monkeypatch):
    async def run_test():
        credentials = FakeCollection()
        db = {'mls_credentials': credentials}
        monkeypatch.setattr(group_controller, 'get_db', lambda: db)

        result, status_code = await group_controller.save_mls_credential(
            '64f000000000000000000001',
            {
                'credential': 'public-credential',
                'publicKey': 'public-signing-key',
                'cipherSuite': 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
                'privateKey': 'must-not-be-stored',
            },
        )

        assert status_code == 200
        assert result == {'message': 'MLS credential saved'}
        assert credentials.docs[0]['credential'] == 'public-credential'
        assert credentials.docs[0]['publicKey'] == 'public-signing-key'
        assert credentials.docs[0]['cipherSuite'] == 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
        assert 'privateKey' not in credentials.docs[0]

    asyncio.run(run_test())


def test_serialize_mls_credential_returns_public_key_contract():
    credential_id = ObjectId('64f000000000000000000010')
    user_id = ObjectId('64f000000000000000000001')

    result = group_controller._serialize_mls_credential({
        '_id': credential_id,
        'userId': user_id,
        'credential': 'public-credential',
        'publicKey': 'public-signing-key',
        'cipherSuite': 'MLS_128_DHKEMP256_AES128GCM_SHA256_P256',
    })

    assert result == {
        '_id': str(credential_id),
        'userId': str(user_id),
        'credential': 'public-credential',
        'publicKey': 'public-signing-key',
        'cipherSuite': 'MLS_128_DHKEMP256_AES128GCM_SHA256_P256',
        'createdAt': None,
    }
    assert 'signatureKey' not in result


def test_save_mls_key_package_rejects_missing_key_package(monkeypatch):
    async def run_test():
        db = {'mls_key_packages': FakeCollection()}
        monkeypatch.setattr(group_controller, 'get_db', lambda: db)

        result, status_code = await group_controller.save_mls_key_package(
            '64f000000000000000000001',
            {'cipherSuite': 'suite'},
        )

        assert status_code == 400
        assert result == {'error': 'MLS KeyPackage is required'}

    asyncio.run(run_test())


def test_get_available_mls_key_packages_reserves_one_package_per_member(monkeypatch):
    async def run_test():
        member_one = ObjectId('64f000000000000000000011')
        member_two = ObjectId('64f000000000000000000012')
        packages = FakeCollection()
        packages.docs = [
            {'_id': ObjectId('64f000000000000000000021'), 'userId': member_one, 'keyPackage': 'kp-1', 'keyPackageRef': 'ref-1', 'cipherSuite': 'suite', 'used': False},
            {'_id': ObjectId('64f000000000000000000022'), 'userId': member_two, 'keyPackage': 'kp-2', 'keyPackageRef': 'ref-2', 'cipherSuite': 'suite', 'used': False},
        ]
        db = {'mls_key_packages': packages}
        monkeypatch.setattr(group_controller, 'get_db', lambda: db)

        result, status_code = await group_controller.get_available_mls_key_packages(
            '64f000000000000000000001',
            [str(member_one), str(member_two)],
        )

        assert status_code == 200
        assert result == [
            {'_id': '64f000000000000000000021', 'userId': str(member_one), 'keyPackage': 'kp-1', 'keyPackageRef': 'ref-1', 'cipherSuite': 'suite'},
            {'_id': '64f000000000000000000022', 'userId': str(member_two), 'keyPackage': 'kp-2', 'keyPackageRef': 'ref-2', 'cipherSuite': 'suite'},
        ]
        assert all(package['used'] for package in packages.docs)

    asyncio.run(run_test())


def test_get_available_mls_key_packages_returns_missing_members_without_partial_reservation(monkeypatch):
    async def run_test():
        member_one = ObjectId('64f000000000000000000011')
        member_two = ObjectId('64f000000000000000000012')
        packages = FakeCollection()
        packages.docs = [
            {'_id': ObjectId('64f000000000000000000021'), 'userId': member_one, 'keyPackage': 'kp-1', 'keyPackageRef': 'ref-1', 'cipherSuite': 'suite', 'used': False},
        ]
        db = {'mls_key_packages': packages}
        monkeypatch.setattr(group_controller, 'get_db', lambda: db)

        result, status_code = await group_controller.get_available_mls_key_packages(
            '64f000000000000000000001',
            [str(member_one), str(member_two)],
        )

        assert status_code == 409
        assert result == {'error': 'One or more users have not initialized MLS keys', 'missingMemberIds': [str(member_two)]}
        assert packages.docs[0]['used'] is False

    asyncio.run(run_test())


def test_release_reserved_mls_key_packages_releases_only_requester_reservations(monkeypatch):
    async def run_test():
        requester = ObjectId('64f000000000000000000001')
        package_to_release = ObjectId('64f000000000000000000021')
        other_package = ObjectId('64f000000000000000000022')
        packages = FakeCollection()
        packages.docs = [
            {'_id': package_to_release, 'used': True, 'reservedBy': requester},
            {'_id': other_package, 'used': True, 'reservedBy': ObjectId('64f000000000000000000099')},
        ]
        db = {'mls_key_packages': packages}
        monkeypatch.setattr(group_controller, 'get_db', lambda: db)

        result, status_code = await group_controller.release_reserved_mls_key_packages(
            str(requester),
            [str(package_to_release), str(other_package)],
        )

        assert status_code == 200
        assert result == {'message': 'MLS KeyPackages released'}
        assert packages.docs[0]['used'] is False
        assert 'reservedBy' not in packages.docs[0]
        assert packages.docs[1]['used'] is True

    asyncio.run(run_test())


def test_send_group_message_requires_ciphertext_for_mls(monkeypatch):
    async def run_test():
        group_id = '64f000000000000000000002'
        user_id = '64f000000000000000000001'

        async def fake_get_group(gid, uid):
            return {'_id': ObjectId(gid), 'memberIds': [ObjectId(uid)]}

        monkeypatch.setattr(group_controller, '_get_group_for_member', fake_get_group)

        result, status_code = await group_controller.send_group_message(
            user_id,
            group_id,
            text='plaintext',
            image=None,
            ciphertext=None,
            mls_epoch=None,
        )

        assert status_code == 400
        assert result == {'error': 'MLS ciphertext is required'}

    asyncio.run(run_test())


def test_save_mls_handshake_rejects_invalid_type(monkeypatch):
    async def run_test():
        group_id = '64f000000000000000000002'
        user_id = '64f000000000000000000001'

        async def fake_get_group(gid, uid):
            return {'_id': ObjectId(gid), 'memberIds': [ObjectId(uid)]}

        monkeypatch.setattr(group_controller, '_get_group_for_member', fake_get_group)

        result, status_code = await group_controller.save_mls_handshake(
            user_id,
            group_id,
            handshake_type='invalid',
            payload='some-payload',
            epoch=None,
        )

        assert status_code == 400
        assert result == {'error': 'Invalid handshake type'}

    asyncio.run(run_test())


def test_save_mls_handshake_stores_welcome(monkeypatch):
    async def run_test():
        group_id = '64f000000000000000000002'
        user_id = '64f000000000000000000001'

        async def fake_get_group(gid, uid):
            return {'_id': ObjectId(gid), 'memberIds': [ObjectId(uid)]}

        handshakes = FakeCollection()
        db = {'mls_handshakes': handshakes}
        monkeypatch.setattr(group_controller, '_get_group_for_member', fake_get_group)
        monkeypatch.setattr(group_controller, 'get_db', lambda: db)

        async def fake_emit(member_ids, message, sender_id):
            pass

        monkeypatch.setattr(group_controller, 'emit_new_group_message', fake_emit)

        result, status_code = await group_controller.save_mls_handshake(
            user_id,
            group_id,
            handshake_type='welcome',
            payload='base64-welcome-payload',
            epoch=0,
        )

        assert status_code == 201
        assert result['type'] == 'welcome'
        assert result['payload'] == 'base64-welcome-payload'
        assert len(handshakes.docs) == 1
        assert handshakes.docs[0]['type'] == 'welcome'

    asyncio.run(run_test())


def test_get_group_mls_handshakes_returns_persisted_handshakes(monkeypatch):
    async def run_test():
        group_id = '64f000000000000000000002'
        user_id = '64f000000000000000000001'
        handshake_id = ObjectId('64f000000000000000000030')

        async def fake_get_group(gid, uid):
            return {'_id': ObjectId(gid), 'memberIds': [ObjectId(uid)]}

        handshakes = FakeCollection()
        handshakes.docs = [{
            '_id': handshake_id,
            'groupId': ObjectId(group_id),
            'senderId': ObjectId(user_id),
            'type': 'welcome',
            'payload': 'base64-welcome-payload',
            'epoch': 1,
            'createdAt': None,
        }]
        db = {'mls_handshakes': handshakes}
        monkeypatch.setattr(group_controller, '_get_group_for_member', fake_get_group)
        monkeypatch.setattr(group_controller, 'get_db', lambda: db)

        result, status_code = await group_controller.get_group_mls_handshakes(user_id, group_id)

        assert status_code == 200
        assert result == [{
            '_id': str(handshake_id),
            'groupId': group_id,
            'senderId': user_id,
            'type': 'welcome',
            'payload': 'base64-welcome-payload',
            'epoch': 1,
            'createdAt': None,
        }]

    asyncio.run(run_test())
