// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Lógica compartida con la versión web (gramática, colocación, generador, ARASAAC)
const shared = path.resolve(__dirname, '../src/lib')
config.watchFolders = [...(config.watchFolders ?? []), shared]
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]

module.exports = config
