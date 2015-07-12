import {readFile, writeFile} from 'fs-promise'
import Client from './index'
import {commands} from '../showdown/commands'
import assert from 'assert'
import {strictEqual} from 'assert'
import {toId, toRoomId} from './utils'
import Room from './room'

const ADDRESS = '127.0.0.1'
const PORT = 0xCF1C

before(async function before() {
    const CONFIG_FILE = './showdown/config/config.js'
    const EXAMPLE_CONFIG_FILE = './showdown/config/config-example.js'
    let config
    try {
        config = require(`.${CONFIG_FILE}`)
    }
    catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND') throw error

        await writeFile(CONFIG_FILE, await readFile(EXAMPLE_CONFIG_FILE))
        await before()
        return
    }
    config.bindaddress = ADDRESS
    config.port = PORT
    commands.forcelogin = (target, room, user) => {
        user.forceRename(target, true)
    }
    require('../showdown/app')
})

describe('utils', () => {
    describe('toId', () => {
        it('should deserialize to identifier', () => {
            strictEqual(toId('Pokémon Black-2'), 'pokmonblack2')
        })
    })

    describe('toRoomId', () => {
        it('should deserialize to room identifier', () => {
            strictEqual(toRoomId('Pokémon Black-2'), 'pokmonblack-2')
        })
    })
})

describe('Room', () => {
    describe('#equals', () => {
        it('should compare identical rooms as equal', () => {
            assert(new Room('Pokémon Black-2').equals('PokmoNB Lack-2'))
        })

        it('should not compare not identical rooms as equal', () => {
            assert(!new Room('Pokémon Black-2').equals('PokmoNB Lack2'))
        })
    })
})

describe('Client', () => {
    async function connect() {
        const client = new Client
        await client.connect({host: ADDRESS, port: PORT})
        await client._loginPromise
        return client
    }

    describe('#connect', () => {
        it('should connect', async () => {
            ;(await connect()).disconnect()
        })
    })

    describe('#send', () => {
        it('should send commands', async done => {
            const connection = await connect()
            connection.send('forcelogin', 'test')
            connection.once('raw-updateuser', result => {
                if (result.split('|')[0] === 'test') {
                    connection.disconnect()
                    done()
                }
            })
        })
    })

    describe('#say', () => {
        it('should output text', async () => {
            const connections = await Promise.all([connect(), connect()])
            const [sender, receiver] = connections
            sender.send('forcelogin', 'test0')
            receiver.send('forcelogin', 'test1')
            const initPromises = []
            for (const connection of connections) {
                connection.joinRoom('lobby')
                initPromises.push(new Promise(resolve => {
                    connection.once('raw-init', resolve)
                }))
            }
            await Promise.all(initPromises)

            const MESSAGE = 'Hello, world!'
            sender.say(MESSAGE)

            const messagePromise = new Promise(resolve => {
                receiver.once('message', message => {
                    if (!message.user.equals('test0')) return
                    strictEqual(message.text, MESSAGE)
                    resolve()
                })
            })
            await messagePromise
            for (const connection of connections) {
                connection.disconnect()
            }
        })

        it('should be able to handle flood', async function () {
            this.timeout(6000)
            const connections = await Promise.all([connect(), connect()])
            const [sender, receiver] = connections
            sender.send('forcelogin', 'test2')
            receiver.send('forcelogin', 'test3')

            const initPromises = []
            for (const connection of connections) {
                connection.joinRoom('lobby')
                initPromises.push(new Promise(resolve => {
                    connection.once('raw-init', resolve)
                }))
            }
            await Promise.all(initPromises)

            const MESSAGE = 'Hello, world!'
            const MESSAGE_COUNT = 10
            for (let i = 0; i < MESSAGE_COUNT; i++) {
                sender.say(MESSAGE + i)
            }

            let messagesPromise = new Promise(resolve => {
                let received = 0
                receiver.on('message', message => {
                    if (!message.user.equals('test2')) return
                    strictEqual(message.text, MESSAGE + received)
                    received += 1
                    if (received > MESSAGE_COUNT) {
                        throw new Error(`Got more than ${MESSAGE_COUNT} messages.`)
                    }
                    if (received === MESSAGE_COUNT) {
                        resolve()
                    }
                })
            })

            await messagesPromise

            for (const connection of connections) {
                connection.disconnect()
            }
        })
    })
})
