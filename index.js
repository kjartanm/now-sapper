const { createLambda, download, getNodeVersion, getSpawnOptions } = require('@now/build-utils') // eslint-disable-line import/no-extraneous-dependencies
const path = require('path')
const {
  getLauncherFiles,
  getMountPoint,
  globAndPrefix
} = require('./lib/utils')

const { getConfig } = require('./lib/config')
const { npmBuild } = require('./lib/npm')

exports.config = {
  maxLambdaSize: '10mb'
}

exports.build = async ({
  files,
  entrypoint,
  workPath,
  config: rawConfig,
  meta = {}
}) => {
  const mountpoint = getMountPoint(entrypoint)
  const entrypointDir = path.join(workPath, mountpoint)
  await download(files, workPath, meta)

  const config = getConfig(rawConfig)
  const nodeVersion = await getNodeVersion(
    entrypointDir,
    null,
    config
  )

  const distDir = (config.distDir)?config.distDir + '/': '';
  const spawnOpts = getSpawnOptions(meta, nodeVersion)
  const prodDependencies = await npmBuild(config, entrypointDir, spawnOpts, meta)
  const launcherFiles = getLauncherFiles(entrypointDir)
  const staticFiles = await globAndPrefix(entrypointDir, 'static')
  const applicationFiles = await globAndPrefix(entrypointDir, '__sapper__')

  // Use the system-installed version of `node` when running via `now dev`
  const runtime = meta.isDev ? 'nodejs' : nodeVersion.runtime

  const lambda = await createLambda({
    files: {
      ...staticFiles,
      ...launcherFiles,
      ...prodDependencies,
      ...applicationFiles
    },
    handler: 'launcher.launcher',
    runtime: runtime
  }).catch(e => {
    console.error('createLambda.error', e)
    console.error('createLambda.config', config)
  })

  const output = {
    ...serve(staticFiles, 'static/', distDir),
    ...serve(applicationFiles, '__sapper__/build/service-worker.js', distDir + 'service-worker.js'),
    ...serve(applicationFiles, '__sapper__/build/client', distDir + 'client'),
    [distDir + 'index']: lambda
  }

  const routes = [
    {
      src: '/' + distDir + 'client/.+\\.(css|js|map)',
      headers: { 'cache-control': 'public,max-age=31536000,immutable' },
      continue: true
    },
    {
      src: '/' + distDir + 'service-worker.js',
      headers: { 'cache-control': 'public,max-age=0,must-revalidate' },
      continue: true
    },
    { handle: 'filesystem' },
    { src: '/' + distDir + '(.*)', dest: '/' + distDir}
  ]
  return { output, routes: (distDir !== '')?[]:routes }
}

function serve(arr, filePath, routePath) {
  return Object.keys(arr)
    .filter(path => path.startsWith(filePath))
    .reduce((obj, key) => {
      obj[key.replace(filePath, routePath)] = arr[key]
      return obj
    }, {})
}
