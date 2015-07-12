import {post} from 'request-promise'
import {EventEmitter} from 'events'
import {client as WebSocketClient} from 'websocket'
import {_parseServer} from './utils'
import User from './user'
import Room from './room'
import {ChatMessage, PrivateMessage} from './messages'

const MESSAGE_DELAY = 500

/**
 * Showdown server connection.
 */
export default class Client extends EventEmitter {
    constructor() {
        super()
        this.user = null
        this._server = null
        this._connection = null
        this._messageQueue = []
        this._lastMessage = 0
        this._appendEvents()
        this._queueTimeout = null
    }

    /**
     * Connect to Showdown server.
     *
     * @param {string|Object} server - Showdown identifier of a server,
     *     address of a server, or object containing server properties.
     * @param {Object={}} options - Client options.
     * @param {boolean=false} options.debug - Show debug output.
     *
     * @returns {Promise}
     */
    async connect(server, {debug = false} = {}) {
        this._debug = debug
        this._server = await _parseServer(server)
        await this._initConnection()
    }

    async _initConnection() {
        const client = new WebSocketClient
        const clientPromise = new Promise((resolve, reject) => {
            client.on('connect', resolve)
            client.on('connectFailed', reject)
        })
        const {host, port} = this._server
        client.connect(`ws://${host}:${port}/showdown/websocket`)
        this._connection = await clientPromise

        this.emit('connection')
        this._connection.on('message', message => {
            if (message.type === 'utf8') {
                this.emit('rawMessage', message.utf8Data)
            }
            else {
                throw new Error(`Unrecognized message type '${message.type}'`)
            }
        })
    }

    /**
     * Disconnects from a server.
     */
    disconnect() {
        this._connection.close()
    }

    /**
     * Reconnects to a server
     *
     * @returns {Promise}
     */
    async reconnect() {
        this.disconnect()
        await this._initConnection()
    }

    /**
     * Logins as a provided user.
     *
     * @param {string} name - User name
     * @param {string} pass - User password
     *
     * @returns {Promise}
     */
    async login(name, pass) {
        let [challengekeyid, challenge] = (await this._loginPromise)[0].split('|')
        let body = await post({
            url: `https://play.pokemonshowdown.com/~~${this._server._serverid}/action.php`,
            form: {act: 'login', challengekeyid, challenge, name, pass},
        })
        const userData = JSON.parse(body.substring(1))
        this.send('trn', `${name},0,${userData.assertion}`)
        await this._receiveEvent('raw-updateuser')
    }

    /**
     * @callback receiveEventCallback
     * @param {*[]} result - list of event parameters
     */

    /**
     * Return a promise that is accepted when a given event is retrieved.
     * Useful when you are waiting for a particular event to occur.
     *
     * @param {string} type - Required event type
     * @param {receiveEventCallback} condition - Condition required for
     *     a promise to resolve.
     *
     * @returns {Promise}
     */
    _receiveEvent(type, condition = () => true) {
        return new Promise(resolve => {
            function callback(...result) {
                if (!condition(result)) return
                this.removeListener(type, callback)
                resolve(result)
            }
            this.on(type, callback)
        })
    }

    /**
     * Send a command.
     *
     * @param {string} command - Command name.
     * @param {string=} - Command argument.
     * @param {string=lobby} - Room to use a command in.
     */
    send(command, argument = '', room = 'lobby') {
        // Showdown allows this shortform for compression.
        if (room === 'lobby') {
            room = ''
        }
        this._sendRawMessage(`${room}|/${command} ${argument}`)
    }

    /**
     * Sends a message to a chat.
     *
     * @param {string} message - Message.
     * @param {string=lobby} room - Room to send message to.
     *
     * @returns {Promise}
     */
    async say(message, room = 'lobby') {
        if (room === 'lobby') {
            room = ''
        }
        // Messages starting with / would be interpreted as commands,
        // to prevent that, additional slash needs to be added.
        if (message.charAt(0) === '/') {
            message = '/' + message
        }
        // Similarly, to prevent messages starting with ! from acting
        // like announcements, they need to be prepended with spaces.
        // Similarly, to escape admin-only eval, space has to be used
        // as well. Not that anyone would care about >>, but better be
        // more secure if possible.
        //
        // Consistency, I tell you.
        else if (/^!|>>>? /.test(message)) {
            message = ' ' + message
        }

        this._sendRawMessage(`${room}|${message}`)
    }

    /**
     * Joins a room.
     */
    joinRoom(room) {
        this.send('join', room)
    }

    _createUser(nick) {
        return new User(nick, this)
    }

    _createRoom(name) {
        return new Room(name, this)
    }

    _sendRawMessage(message) {
        this._messageQueue.push(message)
        this._checkMessageQueue()
    }

    _checkMessageQueue() {
        const now = +new Date
        const MIN_TIME = this._lastMessage + MESSAGE_DELAY
        if (this._messageQueue.length === 0) return
        if (now >= MIN_TIME) {
            this._sendFromMessageQueue()
        }
        else if (!this._queueTimeout) {
            const callback = this._sendFromMessageQueue.bind(this)
            this._queueTimeout = setTimeout(callback, MIN_TIME - now)
        }
    }

    _sendFromMessageQueue() {
        this._queueTimeout = null
        this._forceSend(this._messageQueue.shift())
        this._checkMessageQueue()
    }

    _forceSend(message) {
        this._lastMessage = +new Date
        if (this._debug) {
            console.log(`[snd] ${message}`)
        }
        this._connection.send(message)
    }

    _onConnection() {
        this._loginPromise = this._receiveEvent('raw-challstr')
    }

    _onRawMessage(rawMessage) {
        if (this._debug) {
            console.log(`[rcv] ${rawMessage}`)
        }

        const MESSAGE_REGEX = /^(?:>([^\n]+)\n)?([\s\S]*?)$/
        let room
        let message
        try {
            ;[room, message] = MESSAGE_REGEX.exec(rawMessage).slice(1)
        }
        catch (e) {
            throw new Error("Invalid message received")
        }
        if (!room) {
            room = 'lobby'
        }

        let command
        let data
        const COMMAND_REGEX = /^\|([^|]+)\|([\s\S]*)$/
        try {
            ;[command, data] = COMMAND_REGEX.exec(message).slice(1)
        }
        catch (e) {
            command = ''
            data = message
        }

        this.emit('raw', command, data, room)
        this.emit(`raw-${command}`, data, room)
    }

    _onUpdateUser(message) {
        const [nick] = message.split('|')
        this.user = this._createUser(nick)
    }

    _onChatMessage(rawChatMessage, room) {
        let [timestamp, user, ...message] = rawChatMessage.split('|')
        room = this._createRoom(room)
        user = this._createUser(user)
        message = message.join('|')

        // Ignore messages from client itself
        if (user.equals(this.user)) return

        const messageObject = new ChatMessage(room, user, message)
        this.emit('chat', messageObject)
        this.emit('message', messageObject)
    }

    _onPrivateMessage(rawPrivateMessage) {
        let [sender, target, ...message] = rawPrivateMessage.split('|')
        sender = this._createUser(sender)
        message = message.join('|')

        if (sender.equals(this.user)) return

        const messageObject = new PrivateMessage(sender, message)
        this.emit('pm', messageObject)
        this.emit('message', messageObject)
    }

    _appendEvents() {
        this.on('rawMessage', this._onRawMessage.bind(this))
        this.on('raw-updateuser', this._onUpdateUser.bind(this))
        this.on('raw-c:', this._onChatMessage.bind(this))
        this.on('raw-pm', this._onPrivateMessage.bind(this))
        this.on('connection', this._onConnection.bind(this))
    }
}
