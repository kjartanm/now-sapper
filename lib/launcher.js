'use strict'

const { Server } = require('http')
const { Bridge } = require('./bridge.js')
const path = require('path')

let listener

try {
  process.env.PORT = 0
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production'
  }

  //process.chdir(__dirname)

  listener = require(path.join(
    __dirname,
    '__sapper__/build/server/server.js'
  ))

  /*
  console.log("process.cwd()", process.cwd(), path.join(
    '{entrypointDir}',
    '__sapper__/build/server/server.js'
  ))

  listener = require(path.join(
    '{entrypointDir}',
    '__sapper__/build/server/server.js'
  ))*/

  if (listener.default) {
    listener = listener.default
  }

  if (typeof listener !== 'function' && listener.handler) {
    listener = listener.handler
  }
} catch (error) {
  console.error('Server is not listening from ' + process.cwd(), error)
  process.exit(1)
}

const server = new Server(listener)

const bridge = new Bridge(server)
bridge.listen()

exports.launcher = bridge.launcher