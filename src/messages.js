/**
 * Message received in a chat.
 */
export class ChatMessage {
    constructor(room, user, text) {
        this.room = room
        this.user = user
        this.text = text
    }

    /**
     * Replies to a given message in a given room.
     *
     * @param {string} message - message to say.
     */
    reply(answer) {
        this.room.say(answer)
    }
}

/**
 * Message received in a private message.
 */
export class PrivateMessage {
    constructor(user, text) {
        this.user = user
        this.text = text
    }

    /**
     * Replies to a given message in a PM.
     *
     * @param {string} message - message to say.
     */
    reply(answer) {
        this.user.pm(answer)
    }
}
