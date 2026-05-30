# Khai triển mã nguồn X3DH trong thư viện libsignal-protocol-typescript

Quá trình Extended Triple Diffie-Hellman (X3DH) trong dự án được kích hoạt từ `signalHelper.js`, gọi thẳng vào lớp `SessionBuilder` và `SessionCipher` của thư viện. Dưới đây là trích xuất nguyên bản đoạn code cốt lõi thực thi X3DH từ mã nguồn mở `@privacyresearch/libsignal-protocol-typescript`.

## 1. Phía Người Gửi (Alice) - Khởi tạo phiên X3DH

Khi Alice tạo tin nhắn khởi tạo phiên, `signalHelper.js` lấy Public Bundle của Bob từ API và gọi:
```javascript
// Trích từ phần code của signalHelper.js (hàm ensureOutboundSession)
await builder.processPreKey(protocolBundle);
```

Lệnh trên gọi hệ thống thư viện, tiến hành verify và cuối cùng thực thi hàm `startSessionAsInitiator` bên trong `session-builder.js`. Thuật toán nhân đường cong Elliptic (ECDHE) được diễn giải trọn vẹn trong đoạn code dưới đây:

```javascript
/**
 * Trích xuất từ node_modules/@privacyresearch/libsignal-protocol-typescript/lib/session-builder.js
 * Hàm này tính toán Shared Secret của X3DH khi đóng vai trò là Người Khởi Tạo (Alice)
 * Tham khảo đặc tả kỹ thuật: https://signal.org/docs/specifications/x3dh/#keys
 */
this.startSessionAsInitiator = async (EKa, IKb, SPKb, OPKb, registrationId) => {
    // EKa: Cặp Ephemeral Key do Bob (Alice) tự sinh ra trong phiên này
    // IKb: Identity Public Key của Bob
    // SPKb: Signed PreKey Public Key của Bob
    // OPKb: One-time PreKey Public Key của Bob (nếu có)
    
    const IKa = await this.storage.getIdentityKeyPair();
    if (!IKa) {
        throw new Error(`No identity key. Cannot initiate session.`);
    }
    
    // Khởi tạo mảng Shared Secret với 0xFF cho curve25519 (X3DH sec 22)
    let sharedSecret;
    if (OPKb === undefined) {
        sharedSecret = new Uint8Array(32 * 4);
    } else {
        sharedSecret = new Uint8Array(32 * 5);
    }
    for (let i = 0; i < 32; i++) {
        sharedSecret[i] = 0xff;
    }
    
    // THỰC THI 3 PHÉP TÍNH ECDHE (TRIPLE DIFFIE-HELLMAN)
    const ecRes = await Promise.all([
        Internal.crypto.ECDHE(SPKb, IKa.privKey), // DH1 = ECDHE(IKa, SPKb)
        Internal.crypto.ECDHE(IKb, EKa.privKey),  // DH2 = ECDHE(EKa, IKb)
        Internal.crypto.ECDHE(SPKb, EKa.privKey), // DH3 = ECDHE(EKa, SPKb)
    ]);
    
    sharedSecret.set(new Uint8Array(ecRes[0]), 32);
    sharedSecret.set(new Uint8Array(ecRes[1]), 32 * 2);
    sharedSecret.set(new Uint8Array(ecRes[2]), 32 * 3);
    
    // Phép tính thứ 4 (nếu có One-Time PreKey của Bob)
    if (OPKb !== undefined) {
        const ecRes4 = await Internal.crypto.ECDHE(OPKb, EKa.privKey); // DH4 = ECDHE(EKa, OPKb)
        sharedSecret.set(new Uint8Array(ecRes4), 32 * 4);
    }
    
    // Dùng HKDF băm mảng hỗn hợp Shared Secret ra rootKey ban đầu
    const masterKey = await Internal.HKDF(uint8ArrayToArrayBuffer(sharedSecret), new ArrayBuffer(32), 'WhisperText');
    
    const session = {
        registrationId: registrationId,
        currentRatchet: {
            rootKey: masterKey[0],
            lastRemoteEphemeralKey: SPKb,
            previousCounter: 0,
        },
        indexInfo: {
            remoteIdentityKey: IKb,
            closed: -1,
        },
        oldRatchetList: [],
        chains: {},
    };
    
    session.indexInfo.baseKey = EKa.pubKey;
    session.indexInfo.baseKeyType = BaseKeyType.OURS;
    const ourSendingEphemeralKey = await Internal.crypto.createKeyPair();
    session.currentRatchet.ephemeralKeyPair = ourSendingEphemeralKey;
    
    await this.calculateSendingRatchet(session, SPKb);
    return session;
};
```

## 2. Phía Người Nhận (Bob) - Dịch mã và hoàn thành X3DH

Khi Bob nhận được PreKeyWhisperMessage từ Alice qua máy chủ, `signalHelper.js` của Bob sẽ gọi:
```javascript
// Trích từ phần code của signalHelper.js (hàm decryptWithSignal)
plaintextBuffer = await cipher.decryptPreKeyWhisperMessage(ciphertextBinary, 'binary');
```

Quá trình này giải mã tin nhắn đầu tiên, đồng thời tiến hành nghịch đảo hệ phương trình X3DH của Alice để lấy ra Root Key. Cỗ máy toán học X3DH phía Bob được xử lý tại hàm `startSessionWthPreKeyMessage` trong thư viện:

```javascript
/**
 * Trích xuất từ node_modules/@privacyresearch/libsignal-protocol-typescript/lib/session-builder.js
 * Hàm này tính toán Shared Secret của X3DH khi đóng vai trò là Người Nhận (Bob)
 * Cài đặt nghịch đảo lại các Private/Public so với Alice lúc đầu.
 */
this.startSessionWthPreKeyMessage = async (OPKb, SPKb, message) => {
    const IKb = await this.storage.getIdentityKeyPair(); // Private của mình (Bob)
    const IKa = message.identityKey; // Identity Public Key của Alice (từ trong tin nhắn gửi ngầm)
    const EKa = message.baseKey;      // Ephemeral Public Key của Alice (từ tin nhắn gửi ngầm)
    
    if (!IKb) {
        throw new Error(`No identity key. Cannot initiate session.`);
    }
    
    let sharedSecret;
    if (!OPKb) {
        sharedSecret = new Uint8Array(32 * 4);
    } else {
        sharedSecret = new Uint8Array(32 * 5);
    }
    for (let i = 0; i < 32; i++) {
        sharedSecret[i] = 0xff;
    }
    
    // THỰC THI 3 PHÉP TÍNH ECDHE NGƯỢC LẠI BỞI BOB 
    // Giữ nguyên tính nhất quán của hằng đẳng thức DH: (A_public * B_private) === (A_private * B_public)
    const ecRes = await Promise.all([
        Internal.crypto.ECDHE(IKa, SPKb.privKey), // Mảng 1: IKa * SPKb (so với DH1 của Alice là SPKb * IKa)
        Internal.crypto.ECDHE(EKa, IKb.privKey),  // Mảng 2: EKa * IKb (so với DH2 của Alice là IKb * EKa)
        Internal.crypto.ECDHE(EKa, SPKb.privKey), // Mảng 3: EKa * SPKb (so với DH3 của Alice là SPKb * EKa)
    ]);
    
    sharedSecret.set(new Uint8Array(ecRes[0]), 32);
    sharedSecret.set(new Uint8Array(ecRes[1]), 32 * 2);
    sharedSecret.set(new Uint8Array(ecRes[2]), 32 * 3);
    
    // Nếu có One-Time PreKey, Bob dùng private của One-time tính với Alice's Ephemeral
    if (OPKb) {
        const ecRes4 = await Internal.crypto.ECDHE(EKa, OPKb.privKey);
        sharedSecret.set(new Uint8Array(ecRes4), 32 * 4);
    }
    
    // Dùng HKDF băm mảng Shared Secret ra rootKey khớp hoàn toàn với Alice
    const masterKey = await Internal.HKDF(uint8ArrayToArrayBuffer(sharedSecret), new ArrayBuffer(32), 'WhisperText');
    
    const session = {
        registrationId: message.registrationId,
        currentRatchet: {
            rootKey: masterKey[0],
            lastRemoteEphemeralKey: EKa,
            previousCounter: 0,
        },
        indexInfo: {
            remoteIdentityKey: IKa,
            closed: -1,
        },
        oldRatchetList: [],
        chains: {},
    };
    
    session.indexInfo.baseKey = EKa;
    session.indexInfo.baseKeyType = BaseKeyType.THEIRS;
    session.currentRatchet.ephemeralKeyPair = SPKb;
    
    return session;
};
```
