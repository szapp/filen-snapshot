import cliProgress from 'cli-progress'
import FilenSDK, { CloudItem } from '@filen/sdk'
import fs from 'fs'
import { DateTime } from 'luxon'
import * as OTPAuth from 'otpauth'
import { posix, sep as pathSep } from 'path'

function formatPath(path: string): string {
  return posix.normalize(path.split(pathSep).join(posix.sep))
}

// Input can either be a set of arguments or a path to a JSON file containing the arguments

interface FilenSnapshotParams {
  email: string // Filen account email
  password: string // Filen account password
  twoFactorCode?: string // Two-factor authentication TOTP (if enabled and twoFactorSecret is not specified)
  twoFactorSecret?: string // Two-factor authentication secret (if enabled and twoFactorCode is not specified)
  localPath?: string // Local path to Filen (if available, allows faster backups by uploading local files instead of downloading and uploading cloud files)
  source: string[] // Source directories (one or several paths relative to the root directory of the Filen drive)
  destination: string // Snapshot directory (relative to the root directory of the Filen drive, in which the snapshot will be created)
  snapshotName?: string // Default: 'yyyy-MM-dd_HH-mm-ss' (name of the snapshot directory, formatted with Luxon.DateTime.toFormat)
}

export default async function createSnapshot(params: FilenSnapshotParams | string): Promise<void> {
  // Load parameters from JSON file
  if (typeof params === 'string') params = JSON.parse(fs.readFileSync(params, { encoding: 'utf-8' })) as FilenSnapshotParams

  // Format paths
  const source: string[] = params.source.map((path) => formatPath(path))
  const destDir: string = formatPath(params.destination)
  const snapshotName: string = formatPath(DateTime.now().toFormat(params.snapshotName || 'yyyy-MM-dd_HH-mm-ss'))
  const destination: string = formatPath(posix.join(destDir, snapshotName))
  const localPath: string | undefined = params.localPath ? formatPath(params.localPath) : undefined

  // Verfiy source paths
  source.forEach((path) => {
    if (path.startsWith(destDir)) throw new Error(`Source path '${path}' is within the destination directory '${destDir}'`)
  })
  let maxLength: number = 0
  for (let idx = 0; idx < source.length; idx++) {
    const path = source[idx]
    maxLength = Math.max(maxLength, posix.basename(path).length + 2)
    for (let jdx = idx + 1; jdx < source.length; jdx++) {
      const other = source[jdx]
      if (path.startsWith(other) || other.startsWith(path)) throw new Error(`Source paths '${path}' and '${other}' overlap`)
    }
  }

  // Create a new Filen SDK instance
  const filen: FilenSDK = new FilenSDK({
    metadataCache: true,
  })

  // Create progress bars
  const multibar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      autopadding: true,
      format: '{source} {bar} {percentage}% {eta_formatted}',
    },
    cliProgress.Presets.shades_classic
  )

  // Login and copy files
  try {
    await filen.login({
      email: params.email,
      password: params.password,
      twoFactorCode: params.twoFactorCode
        ? params.twoFactorCode
        : params.twoFactorSecret
          ? new OTPAuth.TOTP({ secret: params.twoFactorSecret }).generate()
          : undefined,
    })

    // Abort all uploads if one fails
    const abortAll = new AbortController()

    // Copy each source to destination asynchronously
    const promises: Promise<void>[] = []
    for (const path of source) {
      // Check if it is a directory and get total size
      const { uuid, isDirectory } = await filen.fs().stat({ path })
      if (!isDirectory) throw new Error(`Source path '${path}' is not a directory`) // Only support directories for deterministic progress
      const { size } = await filen.api(3).dir().size({ uuid })

      // Check if the source path is available locally (for faster uploads)
      const isLocal = typeof localPath !== 'undefined' && fs.existsSync(posix.join(localPath, path))

      // Create progress bar (indicate with L or C if local or cloud, respectively)
      const progressName: string = ((isLocal ? 'L ' : 'C ') + posix.basename(path)).padEnd(maxLength, ' ')
      const progressBar: cliProgress.SingleBar = multibar.create(size, 0, { source: progressName })
      const progressFunc = (transfered: number): void => progressBar.increment(transfered)

      // If the source is local, upload the directory (faster), otherwise copy it (slower, because if first downloads and then uploads)
      let job: Promise<void | CloudItem>
      if (isLocal) {
        const totalPath: string = posix.join(localPath, path)

        // Create parent directories to get UUID
        const parents: string = posix.dirname(path)
        const parentUUID: string = await filen.fs().mkdir({ path: posix.join(destination, parents) })

        // Upload local directory, nested into parent directories
        job = filen.cloud().uploadLocalDirectory({
          source: totalPath,
          parent: parentUUID,
          onProgress: progressFunc,
          abortSignal: abortAll.signal,
        })
      } else {
        job = filen.fs().copy({
          from: path,
          to: posix.join(destination, path),
          onProgress: progressFunc,
          abortSignal: abortAll.signal,
        })
      }
      promises.push(job as Promise<void>)
    }

    // Wait for all copies to finish
    await Promise.all(promises).catch(abortAll.abort)
  } finally {
    multibar.stop()
    filen.logout()
    filen.clearTemporaryDirectory()
  }

  // Log success
  console.log(`\nSnapshot created at '${destination}'`)
}

module.exports = createSnapshot
