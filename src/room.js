import {toRoomId} from './utils'

/**
 * Represents a room.
 */
export default class Room {
    constructor(name, client) {
        this.name = name
        this.client = client
    }

    /**
     * Returns room's name.
     */
    toString() {
        return this.name
    }

    /**
     * Compares user for equality by identifier with other user.
     *
     * @param {string|User} otherRoom - Other room to compare with.
     *     If it's a string, it's considered to be an room name.
     */
    equals(otherRoom) {
        if (typeof otherRoom === 'string') {
            otherRoom = new Room(otherRoom)
        }
        if (otherRoom instanceof Room) {
            return this.id === otherRoom.id
        }
        return false
    }

    /**
     * Says a message in a room.
     *
     * @param {string} message - message to say.
     */
    say(message) {
        this.client.say(message, this.name)
    }

    /**
     * Returns a room id.
     */
    get id() {
        return toRoomId(this.name)
    }
}
