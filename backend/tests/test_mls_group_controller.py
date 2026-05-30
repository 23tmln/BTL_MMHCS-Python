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

    async def update_one(self, query, update):
        self.updated.append((query, update))

    async def update_many(self, query, update):
        self.updated.append((query, update))


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
