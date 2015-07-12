Showdown Client
===============

`showdown-client` is a Showdown client library written in JavaScript
for Node.js (and io.js).

Installation
------------

You can get this module using `npm`.

    npm install showdown-client

Basic Usage
-----------

This library provides basic Showdown client functionality. For example,
you can connect to main Showdown server like this.

    var ShowdownClient = require('showdown-client');
    var client = new ShowdownClient();
    client.connect('showdown').then(function () {
        return client.login('username', 'password');
    }).then(function () {
        return client.join('techcode');
    });

Of course, that by itself is not really useful. Most of work is done
by events. For example, if you want to listen for messages, you can
listen to `message` event.

    client.addListener('message', function (message) {
        console.log("Received message from " + message.user + " saying " + message.text);
    });
