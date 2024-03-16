# Filen Snapshot

[![build](https://github.com/szapp/filen-snapshot/actions/workflows/build.yml/badge.svg)](https://github.com/szapp/filen-snapshot/actions/workflows/build.yml)

Create simple snapshots to back up your files and directories in your Filen.io drive

## Features

Simple backup tool that copies one or several directory trees into a designated directory to serve as a snapshot in time.

There is no functionality beyond the automated copy process.
This package can be setup locally to run on a schedule.

## Usage

Install

```
npm install szapp/filen-snapshot
```

Import

```typescript
// JavaScript
const createSnapshot = require('filen-snapshot')
// TypeScript
import createSnapshot from 'filen-snapshot'
```

Use

```typescript
await createSnapshot({
  email: 'filen-user@example.com', // Filen account email
  password: 'filen-password', // Filen account password
  twoFactorCode: '123456', // Two-factor authentication TOTP (if enabled and twoFactorSecret is not specified)
  twoFactorSecret: 'JFSU4NNSFGFLOPL2' // Two-factor authentication secret (if enabled and twoFactorCode is not specified)
  localPath: 'C:/Users/Admin/Filen/' // Local path to Filen (if available, allows faster backups by uploading local files instead of downloading and uploading cloud files)
  source: ['/Documents/Important/', '/Documents/Work/', '/Photos/'] // Source directories (one or several paths relative to the root directory of the Filen drive)
  destination: '/Snapshots/' // Snapshot directory (relative to the root directory of the Filen drive, in which the snapshot will be created)
  snapshotName: 'yyyy-MM-dd_HH.mm.ss' // Default: 'yyyy-MM-dd_HH-mm-ss' (name of the snapshot directory, formatted with Luxon.DateTime.toFormat)
})
```

Mind that the login information is exposed if entered into the node REPL.
A more secure alternative is to store the arguments safely to disk and provide a path to the JSON file.

```typescript
await createSnapshot('path/to/config.json')
```

The code above creates the following output:

```
L Important ████████████████████████████████████████ 100%  32s
C Work      ███████████████████████░░░░░░░░░░░░░░░░░  68%  5s
L Photos    ████████████████████████████████████████ 100%  50s
```

_The prefix (`L` or `C`) indicates if copied from local or cloud, respectively._

The code above will result in the following directory backup:

```
Filen drive/
├── Documents/
├── Photos/
├── ...
└── Snapshots/
    ├── ...
    └── 2024-03-16_23.10.45/
        ├── Documents/
        │   ├── Important/
        │   └── Work/
        └── Photos/
```

## Usage without knowledge of Node.js

1. Download and install [`nvm`](https://github.com/nvm-sh/nvm) (or [`nvm for windows`](https://github.com/coreybutler/nvm-windows))
2. Install the latest node version and npm
   ```bash
   nvm install latest && nvm use latest
   ```
   (Possibly restart your terminal)
3. Install this package
   ```bash
   npm install -g szapp/filen-snapshot
   ```
   (Possibly restart your terminal)
4. Create JavaScript file `runSnapshot.js` and adjust the following content
   ```javascript
   const createSnapshot = require('filen-snapshot')
   async function main() {
     await createSnapshot({
       email: 'filen-user@example.com', // Filen account email
       password: 'filen-password', // Filen account password
       twoFactorCode: '123456', // Two-factor authentication TOTP (if enabled and twoFactorSecret is not specified)
       twoFactorSecret: 'JFSU4NNSFGFLOPL2' // Two-factor authentication secret (if enabled and twoFactorCode is not specified)
       localPath: 'C:/Users/Admin/Filen/' // Local path to Filen (if available, allows faster backups by uploading local files instead of downloading and uploading cloud files)
       source: ['/Documents/Important/', '/Documents/Work/', '/Photos/'] // Source directories (one or several paths relative to the root directory of the Filen drive)
       destination: '/Snapshots/' // Snapshot directory (relative to the root directory of the Filen drive, in which the snapshot will be created)
       snapshotName: 'yyyy-MM-dd_HH.mm.ss' // Default: 'yyyy-MM-dd_HH-mm-ss' (name of the snapshot directory, formatted with Luxon.DateTime.toFormat)
     })
   }
   main()
   ```
5. Run from terminal with
   ```bash
   node runSnapshot.js
   ```

## Details

- Because of the encryption there is no simple copy functionality in the cloud.
  All files will be decrypted downloaded and uploaded into the snapshot directory.
  This will be quite a slow process and demanding on traffic and possibly unsafe (depending on the use of the local machine).
  A safer alternative is to provide the `localPath` to the Filen drive on the computer (if available).
  The files will then be uploaded directly which is much faster.
  Note that in both cases, the files are copied directly into the cloud and the snapshot directory does not have to be synced locally.

- Use at your own risk.
  The Filen SDK is still under active development and not meant for production.
  Although the logic of this package here is very concise, it was not thoroughly tested.
