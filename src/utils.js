import {get} from 'request-promise'
import {stringify} from 'querystring'

const CROSS_DOMAIN = 'https://play.pokemonshowdown.com/crossdomain.php?'

/**
 * Renames a given identifier to internal identifier form used by
 * Showdown. This form is used internally in many places in Showdown
 * client, including user names, format names, all sort of Pokemon
 * related things.
 *
 * @param {string} name - Name to convert to identifier format.
 */
export function toId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Renames a given identifier to internal identifier form used by
 * Showdown for room name.
 *
 * @param {string} name - Name to convert to room identifier format.
 */
export function toRoomId(name) {
     return name.toLowerCase().replace(/[^a-z0-9\-]/g, "")
}

/**
 * Ask Showdown Client to provide information about a server.
 *
 * @param {string|Object} server - Showdown identifier of a server,
 *     address of a server, or object containing server properties.
 *
 * @returns {Promise}
 */
export async function _parseServer(server) {
    if (typeof server !== 'string') return server
    if (!/\./.test(server)) {
        server += '.psim.us'
    }
    const body = await get(CROSS_DOMAIN + stringify({host: server}))
    if (!body) {
        throw new Error(`Server '${server}' not recognized.`)
    }

    const jsonConfig = /var config = (.*);$/m.exec(body)[1]
    return JSON.parse(jsonConfig)
}
