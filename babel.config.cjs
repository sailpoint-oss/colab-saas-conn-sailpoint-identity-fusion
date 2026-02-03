// Used by Jest to transform ESM-only node_modules (e.g. double-metaphone) to CommonJS
module.exports = {
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]]
}
