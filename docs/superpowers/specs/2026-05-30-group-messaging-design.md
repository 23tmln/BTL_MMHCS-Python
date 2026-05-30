# Group Messaging Plaintext v1 Design

## Context

The current application supports one-to-one chat with client-side Signal/libsignal encryption based on X3DH-style session setup and Double Ratchet-style message encryption. The first group messaging version will intentionally use plaintext messages. Group encryption will be designed later, so this feature must stay isolated from the existing one-to-one E2EE flow and leave a clean upgrade path.

## Goals

- Let authenticated users create groups with a name and selected contacts.
- Add a dedicated `Groups` tab beside the existing `Chats` and `Contacts` tabs.
- Let group members read and send plaintext group messages.
- Let every member leave a group.
- Let the group admin add or remove members.
- Transfer admin ownership when the admin leaves and other members remain.
- Preserve existing one-to-one E2EE behavior without changing its message flow.

## Non-Goals

- No group E2EE in this version.
- No invite link/code flow.
- No group avatar, description, roles beyond admin/member, read receipts, mentions, pinning, or message reactions.
- No migration of one-to-one messages into the group message model.

## Recommended Approach

Add a separate group messaging domain rather than overloading the existing one-to-one `messages` collection. This keeps the current `senderId`/`receiverId` E2EE chat model stable and gives group messaging its own models, routes, controller logic, and frontend state.

Rejected alternatives:

1. Reusing `messages` with a `conversationType`/`groupId` field would reduce collections but would complicate existing one-to-one queries and decryption assumptions.
2. Modeling groups as pseudo-users would minimize UI changes but would make membership and admin permissions unclear and harder to extend for future group encryption.

## Backend Design

### Data Collections

`groups` documents:

```json
{
  "_id": "ObjectId",
  "name": "string",
  "adminId": "ObjectId",
  "memberIds": ["ObjectId"],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

`group_messages` documents:

```json
{
  "_id": "ObjectId",
  "groupId": "ObjectId",
  "senderId": "ObjectId",
  "text": "string",
  "image": "string|null",
  "createdAt": "datetime"
}
```

`group_messages.text` is plaintext in v1. Future encryption can add fields such as `ciphertextsByRecipient`, `messageType`, `senderKeyId`, or `groupEpoch` without changing one-to-one chat storage.

### Routes

Add `backend/src/routes/group_route.py` under `/api/groups`:

- `POST /api/groups`
  - Body: `{ name: string, memberIds: string[] }`
  - Creates a group with the authenticated user as admin.
  - The creator is always included in `memberIds` even if omitted by the client.

- `GET /api/groups`
  - Returns groups where the authenticated user is a member.
  - Include enough display data for the sidebar: `_id`, `name`, `adminId`, `memberIds`, `members`, `lastMessageDate` if available.

- `GET /api/groups/{groupId}/messages`
  - Returns plaintext group messages for members only.

- `POST /api/groups/{groupId}/messages`
  - Body: `{ text?: string, image?: string }`
  - Stores a plaintext group message and emits it in realtime to online group members.

- `POST /api/groups/{groupId}/members`
  - Body: `{ memberIds: string[] }`
  - Admin only. Adds contacts/users to the group, ignoring existing members.

- `DELETE /api/groups/{groupId}/members/{userId}`
  - Admin only. Removes a member. The admin cannot remove themselves through this endpoint; they use leave.

- `POST /api/groups/{groupId}/leave`
  - Member only. Removes the authenticated user from the group.
  - If the leaving user is admin and members remain, transfer admin to the oldest remaining member by current `memberIds` order.
  - If no members remain, delete the group and its group messages.

### Controller Rules

- Validate all ObjectId inputs.
- Only members can read group metadata, read messages, or send messages.
- Only the current admin can add or remove other members.
- Group creation requires a non-empty trimmed name.
- Sending a message requires either non-empty text or an image.
- User records returned with group details must exclude passwords and other sensitive fields.

### Socket Rules

Extend `backend/src/lib/socket.py` with a helper such as `emit_new_group_message(member_ids, message_data, sender_id)`.

- For each online member in the group, emit `newGroupMessage`.
- The frontend already uses optimistic UI for the sender, so the backend may skip emitting back to `sender_id` to avoid duplicates.
- If a member is offline, they will receive the message when loading group history later.

## Frontend Design

### State

Extend `frontend/src/store/useChatStore.js` with separate group state:

- `groups: []`
- `selectedGroup: null`
- `groupMessages: []` or reuse `messages` only when the active selection is a group.
- `activeTab: "chats" | "contacts" | "groups"`
- loading flags for groups/messages as needed.

Keep `selectedUser` for one-to-one chat. Selecting a group clears `selectedUser`; selecting a user clears `selectedGroup`.

### Store Actions

Add group actions:

- `getMyGroups()`
- `createGroup({ name, memberIds })`
- `setSelectedGroup(group)`
- `getGroupMessages(groupId)`
- `sendGroupMessage({ text, image })`
- `addGroupMembers(groupId, memberIds)`
- `removeGroupMember(groupId, userId)`
- `leaveGroup(groupId)`
- `subscribeToGroupMessages()` / `unsubscribeFromGroupMessages()`

One-to-one actions continue to use Signal helpers. Group send/load actions do not call `encryptWithSignal`, `decryptWithSignal`, or message plaintext cache helpers in v1.

### UI Components

Add or update components:

- `ActiveTabSwitch.jsx`: add `Groups` tab.
- `GroupsList.jsx`: list groups in the sidebar.
- `CreateGroupModal.jsx`: input group name and select members from contacts.
- `ChatContainer.jsx`: branch between selected user and selected group.
- `ChatHeader.jsx`: display group name, member count, and group management/leave controls when a group is selected.
- `GroupDetailsModal.jsx`: list members, show admin badge, allow admin member management, allow leaving group.
- `MessageInput.jsx`: call plaintext group send action when `selectedGroup` is active; keep encrypted one-to-one send action when `selectedUser` is active.

### UX Flow

1. User opens `Groups` tab.
2. User creates a group by entering a name and selecting contacts.
3. New group appears in `GroupsList` and can be selected.
4. Selecting a group loads its plaintext message history.
5. Sending a message stores plaintext on the backend and updates the UI optimistically.
6. Online members viewing that group receive `newGroupMessage` in realtime.
7. Members can leave; admin can add/remove members.

## Error Handling

- Show a toast when group creation, member updates, message loading, or sending fails.
- If the user is no longer a member when loading/sending, clear `selectedGroup`, refresh groups, and show a membership error.
- If an admin leaves and ownership transfers, refresh the group details so the new admin state is visible.
- Avoid showing backend stack traces or raw exception details in the UI.

## Testing Plan

### Backend

- Create group with authenticated user as admin and member.
- Reject create group with empty name.
- Return only groups where user is a member.
- Allow members to read/send group messages.
- Reject non-members reading/sending group messages.
- Allow admin to add/remove members.
- Reject non-admin member management.
- Transfer admin on admin leave when members remain.
- Delete/archive empty group when final member leaves.

### Frontend

- `Groups` tab renders independently from `Chats` and `Contacts`.
- Create group modal submits name + selected members.
- Selecting group loads messages and clears selected one-to-one user.
- Sending group message does not invoke Signal encryption helpers.
- Realtime group message appends only for the currently selected group.
- Leaving a group removes it from the group list and clears the current selection.
- Existing one-to-one E2EE chat still sends, receives, and decrypts as before.

## Rollout Roadmap

1. Backend group models, routes, controller helpers, and socket emit helper.
2. Frontend store state/actions for groups and plaintext group messages.
3. Sidebar `Groups` tab and group creation UI.
4. Group chat panel, message send/load, and realtime receive.
5. Group details/member management/leave flow.
6. Regression verification for one-to-one E2EE.

## Future Group Encryption Notes

The plaintext v1 design intentionally isolates group data from one-to-one E2EE. Future encryption should replace group message plaintext with a recipient-aware envelope or group-key epoch model behind the group store/controller boundary. The UI and membership model should not require major changes if the future encryption layer keeps the same high-level operations: create group, load group, send group message, add member, remove member, leave group.
