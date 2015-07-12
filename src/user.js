import {toId} from './utils'

/**
 * Represents a particular user.
 */
export default class User {
    constructor(nick, client) {
        this.nick = nick
        this.client = client
    }

    /**
     * Returns user's name.
     */
    toString() {
        return this.nick
    }

    /**
     * Compares a user for equality by identifier with other user.
     *
     * @param {string|User} otherUser - Other user to compare with.
     *     If it's a string, it's considered to be an user name.
     */
    equals(otherUser) {
        if (typeof otherUser === 'string') {
            otherUser = new User(otherUser)
        }
        if (otherUser instanceof User) {
            return this.id === otherUser.id
        }
        return false
    }

    /**
     * PMs a user with a message.
     *
     * @param {string} message - message to send to an user.
     */
    pm(message) {
        if (message.charAt(0) === '/') {
            message = '/' + message
        }
        this.client.send('pm', `${toId(this.id)},${message}`);
    }

    /**
     * Returns a user id.
     */
    get id() {
        return toId(this.nick)
    }
}
